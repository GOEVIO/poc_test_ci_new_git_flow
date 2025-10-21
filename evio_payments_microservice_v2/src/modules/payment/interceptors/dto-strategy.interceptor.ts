import { CallHandler, ExecutionContext, Injectable, NestInterceptor, BadRequestException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { DtoRegistry } from '../registry/dto.registry'
import { USE_CASE_KEY } from '../decorators/use-case.decorator'
import { PaymentStrategyEnum } from '../enums/payment-strategy.enum'

@Injectable()
export class DtoStrategyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly registry: DtoRegistry
  ) {}

  async intercept(ctx: ExecutionContext, next: CallHandler) {
    const request = ctx.switchToHttp().getRequest()
    const useCase = this.reflector.get<string>(USE_CASE_KEY, ctx.getHandler())

    if (!useCase) return next.handle()

    const strategy: string = String(request.headers['strategy'] ?? '').toLowerCase()
    if (!strategy || !Object.values(PaymentStrategyEnum).includes(strategy as PaymentStrategyEnum)) {
      throw new BadRequestException('Missing or invalid strategy header')
    }

    const Dto = this.registry.get(strategy, useCase)
    const instance = plainToInstance(Dto, request.body)
    const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true })

    if (errors.length) {
      throw new BadRequestException({
        success: false,
        server_status_code: 'validation_failed',
        message: errors.flatMap((error) => Object.values(error.constraints || {})),
      })
    }

    request.body = instance
    return next.handle()
  }
}
