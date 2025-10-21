import { IAptIdentifyUserRequest } from '../interfaces/apt-identify-user-request.interface'
import { v7 as uuidv7 } from 'uuid'
import { AptIdentifyUserDto } from '../dto/apt-identify-user.dto'
import * as crypto from 'crypto'

export class AdyenIdentifyRequestBuilder {
  constructor(private readonly dto: AptIdentifyUserDto) {}

  private buildMessageHeader(messageCategory: string): any {
    return {
      ProtocolVersion: '3.0',
      MessageClass: 'Service',
      MessageCategory: messageCategory,
      MessageType: 'Request',
      SaleID: uuidv7(),
      ServiceID: crypto.randomBytes(16).toString('hex').substring(0, 10),
      POIID: this.dto.serial,
    }
  }

  buildIdentifyRequest(): IAptIdentifyUserRequest {
    return {
      SaleToPOIRequest: {
        MessageHeader: this.buildMessageHeader('CardAcquisition'),
        CardAcquisitionRequest: {
          SaleData: {
            SaleTransactionID: {
              TransactionID: this.dto.transactionId,
              TimeStamp: new Date().toISOString(),
            },
          },
          CardAcquisitionTransaction: {},
        },
      },
    }
  }

  buildAbortRequest(): IAptIdentifyUserRequest {
    return {
      SaleToPOIRequest: {
        MessageHeader: this.buildMessageHeader('EnableService'),
        EnableServiceRequest: {
          TransactionAction: 'AbortTransaction',
          DisplayOutput: {
            Device: 'CustomerDisplay',
            InfoQualify: 'Display',
            OutputContent: {
              PredefinedContent: {
                ReferenceID: 'AcceptedAnimated',
              },
              OutputFormat: 'Text',
              OutputText: [
                {
                  Text: 'Obrigado!',
                },
                {
                  Text: 'Thank you!',
                },
              ],
            },
          },
        },
      },
    }
  }
}
