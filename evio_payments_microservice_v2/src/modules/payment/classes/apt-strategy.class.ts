import { Injectable } from '@nestjs/common'
import { IPaymentStrategy } from '../interfaces/payment-strategy.interface'
import AdyenAptService from '../services/adyen-apt.service'

@Injectable()
export default class AptStrategy implements IPaymentStrategy {
  constructor(private readonly aptService: AdyenAptService) {}

  async preAuthorise(body: any): Promise<any> {
    return this.aptService.preAuthoriseApt(body)
  }

  async updatePreAuthorisation(body: any): Promise<any> {
    return this.aptService.updatePreAuthorisationApt(body)
  }

  async cancelPreAuthorisation(body: any): Promise<any> {
    return this.aptService.cancelPreAuthorisationApt(body)
  }

  async capture(body: any): Promise<any> {
    return this.aptService.capture(body)
  }

  async identify(body: any): Promise<any> {
    return this.aptService.identify(body)
  }
}
