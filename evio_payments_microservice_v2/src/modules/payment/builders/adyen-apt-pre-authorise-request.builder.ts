import { AptPreAuthorisationDto } from '../dto/apt-pre-authorisation.dto'
import { IAptPreAuthoriseRequest } from '../interfaces/apt-pre-authorise-request.interface'
import { v7 as uuidv7 } from 'uuid'
import * as crypto from 'crypto'
export class AdyenPreAuthoriseRequestBuilder {
  constructor(private readonly dto: AptPreAuthorisationDto) {}

  build(): IAptPreAuthoriseRequest {
    const timestamp = new Date().toISOString()
    return {
      SaleToPOIRequest: {
        MessageHeader: {
          ProtocolVersion: '3.0',
          MessageClass: 'Service',
          MessageCategory: 'Payment',
          MessageType: 'Request',
          SaleID: uuidv7(),
          ServiceID: crypto.randomBytes(16).toString('hex').substring(0, 10),
          POIID: this.dto.serial,
        },
        PaymentRequest: {
          SaleData: {
            SaleTransactionID: {
              TransactionID: this.dto.merchantReference,
              TimeStamp: timestamp,
            },
            SaleToAcquirerData: 'authorisationType=PreAuth&manualCapture=true',
          },
          PaymentTransaction: {
            AmountsReq: {
              Currency: this.dto.currency,
              RequestedAmount: this.dto.amount,
            },
          },
        },
      },
    }
  }
}
