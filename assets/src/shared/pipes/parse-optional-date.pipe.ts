import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common'

import { safeParseString } from 'evio-library-commons'

@Injectable()
export class ParseOptionalDatePipe implements PipeTransform {
  transform(
    value: string | undefined,
    _metadata: ArgumentMetadata,
  ): Date | undefined {
    if (!value) {
      return undefined
    }
    const dateAttempt = new Date(safeParseString(value))

    if (isNaN(Number(dateAttempt))) {
      throw new BadRequestException(`Unable to parse ${value} to Date`)
    }

    return dateAttempt
  }
}
