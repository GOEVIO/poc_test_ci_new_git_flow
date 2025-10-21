import { DeviceTypes } from 'evio-library-commons'
import {
  AptCancelPreAuthorizationBody,
  AptPreAuthorizationBodyDto,
} from '../dtos/apt-pre-authorization.dto'
import { QrCodePreAuthorizationBodyDto } from '../dtos/qr-code-pre-authorization.dto'
import { PaymentUseCase } from '../enums/payment-use-cases.enum'
import { DtoRegistry } from '../registry/dto.registry'

export class DtoFactory {
  static create(): DtoRegistry {
    const reg = new DtoRegistry()
    // Apt
    reg.register(
      DeviceTypes.APT,
      PaymentUseCase.PreAuthorise,
      AptPreAuthorizationBodyDto
    )
    reg.register(
      DeviceTypes.APT,
      PaymentUseCase.CancelPreAuthorization,
      AptCancelPreAuthorizationBody
    )
    // QR Code
    reg.register(
      DeviceTypes.QR_CODE,
      PaymentUseCase.PreAuthorise,
      QrCodePreAuthorizationBodyDto
    )
    reg.register(
      DeviceTypes.QR_CODE,
      PaymentUseCase.CancelPreAuthorization,
      AptPreAuthorizationBodyDto
    )

    return reg
  }
}
