import { forwardRef, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { InvoiceModule } from '../invoice/invoice.module';
import { SessionService } from './session.service';
import { SessionController } from './session.controller';
import { ExcelTemplateModule } from '../templates/excel.template.module';
import { RetryModule } from '../retry/retry.module';
import { BillingModule } from '../billing/billing.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VatStatus } from '../invoice/entities/vat-status.entity';
import { InvoiceBillingModule } from '../invoice/invoice-billing/invoice-billing.module';
import { InvoiceCommunicationModule } from '../invoice/invoice-communication/invoice-communication.module';
import { InvoicePdfModule } from '../templates/pdf/invoice-pdf.module';
import { PhcBillingModule } from '../billing/providers/phc-billing.module';
import { NotificationModule } from '../notification/notification.module';
import { CustomMailerModule } from '../notification/mailer.module';
import { CollectorModule } from '../collector/collector.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { InvoiceLayoutModule } from '../invoice/invoice-layout/invoice-layout.module';
import { PaymentConditions } from '../invoice/entities/payment-conditions.entity';
import { TaxExemption } from '../invoice/entities/tax-exemptions.entity';
import { PdfPayloadBuilderModule } from '../templates/pdf/pdf-payload-builder.module';
import { InvoiceExecutionModule } from '../invoice/invoice-execution/invoice-execution.module';
import { SessionInvoiceModule } from './services/session-invoice.module';
import { FileReferenceModule } from '../file-reference/file-reference.module';
import { PaymentModule } from '../payments/payment.module';
import { VatStatusModule } from '../vat-status/vat-status.module';
import { TaxExemptionModule } from '../tax-exemption/tax-exemption.module';
import { InvoiceEmailModule } from '../shared/invoice-email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VatStatus]),
    TypeOrmModule.forFeature([PaymentConditions]),
    TypeOrmModule.forFeature([TaxExemption]),
    ScheduleModule.forRoot(),
    InvoiceModule,
    ExcelTemplateModule,
    RetryModule,
    BillingModule,
    InvoiceBillingModule,
    InvoiceCommunicationModule,
    InvoicePdfModule,
    PhcBillingModule,
    NotificationModule,
    CustomMailerModule,
    CollectorModule,
    AuditLogModule,
    InvoicePdfModule,
    InvoiceLayoutModule,
    PdfPayloadBuilderModule,
    InvoiceExecutionModule,
    SessionInvoiceModule,
    FileReferenceModule,
    PaymentModule,
    VatStatusModule,
    TaxExemptionModule,
    forwardRef(() => InvoiceEmailModule)
  ],
  controllers: [SessionController],
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule { }