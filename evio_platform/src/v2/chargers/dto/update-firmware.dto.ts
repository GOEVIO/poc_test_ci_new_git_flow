import { Expose, Transform } from 'class-transformer';
import {IsDateString, IsOptional, IsString} from 'class-validator';
import { BaseCommandsDto } from '@/v2/chargers/dto/base-commands.dto';

export class UpdateFirmwareDto {
    @Expose({ name: 'location' })
    @IsString()
    location!: string;

    @Expose({ name: 'retrieveDate' })
    @IsOptional() //If don´t sent, is defined with Date.now()
    @IsDateString()
    retrieveDate!: string;
}

export class UpdateFirmwareResponseDto {
    @Expose()
    status: string;

    @Expose()
    timestamp: string;
}

export class UpdateFirmwareRequestDataDto extends BaseCommandsDto {
    @Expose({ name: 'chargerId' })
    @Transform(({ obj }: { obj: BaseCommandsDto }) => obj.hwId)
    chargerId!: string;

    @Expose({ name: 'location' })
    location!: string;

    @Expose({ name: 'retrieveDate' })
    retrieveDate!: string;

    @Expose({ name: 'chargerType' })
    chargerType = 'OCPP_DEFAULT';
}
