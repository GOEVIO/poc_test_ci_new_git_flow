export interface IModificationAmount {
  currency: string
  value: number
}

export interface ICaptureRequest {
  merchantAccount: string
  modificationAmount: IModificationAmount
  originalReference: string
  reference: string
}
