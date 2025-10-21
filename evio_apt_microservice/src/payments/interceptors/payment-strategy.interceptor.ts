import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import PaymentService from '../services/payment.service'
import AptStrategy from '../classes/apt-strategy.class'
import QrCodeStrategy from '../classes/qr-code-strategy.class'
import { DeviceTypes } from 'evio-library-commons'

@Injectable()
export class PaymentStrategyInterceptor implements NestInterceptor {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly aptStrategy: AptStrategy,
    private readonly qrCodeStrategy: QrCodeStrategy
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest()
    const strategy = request.headers.strategy.toLocaleUpperCase() as DeviceTypes

    const strategyMap = {
      [DeviceTypes.APT]: this.aptStrategy,
      [DeviceTypes.QR_CODE]: this.qrCodeStrategy,
    }

    if (!strategy || !Object.values(DeviceTypes).includes(strategy)) {
      throw new BadRequestException({
        success: false,
        server_status_code: 'invalid_strategy',
        error: `Invalid payment strategy provided. Must be one of: ${Object.values(DeviceTypes).join(', ')}`,
      })
    }

    this.paymentService.setStrategy(strategyMap[strategy])

    return next.handle()
  }
}
