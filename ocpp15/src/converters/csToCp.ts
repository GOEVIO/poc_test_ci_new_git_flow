import { Builder } from 'xml2js';
import { capitalize, lowerFirst } from '../helpers/convertCases';
const builder = new Builder({ headless: true });

export function buildSoapResponse(action: string, uniqueId: string, payload: any): string {
  const soapNs = 'http://www.w3.org/2003/05/soap-envelope';
  const addrNs = 'http://www.w3.org/2005/08/addressing';
  const csNs = 'urn://Ocpp/Cs/2015/10/';
  const builder = new Builder({ headless: true });

  let bodyContent: any = {};
  let responseElementName = '';

  switch (action) {
    case 'bootNotificationRequest':
      responseElementName = 'cs:bootNotificationResponse';
      bodyContent[responseElementName] = {
        'cs:status': payload.status || 'Accepted',
        'cs:currentTime': payload.currentTime || new Date().toISOString(),
        'cs:interval': payload.interval || 300,
      };
      break;
    case 'authorizeRequest':
      responseElementName = 'cs:authorizeResponse';
      bodyContent[responseElementName] = {
        'cs:idTagInfo': {
          'cs:status': payload.idTagInfo?.status || 'Accepted',
        },
      };
      break;
    case 'startTransactionRequest':
      responseElementName = 'cs:startTransactionResponse';
      bodyContent[responseElementName] = {
        'cs:transactionId': payload.transactionId || 1,
        'cs:idTagInfo': {
          'cs:status': payload.idTagInfo?.status || 'Accepted',
        },
      };
      break;
    case 'stopTransactionRequest':
      responseElementName = 'cs:stopTransactionResponse';
      bodyContent[responseElementName] = {};
      break;
    case 'heartbeatRequest':
      responseElementName = 'cs:heartbeatResponse';
      bodyContent[responseElementName] = {
        'cs:currentTime': payload.currentTime || new Date().toISOString(),
      };
      break;
    case 'statusNotificationRequest':
      responseElementName = 'cs:statusNotificationResponse';
      bodyContent[responseElementName] = {};
      break;
    case 'getConfigurationRequest':
      responseElementName = 'cs:getConfigurationResponse';
      bodyContent[responseElementName] = {
        'cs:configurationKey': payload.configurationKey?.map((item: any) => ({
          'cs:key': item.key,
          'cs:value': item.value || '',
          'cs:readonly': item.readonly || false
        })) || [],
        'cs:unknownKey': payload.unknownKey || []
      };
      break;
    case 'meterValuesRequest':
      responseElementName = 'cs:meterValuesResponse';
      bodyContent[responseElementName] = {};
      break;
    default:
      responseElementName = `${lowerFirst(action).replace('Request', 'Response')}`;
      bodyContent[responseElementName] = Object.keys(payload).map((key: string) => ({
        [`${key}`]: payload[key]
      }));
      break;
  }

  const envelope = {
    'soap:Envelope': {
      $: {
        'xmlns:soap': soapNs,
        'xmlns:a': addrNs,
        'xmlns:cs': csNs,
      },
      'soap:Header': {
        'a:Action': `/${capitalize(action.replace('Request', ''))}`,
        'a:RelatesTo': uniqueId,
      },
      'soap:Body': bodyContent,
    },
  };

  return '<?xml version="1.0" encoding="utf-8"?>\n' + builder.buildObject(envelope);
}