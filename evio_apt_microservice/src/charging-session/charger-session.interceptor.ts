import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { DeviceTypes } from 'evio-library-commons'
import { PaymentsLibraryService } from '../libraries/payments/payments-library.service'

@Injectable()
export class ChargerSessionInterceptor implements NestInterceptor {
  constructor(
    private readonly paymentsLibraryService: PaymentsLibraryService
  ) {}
  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest()
    const strategy =
      (request?.headers?.strategy?.toLocaleUpperCase() as DeviceTypes) ||
      DeviceTypes.APT

    switch (strategy) {
      case DeviceTypes.APT:
        request.body.clientType = DeviceTypes.APT
        request.body.userId = request.apt.user_id
        request.body.client_name = request.apt.client_name
        break
      case DeviceTypes.QR_CODE:
        request.body.clientType = DeviceTypes.QR_CODE
        request.body.client_name = 'EVIO'
        const preAuthorizationUserId = request?.body?.pspReference
          ? await this.paymentsLibraryService.getUserIdFromPreAuthorization(
              request.body.pspReference
            )
          : '-1'
        request.body.userId = preAuthorizationUserId || '-1'
        break
      default:
        throw new BadRequestException({
          message: 'Invalid strategy',
          code: 'invalid_strategy',
        })
    }

    return next.handle()
  }
}
