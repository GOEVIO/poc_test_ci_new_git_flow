import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ChargersController } from './chargers.controller';
import { ResetService } from './services/reset.service';
import { LogsService } from '@/logs/logs.service';
import { ChangeAvailabilityService } from './services/charger-availability.service';
import { UnlockConnectorService } from './services/unlock-connector.service';
import { ClearCacheService } from './services/clear-cache.service';
import { ChangeAvailabilityChargerService } from './services/change-availability-charger.service';
import { UpdateFirmwareService } from './services/update-firmware.service';
import { FirmwareStatusService } from './services/firmware-status-notification.service';
import { DiagnosticStatusService} from "@/v2/chargers/services/diagnostic-status.service";
import { RunDiagnosticsService} from "@/v2/chargers/services/run-diagnostics.service";
import { RedisService } from './shared/redis.service';

@Module({
  imports: [
    HttpModule.registerAsync({
      useFactory: () => ({
        timeout: 5000,
        maxRedirects: 5,
      }),
    }),
  ],
  controllers: [ChargersController],
  providers: [
    ResetService,
    ChangeAvailabilityService,
    UnlockConnectorService,
    ClearCacheService,
    ChangeAvailabilityChargerService,
    UpdateFirmwareService,
    FirmwareStatusService,
    DiagnosticStatusService,
    RunDiagnosticsService,
    RedisService,
    LogsService,
  ],
})
export class ChargersModule {}
