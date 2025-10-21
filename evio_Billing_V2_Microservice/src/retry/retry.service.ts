import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import { RetryTask } from './entities/retry-task.entity';
import { RetryStatus } from './retry.enums';
import { RETRY_INTERVAL_MINUTES, DEFAULT_MAX_RETRIES } from './retry.constants';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ScheduleRetryInput } from './interfaces/retry.interfaces';
import { SessionService } from '../sessions/session.service';
import { Inject, forwardRef } from '@nestjs/common';
import { setTimeout as delay } from 'timers/promises';
import { InvoiceService } from '../invoice/invoice.service';
import { Session } from '../sessions/interfaces/session.interface';
import { CreditNoteService } from '../credit-note/credit-note.service';

@Injectable()
export class RetryService {
    private readonly logger = new Logger(RetryService.name);

    constructor(
        @InjectRepository(RetryTask)
        private retryRepo: Repository<RetryTask>,
        private auditLogService: AuditLogService,
        @Inject(forwardRef(() => SessionService))
        private readonly sessionService: SessionService,
        private readonly invoiceService: InvoiceService,
        private readonly creditNoteService: CreditNoteService,
    ) { }

    async scheduleRetry({
        relatedObjectType,
        relatedObjectId,
        operation,
        failureReason,
        objectType,
    }: ScheduleRetryInput) {
        try {
            const existing = await this.retryRepo.findOne({
                where: {
                    related_object_id: relatedObjectId,
                    status: In([RetryStatus.Scheduled, RetryStatus.Retrying])
                }
            });
            if (existing) {
                this.logger.warn(`Retry already exists for relatedObjectId: ${relatedObjectId} with status Scheduled or Retrying`);
                return existing;
            }

            const retryTask = this.retryRepo.create({
                related_object_type: relatedObjectType,
                related_object_id: relatedObjectId,
                operation,
                status: RetryStatus.Scheduled,
                failure_reason: failureReason,
                retry_count: 1,
                max_retries_allowed: DEFAULT_MAX_RETRIES,
                next_retry_schedule_at: new Date(Date.now() + RETRY_INTERVAL_MINUTES * 60 * 1000),
            });

            await this.retryRepo.save(retryTask);

            await this.auditLogService.logAction({
                objectType,
                relatedObjectId,
                action: 'retry_triggered',
                oldValue: null,
                newValue: null,
                description: `Retry triggered by system`,
                triggeredBy: 'system',
            });

            return retryTask;
        } catch (error) {
            this.logger.error(`Failed to schedule retry for ${relatedObjectId}: ${error.message}`);
            await this.auditLogService.logAction({
                objectType,
                relatedObjectId,
                action: 'retry_error',
                oldValue: null,
                newValue: null,
                description: `Error scheduling retry: ${error.message}`,
                triggeredBy: 'retry_service'
            });
        }
    }

    async processRetries() {
        this.logger.log(`[processRetries] Checking for due retries`);
        const dueRetries = await this.retryRepo.find({
            where: {
                status: RetryStatus.Scheduled,
                next_retry_schedule_at: LessThanOrEqual(new Date()),
            },
            order: { next_retry_schedule_at: 'ASC' },
        });

        for (const retry of dueRetries) {
            this.logger.log(`[processRetries] Found due retry for ID: ${retry.id}, related object ID: ${retry.related_object_id}`);
            const updateResult = await this.retryRepo.update(
                { id: retry.id, status: RetryStatus.Scheduled },
                { status: RetryStatus.Retrying }
            );
            if (updateResult.affected === 1) {
                await this.executeRetry({ ...retry, status: RetryStatus.Retrying });
                await delay(500);
            }
        }
    }

    private async handleRetryFailure(retryTask: RetryTask, error: any, operationDescription: string) {
        this.logger.error(`Failed to ${operationDescription} for ${retryTask.related_object_id}: ${error.message}`);

        if (retryTask.retry_count < retryTask.max_retries_allowed) {
            retryTask.status = RetryStatus.Failed;
            retryTask.failure_reason = error.message;
            await this.retryRepo.update(retryTask.id, retryTask);

            const { id, ...retryTaskData } = retryTask;
            const newRetryTask = this.retryRepo.create({
                ...retryTaskData,
                status: RetryStatus.Scheduled,
                retry_count: retryTask.retry_count + 1,
                next_retry_schedule_at: new Date(Date.now() + RETRY_INTERVAL_MINUTES * 60 * 1000),
                failure_reason: undefined,
            });
            await this.retryRepo.save(newRetryTask);
        } else {
            retryTask.status = RetryStatus.FailedPermanently;
            retryTask.failure_reason = error.message;
            await this.retryRepo.update(retryTask.id, retryTask);
            this.logger.error(`Max retries reached for ${retryTask.related_object_id}`);
        }
    }

    async executeRetry(retryTask: RetryTask): Promise<void> {
        const context = 'executeRetry';
        this.logger.log(`[${context}] Starting retry for invoice ID: ${retryTask.related_object_id} | retry count: ${retryTask.retry_count} `);
        const { operation, related_object_id } = retryTask;

        switch (operation) {
            case 'generate_attachments':
                try {
                    this.logger.log(`[${context}] Sending email for invoice ID: ${related_object_id}`);
                    await this.sessionService.processSendEmail(related_object_id);
                    this.logger.log(`[${context}] Email sent successfully for invoice ID: ${related_object_id}`);

                    retryTask.status = RetryStatus.Successful;
                    await this.retryRepo.update(retryTask.id, retryTask);
                } catch (error) {
                    this.logger.error(`[${context}] Error occurred while sending email for invoice ID: ${related_object_id} | Error: ${error.message}`);
                    await this.handleRetryFailure(retryTask, error, 'send email');
                }
                break;
            case 'send_invoice_to_phc':
                try {
                    this.logger.log(`[${context}] Sending invoice to PHC for ID: ${related_object_id}`);
                    await this.sessionService.generatePdfFromProvider(related_object_id);
                    retryTask.status = RetryStatus.Successful;
                    this.logger.log(`[${context}] PDF generated successfully for invoice ID: ${related_object_id}`);

                    await this.retryRepo.update(retryTask.id, retryTask);
                } catch (error) {
                    this.logger.error(`[${context}] Error occurred while sending invoice to PHC for ID: ${related_object_id} | Error: ${error.message}`);
                    await this.handleRetryFailure(retryTask, error, 'send invoice to PHC');
                }
                break;
            case 'fetch_invoice_pdf':
                try {
                    this.logger.log(`[${context}] Fetching PDF for invoice ID: ${related_object_id}`);
                    await this.sessionService.processFetchPdfFromProvider(related_object_id);
                    this.logger.log(`[${context}] PDF fetched successfully for invoice ID: ${related_object_id}`);

                    retryTask.status = RetryStatus.Successful;
                    await this.retryRepo.update(retryTask.id, retryTask);
                } catch (error) {
                    this.logger.error(`[${context}] Error occurred while fetching PDF for invoice ID: ${related_object_id} | Error: ${error.message}`);
                    await this.handleRetryFailure(retryTask, error, 'fetch PDF');
                }
                break;
            case 'fetch_credit_note':
                try {
                    this.logger.log(`[${context}] Fetching credit note ID: ${related_object_id}`);
                    await this.creditNoteService.retryFetchCreditNotePdfAndSendEmail(related_object_id);
                    this.logger.log(`[${context}] PDF fetched successfully for credit note ID: ${related_object_id}`);

                    retryTask.status = RetryStatus.Successful;
                    await this.retryRepo.update(retryTask.id, retryTask);
                } catch (error) {
                    this.logger.error(`[${context}] Error occurred while fetching PDF for credit note ID: ${related_object_id} | Error: ${error.message}`);
                    await this.handleRetryFailure(retryTask, error, 'fetch PDF');
                }
                break;
            case 'send_invoice_email':
                try {
                    this.logger.log(`[${context}] Sending email for invoice ID: ${related_object_id}`);
                    await this.sessionService.processSendEmail(related_object_id);
                    retryTask.status = RetryStatus.Successful;
                    await this.retryRepo.update(retryTask.id, retryTask);
                } catch (error) {
                    this.logger.error(`[${context}] Error occurred while sending email for invoice ID: ${related_object_id} | Error: ${error.message}`);
                    await this.handleRetryFailure(retryTask, error, 'send email');
                }
                break;
            case 'send_credit_note_email':
                try {
                    this.logger.log(`[${context}] Sending email for credit note ID: ${related_object_id}`);
                    await this.creditNoteService.sendCreditNoteEmailById(related_object_id);
                    retryTask.status = RetryStatus.Successful;
                    await this.retryRepo.update(retryTask.id, retryTask);
                } catch (error) {
                    this.logger.error(`[${context}] Error occurred while sending email for credit note ID: ${related_object_id} | Error: ${error.message}`);
                    await this.handleRetryFailure(retryTask, error, 'send email');
                }
                break;
            case 'create_invoice':
                try {
                    this.logger.log(`[${context}] Creating invoice for ID: ${related_object_id}`);
                    const invocedCreated = await this.invoiceService.findInvoiceById(related_object_id);
                    if (!invocedCreated) {
                        this.logger.warn(`[${context}] Invoice not found for ID: ${related_object_id}`);
                        return;
                    }
                    const sessions = await this.sessionService.loadSessionsFromInvoice(invocedCreated);
                    if (!invocedCreated?.sessions) {
                        this.logger.warn(`[${context}] Invoice not found for ID: ${related_object_id}`);
                        return;
                    }
                    if (invocedCreated.third_party_id) {
                        this.logger.error(`Third party ID exists for invoice ID: ${related_object_id}`);
                        throw new Error(`Third party ID exists for invoice ID ${related_object_id}`);
                    }
                    await this.sessionService.processAdHocSessions(sessions, invocedCreated);

                    retryTask.status = RetryStatus.Successful;
                    await this.retryRepo.update(retryTask.id, retryTask);
                } catch (error) {
                    this.logger.error(`[${context}] Error occurred while creating invoice for ID: ${related_object_id} | Error: ${error.message}`);
                    await this.handleRetryFailure(retryTask, error, 'create invoice');
                }
                break;
            case 'process_credit_note':
                try {
                    this.logger.log(`[${context}] Processing credit note ID: ${related_object_id}`);
                    await this.creditNoteService.processCreditNote(related_object_id);
                    retryTask.status = RetryStatus.Successful;
                    await this.retryRepo.update(retryTask.id, retryTask);
                } catch (error) {
                    this.logger.error(`[${context}] Error occurred while processing credit note ID: ${related_object_id} | Error: ${error.message}`);
                    await this.handleRetryFailure(retryTask, error, 'process credit note');
                }
                break;
            default:
                this.logger.warn(`[${context}] No handler for operation: ${operation}`);
                break;
        }
    }
}