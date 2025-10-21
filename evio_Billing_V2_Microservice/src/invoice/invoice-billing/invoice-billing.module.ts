import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceBilling } from '../entities/invoice-billing.entity';
import { InvoiceBillingService } from './invoice-billing.service';

@Module({
  imports: [TypeOrmModule.forFeature([InvoiceBilling])],
  providers: [InvoiceBillingService],
  exports: [InvoiceBillingService],
})
export class InvoiceBillingModule {}
