import { AdjustPreAuthorisationDto } from '../dto/ajust-pre-authorisation.dto'
import { AptIdentifyUserDto } from '../dto/apt-identify-user.dto'
import { AptPreAuthorisationDto } from '../dto/apt-pre-authorisation.dto'
import { CancelPreAuthorisationDto } from '../dto/cancel-pre-authorisation.dto'
import { CaptureDto } from '../dto/capture.dto'
import { PaymentStrategyEnum } from '../enums/payment-strategy.enum'
import { PaymentUseCase } from '../enums/payment-use-cases.enum'
import { DtoRegistry } from '../registry/dto.registry'

export class DtoFactory {
  static create(): DtoRegistry {
    const reg = new DtoRegistry()
    // Apt
    reg.register(PaymentStrategyEnum.APT, PaymentUseCase.PreAuthorise, AptPreAuthorisationDto)
    reg.register(PaymentStrategyEnum.APT, PaymentUseCase.UpdatePreAuthorisation, AdjustPreAuthorisationDto)
    reg.register(PaymentStrategyEnum.APT, PaymentUseCase.CancelPreAuthorisation, CancelPreAuthorisationDto)
    reg.register(PaymentStrategyEnum.APT, PaymentUseCase.Capture, CaptureDto)
    reg.register(PaymentStrategyEnum.APT, PaymentUseCase.Identify, AptIdentifyUserDto)

    return reg
  }
}
