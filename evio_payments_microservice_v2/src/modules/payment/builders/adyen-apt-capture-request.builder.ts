import { ConfigService } from '@nestjs/config'
import { ICaptureRequest } from '../interfaces/capture-request.interface'
import { CaptureDto } from '../dto/capture.dto'

export class AdyenCaptureRequestBuilder {
  private readonly aptConfig: any

  constructor(
    private readonly dto: CaptureDto,
    private readonly configService: ConfigService
  ) {
    this.aptConfig = this.configService.get('payment.apt')
  }

  build(): ICaptureRequest {
    return {
      merchantAccount: this.aptConfig.AdyenMerchantAccount,
      modificationAmount: {
        currency: this.dto.currency,
        value: this.dto.amount * 100,
      },
      originalReference: this.dto.originalReference,
      reference: this.dto.merchantReference,
    }
  }
}
