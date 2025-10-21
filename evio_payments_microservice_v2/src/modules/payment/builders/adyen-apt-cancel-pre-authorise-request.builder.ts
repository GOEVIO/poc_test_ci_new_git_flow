import { ConfigService } from '@nestjs/config'
import { CancelPreAuthorisationDto } from '../dto/cancel-pre-authorisation.dto'
import { ICancelAuthoriseRequest } from '../interfaces/cancel-authorise-request'

export class AdyenCancelPreAuthoriseBuilder {
  private readonly aptConfig: any

  constructor(
    private readonly dto: CancelPreAuthorisationDto,
    private readonly configService: ConfigService
  ) {
    this.aptConfig = this.configService.get('payment.apt')
  }

  build(): ICancelAuthoriseRequest {
    return {
      merchantAccount: this.aptConfig.AdyenMerchantAccount,
      originalReference: this.dto.originalReference,
      reference: this.dto.merchantReference,
    }
  }
}
