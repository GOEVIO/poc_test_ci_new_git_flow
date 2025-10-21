import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  NestInterceptor,
  UnauthorizedException,
} from '@nestjs/common'
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import { UserIdDto } from './invoice.dto';

export class InvoiceExternalAPIInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const userId = request.headers['userid']
    if (!userId) {
      throw new UnauthorizedException('Unauthorized: userId header not found');
    }
    const instance = plainToClass(UserIdDto, { userId });
    const errors = await validate(instance, {
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: true },
    });
    if (errors.length > 0) {
      throw new BadRequestException(
        errors
          .map(err => err.constraints ? Object.values(err.constraints) : [])
          .flat()
      );
    }
    return next.handle();
  }
}