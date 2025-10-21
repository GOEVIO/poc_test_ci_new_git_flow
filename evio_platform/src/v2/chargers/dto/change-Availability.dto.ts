import { Expose, Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional } from 'class-validator';
import { AvailabilityParameter } from '../enum/availability-parameters';
import { ChargerTypes } from "@/v2/chargers/enum/chargers";
import { BaseCommandsDto } from "@/v2/chargers/dto/base-commands.dto";

export class ChangeAvailabilityDto extends BaseCommandsDto {
    @Expose()
    @IsOptional()
    @IsNumber()
    connectorId?: number

    @Expose()
    @IsOptional()
    @IsEnum({ enum: AvailabilityParameter, enumName: 'AvailabilityParameters' })
    availability?: AvailabilityParameter
}

export class ChangeAvailabilityRequestDto extends BaseCommandsDto {
    @Expose({ name: 'chargerId' })
    @Transform(({ obj }: { obj: BaseCommandsDto }) => obj.hwId)
    chargerId: string

    @Expose({ name: 'chargerType' })
    chargerType: ChargerTypes

    @Expose()
    @IsNumber()
    plugId: number;

    @Expose()
    @IsEnum(AvailabilityParameter, { message: 'The parameter must be "Operative" or "Inoperative"' })
    availability: AvailabilityParameter;
}

export class ChangeAvailabilityResponseDto {
    @Expose()
    status: string;
}
