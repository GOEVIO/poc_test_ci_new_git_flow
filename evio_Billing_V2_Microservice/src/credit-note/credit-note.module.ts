import { Module, forwardRef } from '@nestjs/common';
import { CreditNoteService } from '../credit-note/credit-note.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from '../invoice/entities/invoice.entity';
import { CreditNote } from './entities/credit-note.entity';
import { CreditNoteController } from './credit-note.controller';
import { FileReferenceModule } from '../file-reference/file-reference.module';
import { VatStatusModule } from '../vat-status/vat-status.module';
import { TaxExemptionModule } from '../tax-exemption/tax-exemption.module';
import { PaymentConditions } from '../invoice/entities/payment-conditions.entity';
import { BillingModule } from '../billing/billing.module';
import { InvoiceBillingModule } from '../invoice/invoice-billing/invoice-billing.module';
import { InvoiceCommunicationModule } from '../invoice/invoice-communication/invoice-communication.module';
import { InvoiceLayoutModule } from '../invoice/invoice-layout/invoice-layout.module';
import { PhcBillingModule } from '../billing/providers/phc-billing.module';
import { FT } from './entities/FT.entity';
import { FI } from './entities/FI.entity';
import { CustomMailerModule } from '../notification/mailer.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { ExcelTemplateModule } from '../templates/excel.template.module';
import { InvoicePdfModule } from '../templates/pdf/invoice-pdf.module';
import { PdfPayloadBuilderModule } from '../templates/pdf/pdf-payload-builder.module';
import { InvoiceEmailModule } from '../shared/invoice-email.module';
import { SessionInvoiceModule } from '../sessions/services/session-invoice.module';


@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, CreditNote, PaymentConditions]),
    TypeOrmModule.forFeature([FT, FI], 'sqlserver'),
    FileReferenceModule,
    TaxExemptionModule,
    forwardRef(() => PhcBillingModule),
    CustomMailerModule,
    InvoiceCommunicationModule,
    InvoiceModule,
    BillingModule,
    InvoiceBillingModule,
    VatStatusModule,
    InvoiceLayoutModule,
    ExcelTemplateModule,
    PdfPayloadBuilderModule,
    InvoicePdfModule,
    forwardRef(() => InvoiceEmailModule),
    SessionInvoiceModule
  ],
  providers: [CreditNoteService],
  controllers: [CreditNoteController],
  exports: [CreditNoteService],
})
export class CreditNoteModule { }