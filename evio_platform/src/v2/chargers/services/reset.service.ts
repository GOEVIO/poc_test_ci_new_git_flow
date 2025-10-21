import { firstValueFrom } from 'rxjs'
import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { ConfigType } from '@nestjs/config'
import {
    ResetDto,
    ResetRequestDataDto,
    ResetResponseDto,
} from '../dto/reset.dto'
import { LogsService } from '@/logs/logs.service'
import { serviceUrl } from '../../../config'
import { AxiosResponse } from 'axios'
import { plainToInstance } from 'class-transformer'
import { ChargerTypes } from '../enum/chargers'
import { reset } from '../commands/reset'

@Injectable()
export class ResetService {
    constructor(
        @Inject(serviceUrl.KEY)
        private serviceUrlConfig: ConfigType<typeof serviceUrl>,
        private readonly logger: LogsService,
        private readonly httpService: HttpService,
    ) {
        this.logger.setContext(ResetService.name)
    }

    async executeCommand({
                             hwId,
                             resetParameter,
                         }: ResetDto): Promise<ResetResponseDto> {
        try {

            const requestData = plainToInstance(ResetRequestDataDto, {
                chargerId: hwId,
                chargerType: ChargerTypes.OCPP_DEFAULT,
                hwId,
                resetType: reset(resetParameter),
            });

            const response = await firstValueFrom<AxiosResponse<ResetResponseDto>>(
                this.httpService.post(
                    `${this.serviceUrlConfig.ocpp}/api/private/connectionstation/ocppj/reset`,
                    requestData,
                ),
            )

            const responseData = plainToInstance(ResetResponseDto, response.data)
            return responseData
        } catch (error: any) {
            this.logger.error(error?.response?.data ?? error)
            throw new BadRequestException(error?.response?.data ?? error)
        }
    }
}
