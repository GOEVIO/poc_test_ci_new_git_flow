import { Apt } from 'src/database/entities/apt.entity'
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

  public async makePreAuthorize(body: any): Promise<any> {
    return this.paymentContext.makePreAuthorize(body)
  }

  public async cancelPreAuthorization(data: any): Promise<any> {
    return this.paymentContext.cancelPreAuthorization(data)
  }

  public async identifyCard(serial_number: string, apt: Apt): Promise<any> {
    return this.paymentContext.identifyCard(serial_number, apt)
  }
}
