import { firstValueFrom } from 'rxjs'
import { BadRequestException, InternalServerErrorException, Inject, Injectable } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { ConfigType } from '@nestjs/config'
import {
    ChangeAvailabilityDto,
    ChangeAvailabilityRequestDto,
    ChangeAvailabilityResponseDto,
} from '../dto/change-Availability.dto'
import { LogsService } from '@/logs/logs.service'
import { serviceUrl } from '@/config'
import { plainToInstance } from 'class-transformer'
import { AxiosResponse } from 'axios';
import { CommandsResponse } from '../enum/commands'
import { ChargerTypes } from '../enum/chargers'
import { changeAvailability } from '../commands/change-availability'

@Injectable()
export class ChangeAvailabilityService {
    constructor(
        @Inject(serviceUrl.KEY)
        private serviceUrlConfig: ConfigType<typeof serviceUrl>,
        private readonly logger: LogsService,
        private readonly httpService: HttpService,
    ) {
        this.logger.setContext(ChangeAvailabilityService.name)
    }

    async executeAvailabilityCommand({
                                         hwId,
                                         connectorId,
                                         availability,
                                     }: ChangeAvailabilityDto): Promise<ChangeAvailabilityResponseDto> {

        const requestData = plainToInstance(ChangeAvailabilityRequestDto, {
            chargerId: hwId,
            chargerType: ChargerTypes.OCPP_DEFAULT,
            hwId,
            plugId: connectorId,
            availability: changeAvailability(availability),
        });

        const response: AxiosResponse<ChangeAvailabilityResponseDto> = await firstValueFrom(
            this.httpService.post(
                `${this.serviceUrlConfig.ocpp}/api/private/connectionstation/ocppj/changeAvailability`,
                requestData,
            ),
        );

        const remoteStatus = response.data?.status as CommandsResponse

        switch (remoteStatus) {
            case CommandsResponse.ACCEPTED:
                return { status: CommandsResponse.ACCEPTED }

            case CommandsResponse.SCHEDULED:
                return { status: CommandsResponse.SCHEDULED }

            case CommandsResponse.REJECTED:
                throw new BadRequestException('Command Rejected by charging station')

            default:
                throw new InternalServerErrorException(
                    `Unexpected status from charging station: ${remoteStatus}`,
                )
        }
    }
}
