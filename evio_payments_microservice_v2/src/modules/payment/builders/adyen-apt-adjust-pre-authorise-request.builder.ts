import { ConfigService } from '@nestjs/config'
import { AdjustPreAuthorisationDto } from '../dto/ajust-pre-authorisation.dto'
import { IAdjustPreAuthoriseRequest } from '../interfaces/adjust-pre-authorise-request.interface'

export class AdyenAptAdjustPreAuthoriseRequestBuilder {
  private readonly aptConfig: any

  constructor(
    private readonly dto: AdjustPreAuthorisationDto,
    private readonly configService: ConfigService
  ) {
    this.aptConfig = this.configService.get('payment.apt')
  }

  build(): IAdjustPreAuthoriseRequest {
    return {
      merchantAccount: this.aptConfig.AdyenMerchantAccount,
      originalReference: this.dto.originalReference,
      modificationAmount: {
        currency: this.dto.currency,
        value: this.dto.amount * 100,
      },
      reference: this.dto.merchantReference,
      additionalData: {
        adjustAuthorisationData: this.dto.adjustAuthorisationData,
        ...(process.env.NODE_ENV !== 'production' && this.dto.refusalTestCode && { RequestedTestAcquirerResponseCode: this.dto.refusalTestCode }),
      },
    }
  }
}
