export interface IPaymentStrategy {
  preAuthorise(body: any): Promise<any>
  updatePreAuthorisation?(body: any): Promise<any>
  cancelPreAuthorisation(body: any): Promise<any>
  capture(body: any): Promise<any>
  identify?(body: any): Promise<any>
}
