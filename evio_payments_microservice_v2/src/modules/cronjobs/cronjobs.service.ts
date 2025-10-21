import { Injectable, Logger } from '@nestjs/common'
import { PreAuthorizationRepository } from 'src/paymentsAdyen/repositories/preauthorization.repository'
import AdyenAptService from '../payment/services/adyen-apt.service'
import { AdjustPreAuthorisationDto } from '../payment/dto/ajust-pre-authorisation.dto'

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name)
  constructor(
    private readonly preAuthorizationRepository: PreAuthorizationRepository,
    private readonly adyenAptService: AdyenAptService
  ) {}

  async extendPreAuthorisation(): Promise<any> {
    const preAuthorisationsList = await this.preAuthorizationRepository.findNextToExpire()
    preAuthorisationsList.forEach((preAuth) => {
      this.logger.log(
        `Extending pre-authorization for transactionId: ${preAuth.transactionId}, adyenReference: ${preAuth.adyenReference}, with expireDate: ${preAuth.expireDate}`
      )
      const dto = new AdjustPreAuthorisationDto()
      dto.amount = preAuth.amount.value
      dto.currency = preAuth.amount.currency
      dto.merchantReference = preAuth.transactionId
      dto.originalReference = preAuth.adyenReference
      dto.adjustAuthorisationData = preAuth.blobPreAuthorization
      this.adyenAptService.updatePreAuthorisationApt(dto)
    })
    return preAuthorisationsList
  }
}
