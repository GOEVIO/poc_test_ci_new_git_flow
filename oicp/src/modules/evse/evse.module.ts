import { Module } from '@nestjs/common';
import { EvseService } from './evse.service';
import { EvseController } from './evse.controller';
import { LogsService } from '@/logs/logs.service';
import { SshHttpModule } from '../ssh/ssh.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { TariffModule } from '../tariff/tariff.module';


@Module({
  imports: [SshHttpModule, SubscriptionModule, TariffModule],
  controllers: [EvseController],
  providers: [EvseService, LogsService],
  exports: [EvseService, SubscriptionModule],
})
export class EvseModule {}
