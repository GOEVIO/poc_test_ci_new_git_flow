import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { DeviceTypes } from 'evio-library-commons'

@Injectable()
export class QrCodePreAuthoriseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest()

    if (request.headers.strategy?.toLocaleUpperCase() !== DeviceTypes.QR_CODE) {
      return next.handle()
    }

    const language = request.headers.language || 'en_GB'

    if (request.body?.billingInfo) {
      request.body.billingInfo.language = language
    }

    return next.handle()
  }
}
