import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceLayoutService } from './invoice-layout.service';
import { InvoiceLayout } from '../entities/invoice-layout.entity';

@Module({
  imports: [TypeOrmModule.forFeature([InvoiceLayout])],
  providers: [InvoiceLayoutService],
  exports: [InvoiceLayoutService],
})
export class InvoiceLayoutModule {}
