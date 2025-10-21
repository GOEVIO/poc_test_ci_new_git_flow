import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigType } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import { serviceUrl } from '@/config';

import {
    RunDiagnosticsDto,
    RunDiagnosticsRequestDataDto,
    RunDiagnosticsResponseDto,
} from '../dto/run-diagnostics.dto';

import { LogsService } from '@/logs/logs.service';
import { ChargerTypes } from '@/v2/chargers/enum/chargers';
import { AxiosResponse } from 'axios';

@Injectable()
export class RunDiagnosticsService {
    constructor(
        @Inject(serviceUrl.KEY)
        private readonly serviceUrlConfig: ConfigType<typeof serviceUrl>,
        private readonly httpService: HttpService,
        private readonly logger: LogsService,
    ) {
        this.logger.setContext(RunDiagnosticsService.name);
    }

    async executeRunDiagnosticsCommand(hwId: string, data: RunDiagnosticsDto): Promise<RunDiagnosticsResponseDto> {
        const sessionCheck = await firstValueFrom(
            this.httpService.get(`${this.serviceUrlConfig.chargers}/api/private/chargingSession/exists/${hwId}`)
        );

        if (sessionCheck.data.exists) {
            throw new BadRequestException('Cannot perform diagnostics: Active charging session detected.');
        }

        const requestData = plainToInstance(RunDiagnosticsRequestDataDto, {
            chargerId: hwId,
            hwId,
            location: data.fileLocation,
            startTime: data.startTime,
            stopTime: data.stopTime,
            chargerType: ChargerTypes.OCPP_DEFAULT,
        });

        try {
            const response: AxiosResponse<any> = await firstValueFrom(
                this.httpService.post(
                    `${this.serviceUrlConfig.ocpp}/api/private/connectionstation/ocppj/getDiagnostics`,
                    requestData,
                )
            );

            const { status, message, fileName, fullPath } = response.data;

            if (status === 'failed') {
                if (message?.toLowerCase().includes('not supported')) {
                    throw new BadRequestException('Get Diagnostics not supported by this charging station.');
                }
                throw new Error('Diagnostics command was rejected by the charging station.');
            }

            return {
                status: 'accepted',
                timestamp: new Date().toISOString(),
                ...(fileName && { fileName }),
                ...(fullPath && { fullPath })
            };

        } catch (error: any) {
            this.logger.error('Error executing run diagnostics:', error.message);
            throw new Error(error.message || 'Unexpected error running diagnostics');
        }
    }
}
