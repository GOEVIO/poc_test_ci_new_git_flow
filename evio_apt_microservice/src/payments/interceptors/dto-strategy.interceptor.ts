import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  BadRequestException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { plainToInstance } from 'class-transformer'
import { DtoRegistry } from '../registry/dto.registry'
import { USE_CASE_KEY } from '../decorators/use-case.decorator'
import { DeviceTypes } from 'evio-library-commons'
import { validateRequest } from '../../core/helpers'

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

    const strategy: string = String(
      request.headers['strategy'] ?? ''
    ).toLocaleUpperCase()
    if (
      !strategy ||
      !Object.values(DeviceTypes).includes(strategy as DeviceTypes)
    ) {
      throw new BadRequestException('Missing or invalid strategy header')
    }

    const Dto = this.registry.get(strategy, useCase)
    const instance = plainToInstance(Dto, request.body)
    await validateRequest(instance)

    request.body = instance
    return next.handle()
  }
}
