import { Injectable } from '@nestjs/common'
import { IPaymentStrategy } from '../interfaces/payment-strategy.interface'
import { AptPaymentService } from '../services/apt-payment.service'
import { QrCodePaymentService } from '../services/qr-code-payment.service'
import { AptCancelPreAuthorizationBody } from '../dtos/apt-pre-authorization.dto'
import { QrCodePreAuthorizationBodyDto } from '../dtos/qr-code-pre-authorization.dto'

@Injectable()
export default class QrCodeStrategy implements IPaymentStrategy {
  constructor(
    private readonly qrService: QrCodePaymentService,
    private readonly aptService: AptPaymentService
  ) {}

  async makePreAuthorize(body: QrCodePreAuthorizationBodyDto) {
    return this.qrService.makePreAuthorize(body)
  }

  async cancelPreAuthorization(body: AptCancelPreAuthorizationBody) {
    return this.aptService.cancelPreAuthorization(body)
  }
}
