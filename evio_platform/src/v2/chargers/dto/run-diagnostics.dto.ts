import { Expose, Transform } from 'class-transformer';
import { IsDateString, IsOptional, IsString } from 'class-validator';
import { BaseCommandsDto } from '@/v2/chargers/dto/base-commands.dto';

export class RunDiagnosticsDto {
    @Expose()
    @IsString()
    fileLocation!: string;

    @Expose()
    @IsOptional()
    @IsDateString()
    startTime?: string

    @Expose()
    @IsOptional()
    @IsDateString()
    stopTime?: string
}

export class RunDiagnosticsRequestDataDto extends BaseCommandsDto {
    @Expose({name: 'chargerId'})
    @Transform(({obj}: {obj: BaseCommandsDto}) => obj.hwId)
    chargerId!: string

    @Expose({name: 'fileLocation'})
    location!: string

    @Expose()
    @IsOptional()
    @IsDateString()
    startTime: string

    @Expose()
    @IsOptional()
    @IsDateString()
    stopTime: string

    @Expose({name: 'chargerType'})
    chargerType = 'OCPP_DEFAULT'
}

export class RunDiagnosticsResponseDto {
    @Expose()
    status: string

    @Expose()
    timestamp: string
}
