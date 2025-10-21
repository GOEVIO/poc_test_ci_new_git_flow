import {
    ArgumentMetadata,
    BadRequestException,
    Injectable,
    PipeTransform,
} from '@nestjs/common'
import { ResetParameters } from '../enum/reset-parameters'

@Injectable()
export class ResetPipe implements PipeTransform {
    transform(
        reset: string | undefined,
        _metadata: ArgumentMetadata,
    ): ResetParameters | undefined {
        if (!['Soft', 'Hard'].some((ap) => reset === ap)) {
            throw new BadRequestException(
                `${reset} is not a valid type, must be 'Soft' or 'Hard'`,
            )
        }

        return reset as ResetParameters
    }
}
