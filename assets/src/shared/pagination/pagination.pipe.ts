import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common'
import { z } from 'zod'

const PositiveIntegerSchema = z.coerce.number().int().positive()

@Injectable()
export class PageNumberPipe implements PipeTransform {
  transform(value: string | undefined, _metadata: ArgumentMetadata): number {
    try {
      return PositiveIntegerSchema.default(1).parse(value)
    } catch (_e) {
      throw new BadRequestException(
        'pageNumber must be a positive integer or undefined',
      )
    }
  }
}

@Injectable()
export class PageSizePipe implements PipeTransform {
  transform(value: string | undefined, _metadata: ArgumentMetadata): number {
    try {
      return PositiveIntegerSchema.default(10).parse(value)
    } catch (_e) {
      throw new BadRequestException(
        'pageSize must be a positive integer or undefined',
      )
    }
  }
}
