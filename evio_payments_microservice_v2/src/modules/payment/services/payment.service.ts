import PaymentContext from '../classes/payment-context.class'
import { IPaymentStrategy } from '../interfaces/payment-strategy.interface'

export default class PaymentService {
  private paymentContext: PaymentContext

  constructor() {
    this.paymentContext = new PaymentContext()
  }

  public setStrategy(strategy: IPaymentStrategy): void {
    this.paymentContext.setStrategy(strategy)
  }

  public async preAuthorise(body: any): Promise<any> {
    return this.paymentContext.preAuthorise(body)
  }

  public async updatePreAuthorisation(body: any): Promise<any> {
    return this.paymentContext.updatePreAuthorisation(body)
  }

  public async cancelPreAuthorisation(body: any): Promise<any> {
    return this.paymentContext.cancelPreAuthorisation(body)
  }

  public async capture(body: any): Promise<any> {
    return this.paymentContext.capture(body)
  }

  public async identify(body: any): Promise<any> {
    return this.paymentContext.identify(body)
  }
}
