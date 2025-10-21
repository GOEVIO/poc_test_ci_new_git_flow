import { Expose, Transform } from 'class-transformer'
import { ResetParameters } from '../enum/reset-parameters'
import { ChargerTypes } from '../enum/chargers'
import { BaseCommandsDto } from "@/v2/chargers/dto/base-commands.dto";

export class ResetDto extends BaseCommandsDto {
    @Expose({ name: 'resetParameters' })
    resetParameter?: ResetParameters
}

export class ResetResponseDto {
    @Expose({ name: 'status' })
    status: string
}

export class ResetRequestDataDto extends BaseCommandsDto {
    @Expose({ name: 'chargerId' })
    @Transform(({ obj }: { obj: BaseCommandsDto }) => obj.hwId)
    chargerId: string
    @Expose({ name: 'chargerType' })
    chargerType: ChargerTypes
    @Expose()
    resetType?: ResetParameters
}
