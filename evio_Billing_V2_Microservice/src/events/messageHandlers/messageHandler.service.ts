import { Injectable, Logger } from '@nestjs/common';
import { SessionService } from '../../sessions/session.service';
import { RetryService } from '../../retry/retry.service';
import { RetryOperation } from '../../retry/retry.enums';
import { CreditNoteService } from '../../credit-note/credit-note.service';

interface Payload {
  [key: string]: any;
}

@Injectable()
export class MessageHandlerService {
  private readonly logger = new Logger(MessageHandlerService.name);

  constructor(
    private readonly sessionService: SessionService,
    private readonly retryService: RetryService,
    private readonly creditNoteService: CreditNoteService
  ) { }

  invoiceAdHoc(payload: Payload): void {
    const { sessionId, cdrId } = payload;
    if (!sessionId) {
      this.logger.warn('Missing sessionId in payload');
      throw new Error('Missing sessionId in payload');
    }
    this.sessionService.handleAdHocSession(sessionId, cdrId);
    this.logger.log('✅ Ad-hoc session processed internally via service call');
  }

  invoiceAdHocOCPP(payload: Payload): void {
    const { sessionId } = payload;
    if (!sessionId) {
      this.logger.warn('Missing sessionId in payload');
      throw new Error('Missing sessionId in payload');
    }
    this.sessionService.handleAdHocSession(sessionId);
    this.logger.log('✅ Ad-hoc session processed internally via service call');
  }

  async fetchEmailProcess(payload: Payload): Promise<void> {
    const { invoiceId } = payload;
    this.logger.log(`Processing email for invoice ${invoiceId}`);
    await this.retryService.scheduleRetry({
      relatedObjectType: 'invoice',
      relatedObjectId: invoiceId,
      operation: RetryOperation.FetchPDF,
      failureReason: 'The PDF file is not available from the provider.',
      objectType: 'invoice',
    });
    this.logger.log(`✅ Email ${invoiceId} has been put into retry process`);
  }

  async sendInvoiceToProviderProcess(payload: Payload): Promise<void> {
    const { invoiceId } = payload;
    this.logger.log(`Processing sending invoice to provider for invoice ${invoiceId}`);
    try {
      await this.retryService.scheduleRetry({
        relatedObjectType: 'invoice',
        relatedObjectId: invoiceId,
        operation: RetryOperation.SendToPHC,
        failureReason: 'The invoice could not be sent to the provider.',
        objectType: 'invoice',
      });
      this.logger.log(`✅ Invoice ${invoiceId} has been put into retry process for sending to provider`);
    } catch (error) {
      this.logger.error(`Failed to process sending invoice to provider for invoice ${invoiceId}: ${error}`);
      throw error;
    }
  }

  async sendEmailProcess(payload: Payload): Promise<void> {
    const { invoiceId } = payload;
    this.logger.log(`Processing email for invoice ${invoiceId}`);
    try {
      await this.retryService.scheduleRetry({
        relatedObjectType: 'invoice',
        relatedObjectId: invoiceId,
        operation: RetryOperation.SendEmail,
        failureReason: 'The email could not be sent.',
        objectType: 'invoice',
      });
      this.logger.log(`✅ Email for invoice ${invoiceId} has been put into retry process`);
    } catch (error) {
      this.logger.error(`Failed to process email for invoice ${invoiceId}: ${error}`);
      throw error;
    }
  }

  async attachmentsProcess(payload: Payload): Promise<void> {
    const { invoiceId } = payload;
    this.logger.log(`Processing attachments for invoice ${invoiceId}`);
    try {
      await this.retryService.scheduleRetry({
        relatedObjectType: 'invoice',
        relatedObjectId: invoiceId,
        operation: RetryOperation.GenerateAttachments,
        failureReason: 'The attachments could not be generated.',
        objectType: 'invoice',
      });
      this.logger.log(`✅ Attachments for invoice ${invoiceId} have been put into retry process`);
    } catch (error) {
      this.logger.error(`Failed to process attachments for invoice ${invoiceId}: ${error}`);
      throw error;
    }
  }

  //Credit Notes 
  async processCreditNote(payload: any): Promise<void> {
    this.logger.log(`Processing credit note: ${JSON.stringify(payload)}`);
    this.creditNoteService.processCreditNote(payload.creditNoteId);
    this.logger.log(`✅ Credit note ${payload.creditNoteId} has been processed`);
  }

  async creditNotePdfProcess(payload: Payload): Promise<void> {
    const { creditNoteId, error } = payload;
    this.logger.log(`Processing email for credit note ${creditNoteId}`);
    await this.retryService.scheduleRetry({
      relatedObjectType: 'creditNote',
      relatedObjectId: creditNoteId,
      operation: RetryOperation.ProcessCreditNote,
      failureReason: error?.message || 'The PDF file is not available from the provider.',
      objectType: 'creditNote',
    });
    this.logger.log(`✅ Fetch Credit Note Pdf: ${creditNoteId} has been put into retry process`);
  }

  async fetchCreditNotePDF(payload: Payload): Promise<void> {
    const { creditNoteId, error } = payload;
    this.logger.log(`Fetching PDF for credit note ${creditNoteId}`);
    await this.retryService.scheduleRetry({
      relatedObjectType: 'creditNote',
      relatedObjectId: creditNoteId,
      operation: RetryOperation.FetchCreditoNotePDF,
      failureReason: error?.message || 'The PDF file is not available from the provider.',
      objectType: 'creditNote',
    });
    this.logger.log(`✅ Fetch Credit Note Pdf: ${creditNoteId} has been put into retry process`);
  }

  async sendEmailCreditNoteProcess(payload: Payload): Promise<void> {
    const { creditNoteId, error } = payload;
    this.logger.log(`Processing email for credit note ${creditNoteId}`);
    try {
      await this.retryService.scheduleRetry({
        relatedObjectType: 'creditNote',
        relatedObjectId: creditNoteId,
        operation: RetryOperation.SendEmailCreditNote,
        failureReason: error.message || 'The email could not be sent.',
        objectType: 'creditNote',
      });
      this.logger.log(`✅ Email for credit note ${creditNoteId} has been put into retry process`);
    } catch (error) {
      this.logger.error(`Failed to process email for credit note ${creditNoteId}: ${error}`);
      throw error;
    }
  }
}
