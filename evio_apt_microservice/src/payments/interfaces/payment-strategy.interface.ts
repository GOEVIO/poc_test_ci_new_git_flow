export interface IPaymentStrategy {
  makePreAuthorize(body: any): Promise<any>
  cancelPreAuthorization(body: any): Promise<any>
  identifyCard?(serial_number: string, apt: any): Promise<any>
}
