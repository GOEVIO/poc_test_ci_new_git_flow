export interface IAptPreAuthoriseResponse {
  SaleToPOIResponse: {
    MessageHeader: IMessageHeader
    PaymentResponse: IPaymentResponse
  }
}

export interface IMessageHeader {
  MessageCategory: string
  MessageClass: string
  MessageType: string
  POIID: string
  ProtocolVersion: string
  SaleID: string
  ServiceID: string
}

export interface IPaymentResponse {
  PaymentReceipt: IPaymentReceipt[]
  PaymentResult: IPaymentResult
  POIData: IPOIData
  Response: IResponseData
  SaleData: ISaleData
}

export interface IPaymentReceipt {
  DocumentQualifier: string
  OutputContent: IOutputContent
  RequiredSignatureFlag: boolean
}

export interface IOutputContent {
  OutputFormat: string
  OutputText: IOutputText[]
}

export interface IOutputText {
  CharacterStyle?: string
  EndOfLineFlag: boolean
  Text: string
}

export interface IPaymentResult {
  AmountsResp: IAmountsResp
  OnlineFlag: boolean
  PaymentAcquirerData: IPaymentAcquirerData
  PaymentInstrumentData: IPaymentInstrumentData
}

export interface IAmountsResp {
  AuthorizedAmount: number
  Currency: string
}

export interface IPaymentAcquirerData {
  AcquirerPOIID: string
  AcquirerTransactionID: IAcquirerTransactionID
  ApprovalCode: string
  MerchantID: string
}

export interface IAcquirerTransactionID {
  TimeStamp: string
  TransactionID: string
}

export interface IPaymentInstrumentData {
  CardData: ICardData
  PaymentInstrumentType: string
}

export interface ICardData {
  CardCountryCode: string
  EntryMode: string[]
  MaskedPan: string
  PaymentBrand: string
  SensitiveCardData: ISensitiveCardData
}

export interface ISensitiveCardData {
  CardSeqNumb: string
  ExpiryDate: string
}

export interface IPOIData {
  POIReconciliationID: string
  POITransactionID: IPOITransactionID
}

export interface IPOITransactionID {
  TimeStamp: string
  TransactionID: string
}

export interface IResponseData {
  AdditionalResponse: string
  Result: string
}

export interface ISaleData {
  SaleTransactionID: ISaleTransactionID
}

export interface ISaleTransactionID {
  TimeStamp: string
  TransactionID: string
}
