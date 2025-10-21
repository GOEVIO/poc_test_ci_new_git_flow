import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceExecution } from '../entities/invoice-execution.entity';
import { InvoiceExecutionService } from './invoice-execution.service';

@Module({
  imports: [TypeOrmModule.forFeature([InvoiceExecution])],
  providers: [InvoiceExecutionService],
  exports: [InvoiceExecutionService],
})
export class InvoiceExecutionModule {}