import { Expose, Transform } from 'class-transformer';
import { IsNumber, IsOptional } from 'class-validator';
import { ChargerTypes } from "@/v2/chargers/enum/chargers";
import { BaseCommandsDto } from "@/v2/chargers/dto/base-commands.dto";

export class UnlockConnectorDto extends BaseCommandsDto {
    @Expose()
    @IsOptional()
    @IsNumber()
    connectorId?: number
}

export class UnlockConnectorRequestDto extends BaseCommandsDto {
    @Expose({ name: 'chargerId' })
    @Transform(({ obj }: { obj: BaseCommandsDto }) => obj.hwId)
    chargerId: string

    @Expose({ name: 'chargerType' })
    chargerType: ChargerTypes

    @Expose()
    @IsNumber()
    plugId: number;
}

export class UnlockConnectorResponseDto {
    @Expose()
    status: string;
}
