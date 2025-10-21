export interface IMessageHeader {
  ProtocolVersion: string
  MessageClass: string
  MessageCategory: string
  MessageType: string
  SaleID: string
  ServiceID: string
  POIID: string
}

export interface ISaleTransactionID {
  TransactionID: string
  TimeStamp: string
}

export interface ISaleData {
  SaleTransactionID: ISaleTransactionID
  SaleToAcquirerData: string
}

export interface IAmountsReq {
  Currency: string
  RequestedAmount: number
}

export interface IPaymentTransaction {
  AmountsReq: IAmountsReq
}

export interface IPaymentRequest {
  SaleData: ISaleData
  PaymentTransaction: IPaymentTransaction
}

export interface ISaleToPOIRequest {
  MessageHeader: IMessageHeader
  PaymentRequest: IPaymentRequest
}

export interface IAptPreAuthoriseRequest {
  SaleToPOIRequest: ISaleToPOIRequest
}
