import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
  } from '@nestjs/common';
  import { Observable } from 'rxjs';
  import { tap } from 'rxjs/operators';
  import LoggerService, { LogInfo, LogLevel } from '../services/logger';
  import appData from '../../../package.json';
  import { randomUUID } from 'crypto';
  
  @Injectable()
  export class LoggingInterceptor implements NestInterceptor {
    private logger: LoggerService;
    constructor(logger: LoggerService) {
      this.logger = logger;
    }
  
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
      const request = context.switchToHttp().getRequest();
      const response = context.switchToHttp().getResponse();
  
      const actionId = request.headers['action_id'] || randomUUID();
  
      if (!request.headers['action_id']) {
        request.headers['action_id'] = actionId;
      }
  
      const logInfo: LogInfo = {
        message: 'Starting Request',
        serviceName: appData.name,
        time: new Date(),
        actionId,
        type: LogLevel.info,
        method: request.method,
        url: request.url,
      };
  
      this.logger.info(logInfo);
  
      const now = Date.now();
      return next.handle().pipe(
        tap((responseBody) => {
          logInfo.message = 'Request Finished';
          logInfo.duration = `${Date.now() - now} ms`;
          logInfo.responseBody = responseBody;
          logInfo.statusCode = Number(response.statusCode);
          this.logger.info(logInfo);
        })
      );
    }
  }