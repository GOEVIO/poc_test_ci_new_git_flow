import { Injectable } from '@nestjs/common'
import { IPaymentStrategy } from '../interfaces/payment-strategy.interface'
import { AptPaymentService } from '../services/apt-payment.service'
import { Apt } from '../../database/entities/apt.entity'
import {
  AptCancelPreAuthorizationBody,
  AptPreAuthorizationBodyDto,
} from '../dtos/apt-pre-authorization.dto'

@Injectable()
export default class AptStrategy implements IPaymentStrategy {
  constructor(private readonly aptService: AptPaymentService) {}

  async makePreAuthorize(body: AptPreAuthorizationBodyDto) {
    return this.aptService.makePreAuthorize(body)
  }

  async cancelPreAuthorization(body: AptCancelPreAuthorizationBody) {
    return this.aptService.cancelPreAuthorization(body)
  }

  async identifyCard(serial_number: string, apt: Apt) {
    return this.aptService.identifyCard(serial_number, apt)
  }
}
