import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ConfigType } from '@nestjs/config';
import { buildSoapResponse } from './converters/csToCp';
import WebSocket from 'ws';
import { handleBootNotification } from './converters/messages/bootNotification';
import { handleAuthorize } from './converters/messages/authorize';
import { handleHeartbeat } from './converters/messages/heartbeat';
import { handleStartTransaction } from './converters/messages/startTransaction';
import { handleStopTransaction } from './converters/messages/stopTransaction';
import { handleStatusNotification } from './converters/messages/statusNotification';
import { getConfigurationResponse } from './converters/messages/getConfiguration';
import { handleMeterValues } from './converters/messages/meterValues';
import { buildSoapRequestFromWsMessage } from './converters/cpToCs';
import { acceptRejectResponse } from './converters/messages/acceptRejectResponse';
import { unlockConnectorResponse } from './converters/messages/unlockConnector';
import { LogsService } from './logs/logs.service';
import {
  app as appConfiguration
} from './config/';
import { extractOcppMessage } from './helpers/extract-ocpp-message';
import { sendSoapToEndpoint } from './helpers/soap-sender';

@Injectable()
export class AppService {
  constructor(
    private readonly logger: LogsService,
    @Inject(appConfiguration.KEY)
    private appConfig: ConfigType<typeof appConfiguration>
  ) {
    this.logger.setContext(AppService.name);
  }

  private chargeBoxToEndpoint: Map<string, string> = new Map();
  private pendingActions: Map<string, string> = new Map();
  private sockets: Map<string, WebSocket> = new Map();
  private responses: Map<string, (xml: string) => void> = new Map();

  private getHandler(action: string): ((json: any) => any) | null {
    switch (action) {
      case 'bootNotificationRequest': return handleBootNotification;
      case 'authorizeRequest': return handleAuthorize;
      case 'heartbeatRequest': return handleHeartbeat;
      case 'startTransactionRequest': return handleStartTransaction;
      case 'stopTransactionRequest': return handleStopTransaction;
      case 'statusNotificationRequest': return handleStatusNotification;
      case 'meterValuesRequest': return handleMeterValues;
      default: return null;
    }
  }

  private getResponseHandler(action: string): ((xml: any, uniqueId: string, action?: string) => any) | null {
    switch (action) {
      case 'GetConfiguration': return getConfigurationResponse;
      case 'UnlockConnector': return unlockConnectorResponse;
      default: return acceptRejectResponse; /*commands like remote[Start/Stop]Transaction or reset uses this default response */
    }
  }

  async convertAndSend(xml: string): Promise<any> {
    const { payload, action, chargeBoxIdentity, fromAddress } = await extractOcppMessage(xml);
    this.logger.log(`Received SOAP: ${action} / chargeBox: ${chargeBoxIdentity} at ${fromAddress}`);

    // Atualiza o mapa dinâmico com o endpoint recebido no SOAP Header
    if (chargeBoxIdentity && fromAddress) {
      this.chargeBoxToEndpoint.set(chargeBoxIdentity, fromAddress);
    }

    const handler = this.getHandler(action);
    if (!handler) {
      const soapReq = buildSoapResponse(action, uuidv4(), { status: 'Accepted' });
      this.logger.log(`Sending empty SOAP to ${fromAddress} for unhandled action ${action}`);
      return soapReq;
    }

    const ocppFrame = handler(payload);
    const uniqueId = ocppFrame[1];

    this.logger.log(`${chargeBoxIdentity}: ${ocppFrame[2]} - ${JSON.stringify(ocppFrame[3])}`);

    const socket = await this.getOrCreateSocket(chargeBoxIdentity);
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      this.logger.error(`WebSocket não está conectado para ${chargeBoxIdentity}`);
      return { error: `WebSocket não está conectado para ${chargeBoxIdentity}` };
    }

    return new Promise((resolve, reject) => {
      this.responses.set(uniqueId, (xmlResp: string) => {
        this.logger.log(`Enviando resposta para ${chargeBoxIdentity} at ${fromAddress}: ${action} id ${uniqueId}`);
        this.responses.delete(uniqueId);
        resolve(xmlResp);
      });

      this.pendingActions.set(uniqueId, action);
      socket.send(JSON.stringify(ocppFrame));
    });
  }

  private async getOrCreateSocket(chargeBoxId: string): Promise<WebSocket> {
    if (this.sockets.has(chargeBoxId)) {
      const existing = this.sockets.get(chargeBoxId);
      if (existing?.readyState === WebSocket.OPEN) return existing;
    }

    const url = `${this.appConfig.ocpp16.host}/${chargeBoxId}`;
    const ws = new WebSocket(url);

    ws.on('open', () => {
      this.logger.log('Connected', url);
      this.sockets.set(chargeBoxId, ws);
    });

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.logger.log(`Received message from ${url}:`, message);

        if (Array.isArray(message)) {
          const msgType = message[0];
          const uniqueId = message[1];
          const payload = message[2];
          
          if (msgType === 3) {
            // Response from charger to our request
            const action = this.pendingActions.get(uniqueId) || 'Generic';
            const xml = buildSoapResponse(action, uniqueId, payload);
            const cb = this.responses.get(uniqueId);
            if (cb) cb(xml);

            this.responses.delete(uniqueId);
            this.pendingActions.delete(uniqueId);
          } else if (msgType === 2) {
            // Request from charger — ex: RemoteStartTransaction, etc
            // Enviar SOAP para o endpoint associado à chargeBoxIdentity

            const chargeBox = chargeBoxIdFromUrl(url);
            const endpoint = this.getEndpointForChargeBox(chargeBox);
            if (!endpoint) {
              this.logger.error(`No endpoint associated with chargeBox ${chargeBox}`);
              return;
            }

            // Construa o SOAP de requisição para enviar ao CS:
            // Exemplo simplificado, pode usar outro builder similar
            const soapReq = buildSoapRequestFromWsMessage(message, chargeBox, endpoint);

            // Aqui faça sua requisição SOAP para o endpoint (ex: axios/fetch)
            const soapResponse = await sendSoapToEndpoint(endpoint, soapReq);

            if(msgType === 2 && payload) {
              const responseHandler = this.getResponseHandler(message[2]);
              const response = responseHandler ? await responseHandler(soapResponse.data, uniqueId, message[2] ?? null) : null;
              ws.send(JSON.stringify(response));
            }
          }
        }
      } catch (err) {
        this.logger.error('Erro ao processar mensagem WebSocket:', err);
      }
    });

    ws.on('error', (err) => {
      this.logger.error('Erro ao conectar em', url, err);
    });

    return new Promise((resolve, reject) => {
      ws.on('open', () => resolve(ws));
      ws.on('error', reject);
    });
  }
  
  private getEndpointForChargeBox(chargeBoxIdentity: string): string | undefined {
    // Retorna o endpoint associado dinamicamente
    return this.chargeBoxToEndpoint.get(chargeBoxIdentity);
  }
}

// Função auxiliar para extrair chargeBoxId da url ws://host/chargeBoxId
function chargeBoxIdFromUrl(url: string): string {
  const parts = url.split('/');
  return parts[parts.length - 1];
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function uncapitalize(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}
