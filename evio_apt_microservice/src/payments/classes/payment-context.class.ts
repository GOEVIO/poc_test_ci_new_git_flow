import { IPaymentStrategy } from '../interfaces/payment-strategy.interface'
import { Apt } from '../../database/entities/apt.entity'

export default class PaymentContext {
  private strategy: IPaymentStrategy

  public setStrategy(strategy: IPaymentStrategy): void {
    this.strategy = strategy
  }

  public async makePreAuthorize(body: any): Promise<any> {
    return this.strategy.makePreAuthorize(body)
  }

  public async cancelPreAuthorization(body: any): Promise<any> {
    return this.strategy.cancelPreAuthorization(body)
  }

  public async identifyCard(serial_number: string, apt: Apt): Promise<any> {
    return this.strategy.identifyCard(serial_number, apt)
  }
}
