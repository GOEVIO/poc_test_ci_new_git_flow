import {
  ExceptionFilter,
  Catch,
  HttpException,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common'
import { Request, Response } from 'express'
import * as Sentry from '@sentry/node'
import LoggerService, { LogInfo, LogLevel } from '../services/logger'

@Catch()
export class ErrorFilter implements ExceptionFilter {
  private logger: LoggerService
  constructor(logger: LoggerService) {
    this.logger = logger
  }

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR
    const errorStack =
      status >= 500 && status <= 599 ? { errorStack: exception.stack } : {}

    const logInfo: LogInfo = {
      serviceName: 'evio_apt_microservice',
      time: new Date(),
      actionId: request.headers['action_id'] as string,
      type: LogLevel.error,
      method: request.method,
      url: request.url,
      statusCode: Number(status),
      error: exception.message,
      code: (exception as any).code || 'internal_error',
      ...errorStack,
    }

    // Only send to sentry if internal error
    // This prevents sending 4xx errors to Sentry
    // as they are not considered internal server errors
    if (status >= 500 && status <= 599) {
      Sentry.captureException(exception)
    }

    this.logger.error(logInfo)

    const resBody = {
      success: false,
      message:
        exception?.response?.message ||
        exception.message ||
        'Internal server error',
      code: exception?.response?.code || exception?.code || 'internal_error',
    }

    response.status(status).send(resBody)
  }
}
