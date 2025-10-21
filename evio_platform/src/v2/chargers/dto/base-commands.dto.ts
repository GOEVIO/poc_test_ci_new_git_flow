import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

export class BaseCommandsDto {
    @Expose({ name: 'hwId' })
    @IsString()
    hwId!: string;
}
