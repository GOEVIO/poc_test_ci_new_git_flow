import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaxExemptionService } from './tax-exemption.service';
import { TaxExemption } from '../invoice/entities/tax-exemptions.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TaxExemption])],
  providers: [TaxExemptionService],
  exports: [TaxExemptionService],
})
export class TaxExemptionModule {}