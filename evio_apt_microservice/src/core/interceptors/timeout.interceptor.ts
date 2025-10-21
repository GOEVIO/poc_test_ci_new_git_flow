import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common'
import { Observable, TimeoutError, catchError, throwError, timeout } from 'rxjs'

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly ms = 5000) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(this.ms),
      catchError((err) =>
        err instanceof TimeoutError
          ? throwError(() => new RequestTimeoutException())
          : throwError(() => err)
      )
    )
  }
}
