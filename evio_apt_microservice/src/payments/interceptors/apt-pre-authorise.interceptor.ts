import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  BadRequestException,
} from '@nestjs/common'
import { DeviceTypes } from 'evio-library-commons'

@Injectable()
export class AptPreAuthorizeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest()

    if (request.headers.strategy?.toLocaleUpperCase() !== DeviceTypes.APT) {
      return next.handle()
    }

    if (!request.apt) {
      throw new BadRequestException({
        message: 'APT data is missing in request',
        code: 'apt_data_missing',
      })
    }

    request.body.serialNumber = request.apt.serial_number
    request.body.model = request.apt.model

    return next.handle()
  }
}
