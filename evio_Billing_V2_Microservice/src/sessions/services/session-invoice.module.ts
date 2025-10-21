import { Module } from '@nestjs/common';
import { SessionInvoiceService } from './session-invoice.service';

@Module({
  providers: [SessionInvoiceService],
  exports: [SessionInvoiceService],
})
export class SessionInvoiceModule {}