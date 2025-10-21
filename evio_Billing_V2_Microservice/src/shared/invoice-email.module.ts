import { Module, forwardRef } from '@nestjs/common';
import { InvoiceModule } from '../invoice/invoice.module';
import { CustomMailerModule } from '../notification/mailer.module';
import { InvoiceEmailService } from './invoice-email.service';
import { CreditNoteModule } from '../credit-note/credit-note.module';

@Module({
  imports: [
    InvoiceModule,
    forwardRef(() => CreditNoteModule),
    CustomMailerModule
  ],
  providers: [InvoiceEmailService],
  exports: [InvoiceEmailService],
})
export class InvoiceEmailModule { }
