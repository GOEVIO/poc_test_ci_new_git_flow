export interface IAdjustPreAuthoriseResponse {
  additionalData: {
    authCode: string
    adjustAuthorisationData: string
    refusalReasonRaw: string
  }
  pspReference: string
  response: string
}
