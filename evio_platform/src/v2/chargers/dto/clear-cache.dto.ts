import { Expose, Transform } from 'class-transformer';
import { ChargerTypes } from "@/v2/chargers/enum/chargers";
import { BaseCommandsDto } from "@/v2/chargers/dto/base-commands.dto";

export class ClearCacheRequestDto extends BaseCommandsDto {
    @Expose({ name: 'chargerId' })
    @Transform(({ obj }: { obj: BaseCommandsDto }) => obj.hwId)
    chargerId: string

    @Expose({ name: 'chargerType' })
    chargerType: ChargerTypes
}

export class ClearCacheResponseDto {
    @Expose()
    status: string;
}
