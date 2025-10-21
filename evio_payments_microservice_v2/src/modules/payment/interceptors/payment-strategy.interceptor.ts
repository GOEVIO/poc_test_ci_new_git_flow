import { BadRequestException, CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import PaymentService from '../services/payment.service'
import AptStrategy from '../classes/apt-strategy.class'
import { PaymentStrategyEnum } from '../enums/payment-strategy.enum'

@Injectable()
export class PaymentStrategyInterceptor implements NestInterceptor {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly aptStrategy: AptStrategy
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest()
    const strategy = request.headers.strategy

    switch (strategy) {
      case PaymentStrategyEnum.APT:
        this.paymentService.setStrategy(this.aptStrategy)
        break
      default:
        throw new BadRequestException({
          success: false,
          server_status_code: 'invalid_strategy',
          error: `Invalid payment strategy provided. Must be one of: ${Object.values(PaymentStrategyEnum).join(', ')}`,
        })
    }

    return next.handle()
  }
}
