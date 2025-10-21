import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExcelTemplateService } from './excel.template.service';
import { ExcelTemplateController } from './excel.template.controller';
import { ExcelTemplate } from '../invoice/entities/excel-template.entity';
import { FileReferenceModule } from '../file-reference/file-reference.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { InvoicePdfModule } from './pdf/invoice-pdf.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExcelTemplate]),
    FileReferenceModule,
    AuditLogModule,
    InvoicePdfModule
  ],
  controllers: [ExcelTemplateController],
  providers: [ExcelTemplateService],
  exports: [ExcelTemplateService],
})
export class ExcelTemplateModule { }