export interface IMessageHeader {
  ProtocolVersion: string
  MessageClass: string
  MessageCategory: string
  MessageType: string
  ServiceID: string
  SaleID: string
  POIID: string
}

export interface ISaleTransactionID {
  TransactionID: string
  TimeStamp: string
}

export interface ISaleData {
  SaleTransactionID: ISaleTransactionID
}

export interface ICardAcquisitionTransaction {}

export interface ICardAcquisitionRequest {
  SaleData: ISaleData
  CardAcquisitionTransaction: ICardAcquisitionTransaction
}

export interface IEnableServiceRequest {
  TransactionAction: string
  DisplayOutput: Object
}

export interface ISaleToPOIRequest {
  MessageHeader: IMessageHeader
  CardAcquisitionRequest?: ICardAcquisitionRequest
  EnableServiceRequest?: IEnableServiceRequest
}

export interface IAptIdentifyUserRequest {
  SaleToPOIRequest: ISaleToPOIRequest
}
