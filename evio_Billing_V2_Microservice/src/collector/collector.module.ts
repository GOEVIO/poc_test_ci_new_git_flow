import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { InvoiceModule } from '../invoice/invoice.module';
import { CollectorService } from './collector.service';
import { CollectorController } from './collector.controller';
import { ChargingSession, SessionSchema } from './session.schema';
import { ExcelTemplateModule } from '../templates/excel.template.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    InvoiceModule,
    ExcelTemplateModule,
  ],
  controllers: [CollectorController],
  providers: [CollectorService],
  exports: [CollectorService],
})
export class CollectorModule {}