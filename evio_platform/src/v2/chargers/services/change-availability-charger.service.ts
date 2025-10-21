import {
    Injectable,
    BadRequestException,
    InternalServerErrorException,
    Inject
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigType } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import { ChangeAvailabilityResponseDto } from '../dto/change-Availability.dto';
import { CommandsResponse } from '../enum/commands';
import { AvailabilityParameter } from '../enum/availability-parameters';
import { serviceUrl } from '@/config';
import { LogsService } from '@/logs/logs.service';

@Injectable()
export class ChangeAvailabilityChargerService {
    constructor(
        @Inject(serviceUrl.KEY)
        private serviceUrlConfig: ConfigType<typeof serviceUrl>,
        private readonly logger: LogsService,
        private readonly httpService: HttpService,
    ) {
        this.logger.setContext(ChangeAvailabilityChargerService.name);
    }

    async executeChargerAvailabilityCommand(
        hwId: string,
        availability: AvailabilityParameter,
    ): Promise<ChangeAvailabilityResponseDto> {
        const requestData = {
            chargerId: hwId,
            chargerType: 'OCPP_DEFAULT',
            hwId,
            plugId: 0,
            availability,
        };

        try {
            const response = await firstValueFrom(
                this.httpService.post(
                    `${this.serviceUrlConfig.ocpp}/api/private/connectionstation/ocppj/changeAvailability`,
                    requestData,
                ),
            );

            const status = response.data?.status as CommandsResponse;

            switch (status) {
                case CommandsResponse.ACCEPTED:
                case CommandsResponse.SCHEDULED:
                    return { status };
                case CommandsResponse.REJECTED:
                    this.logger.warn(`ConnectorId 0 rejected the command. Applying fallback.`);
                    return await this.applyFallbackPerPlug(hwId, availability);
                default:
                    throw new InternalServerErrorException(`Unexpected response status: ${status}`);
            }

        } catch (error: any) {
            const safeMessage = error instanceof Error ? error.message : JSON.stringify(error);
            this.logger.warn(`Command on plug 0 failed. Error: ${safeMessage}`);

            if (!(error instanceof BadRequestException)) {
                return await this.applyFallbackPerPlug(hwId, availability);
            }

            throw error;
        }
    }

    private async applyFallbackPerPlug(hwId: string, availability: AvailabilityParameter): Promise<ChangeAvailabilityResponseDto> {
        this.logger.warn(`Fallback: Sending ChangeAvailability to each plug...`);

        const result = await this.sendChangeAvailabilityPerPlug(hwId, availability);

        if (result.total === 0) {
            this.logger.warn(`No plugs found for charger ${hwId}.`);
            return { status: 'FALLBACK_FAILED' };
        }

        if (result.successCount === 0) {
            this.logger.warn(`Fallback failed: no plug accepted the command.`);
            return { status: 'FALLBACK_FAILED' };
        }

        if (result.successCount === result.total) {
            this.logger.log(`Fallback succeeded: all plugs accepted the command.`);
            return { status: 'ACCEPTED' };
        }

        this.logger.warn(`Partial fallback: ${result.successCount} out of ${result.total} plugs accepted the command.`);
        return { status: 'PARTIALLY_ACCEPTED' };
    }

    private async sendChangeAvailabilityPerPlug(
        hwId: string,
        availability: AvailabilityParameter
    ): Promise<{ successCount: number; total: number }> {
        const plugStatuses = await this.fetchPlugStatuses(hwId);
        let successCount = 0;

        await Promise.all(plugStatuses.map(async (plug) => {
            try {
                const response = await firstValueFrom(
                    this.httpService.post(
                        `${this.serviceUrlConfig.ocpp}/api/private/connectionstation/ocppj/changeAvailability`,
                        {
                            chargerId: hwId,
                            chargerType: 'OCPP_DEFAULT',
                            hwId,
                            plugId: plug.plugId,
                            availability,
                        },
                    )
                );

                const status = response.data?.status;
                if (status === CommandsResponse.ACCEPTED || status === CommandsResponse.SCHEDULED) {
                    this.logger.log(`Plug ${plug.plugId} accepted the command.`);
                    successCount++;
                } else {
                    this.logger.warn(`Plug ${plug.plugId} responded with status: ${status}`);
                }

            } catch (err: any) {
                const message = err instanceof Error ? err.message : JSON.stringify(err);
                this.logger.warn(`Fallback OCPP for plug ${plug.plugId} failed: ${message}`);
            }
        }));

        return {
            successCount,
            total: plugStatuses.length,
        };
    }

    private async fetchPlugStatuses(hwId: string): Promise<{ plugId: number; status: string }[]> {
        const response = await firstValueFrom(
            this.httpService.get(
                `${this.serviceUrlConfig.chargers}/api/private/chargers/${hwId}/plugs/status`
            )
        );

        return response.data?.plugStatuses ?? [];
    }
}
