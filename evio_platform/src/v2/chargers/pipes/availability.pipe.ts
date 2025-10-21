import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common'
import { AvailabilityParameter } from '../enum/availability-parameters'

@Injectable()
export class AvailabilityPipe implements PipeTransform {
  transform(
      availability: string | undefined,
      _metadata: ArgumentMetadata,
  ): AvailabilityParameter | undefined {
    if (!['Operative', 'Inoperative'].some((ap) => availability === ap)) {
      throw new BadRequestException(
          `${availability} is not a valid availability, must be 'Operative' or 'Inoperative'`,
      )
    }

    return availability as AvailabilityParameter
  }
}
