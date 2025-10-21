import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { Request } from 'express'

@Injectable()
export class ReceiverInterceptor implements NestInterceptor {
  constructor() {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req: Request = context.switchToHttp().getRequest()

    const { method, url, body, params } = req
    const requestObject = {
      url: `${method} ${url}`,
      ...(body && { body }),
      ...(params && { params: { ...params } }),
      timestamp: new Date(),
    }
    console.log('Received:', JSON.stringify(requestObject))

    return next.handle()
  }
}
