export interface IModificationAmount {
  currency: string
  value: number
}

export interface IAdditionalData {
  adjustAuthorisationData: string
  RequestedTestAcquirerResponseCode?: number
}

export interface IAdjustPreAuthoriseRequest {
  merchantAccount: string
  originalReference: string
  modificationAmount: IModificationAmount
  reference: string
  additionalData?: IAdditionalData
}
