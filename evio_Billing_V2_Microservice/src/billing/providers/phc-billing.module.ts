import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PhcBillingProviderService } from './phc-billing-provider.service';
import { InvoiceModule } from '../../invoice/invoice.module';
import { AuditLogModule } from '../../audit-log/audit-log.module';

@Module({
    imports: [
        HttpModule,
        InvoiceModule,
        AuditLogModule
    ],
    providers: [
        PhcBillingProviderService,
    ],
    exports: [PhcBillingProviderService],
})
export class PhcBillingModule { }
