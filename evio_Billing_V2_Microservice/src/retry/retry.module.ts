import { forwardRef, Module } from '@nestjs/common';
import { RetryService } from './retry.service';
import { RetryTasksCron } from './retry-tasks.cron';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RetryTask } from './entities/retry-task.entity';
import { ScheduleModule } from '@nestjs/schedule';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { SessionModule } from '../sessions/session.module';
import { RetryController } from './retry.controller';
import { InvoiceModule } from '../invoice/invoice.module';
import { CreditNoteModule } from '../credit-note/credit-note.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([RetryTask]),
        ScheduleModule.forRoot(),
        AuditLogModule,
        forwardRef(() => SessionModule),
        InvoiceModule,
        CreditNoteModule
    ],
    controllers: [RetryController],
    providers: [RetryService, RetryTasksCron],
    exports: [RetryService],
})
export class RetryModule { }
