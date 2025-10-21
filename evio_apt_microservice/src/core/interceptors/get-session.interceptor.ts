import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { GetSessionClient } from '../../clients/get-sessions/get-session.client'

@Injectable()
export class GetSessionInterceptor implements NestInterceptor {
  constructor(private readonly getSessionClient: GetSessionClient) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest()
    const chargerType = request?.query?.chargerType || '004'
    this.getSessionClient.setGetSessionClient(chargerType)

    return next.handle()
  }
}
