import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BillingService } from './billing.service';
import { PhcBillingProviderService } from './providers/phc-billing-provider.service';
import { BillingController } from './billing.controller';
import { InvoiceModule } from '../invoice/invoice.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
    imports: [HttpModule, 
        InvoiceModule, 
        AuditLogModule
    ],
    controllers: [BillingController],
    providers: [
        BillingService,
        {
            provide: 'BillingProvider',
            useClass: PhcBillingProviderService
        },
    ],
    exports: [BillingService],
})
export class BillingModule { }
