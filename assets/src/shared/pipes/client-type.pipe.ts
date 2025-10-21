import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common'

import { equals, safeParseString } from 'evio-library-commons'
import { ClientTypeType } from '../types/client-type.type'

@Injectable()
export class ParseClientTypePipe implements PipeTransform {
  transform(
    clientType: string | undefined,
    _metadata: ArgumentMetadata,
  ): ClientTypeType | undefined {
    const parsedClientType = safeParseString(clientType)

    if (!parsedClientType) {
      return
    }

    if (!['B2B', 'B2C'].some(equals(parsedClientType))) {
      throw new BadRequestException(`clientType must be B2B or B2C`)
    }

    return parsedClientType as ClientTypeType
  }
}
