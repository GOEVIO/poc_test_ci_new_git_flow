import { firstValueFrom } from 'rxjs';
import { Inject, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigType } from '@nestjs/config';
import { LogsService } from '@/logs/logs.service';
import { serviceUrl } from '@/config';
import { plainToInstance } from 'class-transformer';
import { AxiosResponse } from 'axios';
import { ChargerTypes } from '../enum/chargers';
import { ClearCacheRequestDto, ClearCacheResponseDto } from '@/v2/chargers/dto/clear-cache.dto';

@Injectable()
export class ClearCacheService {
    constructor(
        @Inject(serviceUrl.KEY)
        private serviceUrlConfig: ConfigType<typeof serviceUrl>,
        private readonly logger: LogsService,
        private readonly httpService: HttpService,
    ) {
        this.logger.setContext(ClearCacheService.name);
    }

    async executeClearCache({
                                hwId,
                            }: {
        hwId: string;
    }): Promise<ClearCacheResponseDto> {
        const requestData = plainToInstance(ClearCacheRequestDto, {
            chargerId: hwId,
            chargerType: ChargerTypes.OCPP_DEFAULT,
            hwId,
        });

        const response: AxiosResponse<ClearCacheResponseDto> = await firstValueFrom(
            this.httpService.post(
                `${this.serviceUrlConfig.ocpp}/api/private/connectionstation/ocppj/clearCache`,
                requestData,
            ),
        );

        const responseData = plainToInstance(ClearCacheResponseDto, response.data);
        return responseData;
    }
}
