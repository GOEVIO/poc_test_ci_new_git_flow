import { Module } from '@nestjs/common'
import { SshHttpModule } from '../ssh/ssh.module'
import { ChargingService } from './charging.service'
import { ChargingController } from './charging.controller'
import { LogsService } from '@/logs/logs.service'
import { EvseModule } from '../evse/evse.module'
import { ReceiverInterceptor } from '@/interceptors/receiver.interceptor'
import { SubscriptionModule } from '../subscription/subscription.module'
import { ChargingNotificationService } from './notification.service'
import { CdrModule } from '../cdr/cdr.module'
import { PlainHttpModule } from '../http/plain-http.module';

@Module({
  imports: [EvseModule, SubscriptionModule, CdrModule, SshHttpModule, PlainHttpModule],
  controllers: [ChargingController],
  providers: [
    ChargingService,
    ChargingNotificationService,
    LogsService,
    ReceiverInterceptor,
  ],
  exports: [ChargingService],
})
export class ChargingModule {}
