import { Module } from '@nestjs/common';
import { InvoicePdfService } from './invoice-pdf.service';
import { PdfHeaderBuilder } from './builders/header.builder';
import { PdfInvoiceSummaryBuilder } from './builders/summary.builder';
import { PdfSessionSummaryBuilder } from './builders/session.builder';
import { PdfLocationBuilder } from './builders/location.builder';

@Module({
  providers: [
    InvoicePdfService,
    PdfHeaderBuilder,
    PdfInvoiceSummaryBuilder,
    PdfSessionSummaryBuilder,
    PdfLocationBuilder,
  ],
  exports: [InvoicePdfService],
})
export class InvoicePdfModule {}
