import {firstValueFrom} from 'rxjs'
import {BadRequestException, InternalServerErrorException, Inject, Injectable} from '@nestjs/common'
import {HttpService} from '@nestjs/axios'
import {ConfigType} from '@nestjs/config'
import {LogsService} from '@/logs/logs.service'
import {serviceUrl} from '@/config'
import { plainToInstance } from 'class-transformer'
import { AxiosResponse } from 'axios';
import {ChargerTypes} from '../enum/chargers'
import {
    UnlockConnectorDto, UnlockConnectorRequestDto,
    UnlockConnectorResponseDto
} from "@/v2/chargers/dto/unlock-connector.dto";

@Injectable()
export class UnlockConnectorService {
    constructor(
        @Inject(serviceUrl.KEY)
        private serviceUrlConfig: ConfigType<typeof serviceUrl>,
        private readonly logger: LogsService,
        private readonly httpService: HttpService,
    ) {
        this.logger.setContext(UnlockConnectorService.name)
    }

    async executeUnlockCommand({
                                   hwId,
                                   connectorId,
                               }: UnlockConnectorDto): Promise<UnlockConnectorResponseDto> {

        const requestData = plainToInstance(UnlockConnectorRequestDto, {
            chargerId: hwId,
            chargerType: ChargerTypes.OCPP_DEFAULT,
            hwId,
            plugId: connectorId,
        });

        const response: AxiosResponse<UnlockConnectorResponseDto> = await firstValueFrom(
            this.httpService.post(
                `${this.serviceUrlConfig.ocpp}/api/private/connectionstation/ocppj/unlockConnector`,
                requestData,
            ),
        );

        const responseData = plainToInstance(UnlockConnectorResponseDto, response.data)
        return responseData
    }
}
