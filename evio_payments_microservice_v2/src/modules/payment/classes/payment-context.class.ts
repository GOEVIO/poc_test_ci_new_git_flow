import { IPaymentStrategy } from '../interfaces/payment-strategy.interface'

export default class PaymentContext {
  private strategy: IPaymentStrategy

  constructor() {}

  public setStrategy(strategy: IPaymentStrategy): void {
    this.strategy = strategy
  }

  public async preAuthorise(body: any): Promise<any> {
    return this.strategy.preAuthorise(body)
  }

  public async updatePreAuthorisation(body: any): Promise<any> {
    return this.strategy.updatePreAuthorisation(body)
  }

  public async cancelPreAuthorisation(body: any): Promise<any> {
    return this.strategy.cancelPreAuthorisation(body)
  }

  public async capture(body: any): Promise<any> {
    return this.strategy.capture(body)
  }

  public async identify(body: any): Promise<any> {
    return this.strategy.identify(body)
  }
}
