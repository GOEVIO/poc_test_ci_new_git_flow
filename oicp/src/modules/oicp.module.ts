import { Module } from '@nestjs/common'
import { EvseModule } from './evse/evse.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { ChargingModule } from './charging/charging.module';
import { TariffModule } from './tariff/tariff.module';
import { CdrModule } from './cdr/cdr.module';

@Module({
  imports: [
    ChargingModule, 
    EvseModule, 
    SubscriptionModule,
    TariffModule,
    CdrModule,
  ],
})
export class OICPModule {}
