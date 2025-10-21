import { Module } from '@nestjs/common';
import { SshHttpModule } from '../ssh/ssh.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { PricingProductService } from './services/pricing-product.service';
import { EvsePricingService } from './services/evse-pricing.service';
import { LogsService } from '@/logs/logs.service';
import { TariffController } from './tariff.controller';

@Module({
  imports: [SshHttpModule, SubscriptionModule],
  controllers: [TariffController],
  providers: [PricingProductService, EvsePricingService, LogsService],
  exports : [PricingProductService]
})
export class TariffModule {}

