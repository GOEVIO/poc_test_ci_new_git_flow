import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceCommunication } from '../entities/invoice-communication.entity';
import { InvoiceCommunicationService } from './invoice-communication.service';

@Module({
  imports: [TypeOrmModule.forFeature([InvoiceCommunication])],
  providers: [InvoiceCommunicationService],
  exports: [InvoiceCommunicationService],
})
export class InvoiceCommunicationModule {}
