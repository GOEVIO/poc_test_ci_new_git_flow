import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigType } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import {
    UpdateFirmwareRequestDataDto,
    UpdateFirmwareResponseDto,
} from '../dto/update-firmware.dto';
import { serviceUrl } from '@/config';
import { LogsService } from '@/logs/logs.service';
import {ChargerTypes} from "@/v2/chargers/enum/chargers";
import {AxiosResponse} from "axios";
import { FirmwareStatusService } from './firmware-status-notification.service';

@Injectable()
export class UpdateFirmwareService {
    constructor(
        @Inject(serviceUrl.KEY)
        private readonly serviceUrlConfig: ConfigType<typeof serviceUrl>,
        private readonly logger: LogsService,
        private readonly httpService: HttpService,
        private readonly firmwareStatusService: FirmwareStatusService,
    ) {
        this.logger.setContext(UpdateFirmwareService.name);
    }

    async getStatus(hwId: string): Promise<UpdateFirmwareResponseDto> {
        try {
            const response = await firstValueFrom(
                this.httpService.get(
                    `${this.serviceUrlConfig.ocpp}/api/private/connectionstation/ocppj/firmwareStatusNotification`
                )
            );

            return {
                status: response.data.status,
                timestamp: response.data.timestamp,
            };
        } catch (error: any) {
            this.logger.warn(`Failed to get firmware status from OCPP for ${hwId}. Fallback to Redis. Reason: ${error.message}`);
            const redisData = await this.firmwareStatusService.getStatus(hwId);

            if (!redisData) {
                throw new Error(`Firmware status not found in Redis for charger ${hwId}`);
            }

            return {
                status: redisData.status,
                timestamp: redisData.timestamp,
            };
        }
    }

    async executeUpdateFirmwareCommand({
                                           hwId,
                                           location,
                                           retrieveDate
                                       }: {
        hwId: string;
        location: string,
        retrieveDate?: string
    }): Promise<UpdateFirmwareResponseDto> {

        const sessionCheck = await firstValueFrom(
            this.httpService.get(`${this.serviceUrlConfig.chargers}/api/private/chargingSession/exists/${hwId}`)
        );

        if (sessionCheck.data.exists) {
            throw new BadRequestException('Cannot perform firmware update: Active charging session detected.');
        }

        const finalRetrieveDate = retrieveDate || new Date().toISOString();

        const requestData = plainToInstance(UpdateFirmwareRequestDataDto, {
            chargerId: hwId,
            chargerType: ChargerTypes.OCPP_DEFAULT,
            hwId,
            location,
            retrieveDate: finalRetrieveDate,
        });

        const response: AxiosResponse<UpdateFirmwareResponseDto> = await firstValueFrom(
            this.httpService.post(
                `${this.serviceUrlConfig.ocpp}/api/private/connectionstation/ocppj/updateFirmware`,
                requestData,
            ),
        );

        const responseData = plainToInstance(UpdateFirmwareResponseDto, response.data);
        return responseData;
    }

}
