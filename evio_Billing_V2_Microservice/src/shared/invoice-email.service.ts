import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { InvoiceStatusId } from '../enums/invoice-status.enum';
import { sendMessage } from 'evio-event-producer';
import { InvoiceCommunicationItem } from '../sessions/interfaces/invoice-communication-item.interface';
import { Attachment } from '../sessions/interfaces/attachment.interface';
import Constants from '../utils/constants';
import { InvoiceService } from '../invoice/invoice.service';
import { CustomMailerService } from '../notification/mailer.service';
import { CreditNoteService } from '../credit-note/credit-note.service';

@Injectable()
export class InvoiceEmailService {
    private readonly logger = new Logger(InvoiceEmailService.name);

    constructor(
        private readonly invoiceService: InvoiceService,
        @Inject(forwardRef(() => CreditNoteService))
        private readonly creditNoteService: CreditNoteService,
        private readonly mailService: CustomMailerService
    ) { }

    async sendInvoiceEmails(
        communications: InvoiceCommunicationItem[],
        attachments: Attachment[],
        relatedObjectId: string,
        clientName: string,
        invoiceNumber: string,
        sessionId: string,
        objectType: 'invoice' | 'creditNote' = 'invoice'
    ): Promise<void> {
        try {
            this.logger.log(`Sending invoice email with attachments...`);
            const emails = communications
                .map(com => process.env.EVIOMAIL_DEV ?? com.email)
                .filter(Boolean);

            const firstCom = communications[0];

            await this.sendInvoiceEmailWithAttachment(
                firstCom.name,
                firstCom.language,
                attachments,
                emails,
                clientName,
                invoiceNumber,
                sessionId,
                process.env.EVIOMAIL_CC,
                objectType
            );

            this.logger.log(`✅ Invoice emails sent successfully`);

            // Update either invoice or credit note status
            if (objectType === 'invoice') {
                await this.invoiceService.updateInvoice(
                    { id: relatedObjectId },
                    { status: InvoiceStatusId.EmailSent, email_sent: true, email_send_timestamp: new Date() }
                );
                this.logger.log(`✅ Invoice status updated to EmailSent for invoiceId: ${relatedObjectId}`);
            } else if (objectType === 'creditNote') {
                await this.creditNoteService.updateCreditNote(
                    { status: InvoiceStatusId.EmailSent.toString(), email_sent: true, email_send_timestamp: new Date() },
                    { id: relatedObjectId }
                );
                this.logger.log(`✅ CreditNote status updated to EmailSent for creditNoteId: ${relatedObjectId}`);
            }
        } catch (error) {
            this.logger.error(`Error in the email sending process: ${error.stack}`);
            if (objectType === 'invoice') {
                await this.invoiceService.updateInvoice(
                    { id: relatedObjectId },
                    { status: InvoiceStatusId.EmailError }
                );
                const payload = { relatedObjectId };
                await sendMessage({ method: 'sendEmailProcess', payload }, 'billing_v2_key');
            } else if (objectType === 'creditNote') {
                await this.creditNoteService.updateCreditNote(
                    { status: InvoiceStatusId.EmailError.toString() },
                    { id: relatedObjectId }
                );
                const payload = { creditNoteId: relatedObjectId, error };
                await sendMessage({ method: 'sendEmailCreditNoteProcess', payload }, 'billing_v2_key');
            }
        }
    }

    async sendInvoiceEmailWithAttachment(
        name: string,
        language: string,
        attachments: any,
        email: string | string[],
        clientName: string,
        invoiceNumber: string,
        sessionId: string,
        emailCC?: string,
        objectType: 'invoice' | 'creditNote' = 'invoice'
    ): Promise<void> {
        const context = 'sendInvoiceEmailWithAttachment';
        this.logger.log(`[${context}] Preparing to send invoice email to: ${email}`);
        // Generate the HTML content of the email
        const htmlContent = await this.mailService.prepareEmailHtml(name, language, clientName, objectType);

        let subject = '';
        // Determine the subject of the email based on the country code
        if (objectType === 'creditNote') {
            subject = (language === 'PT' || language === 'PT_PT')
                ? Constants.email.subject.CREDIT_NOTE_PT
                : Constants.email.subject.CREDIT_NOTE_EN;
        } else {
            subject = (language === 'PT' || language === 'PT_PT')
                ? Constants.email.subject.INVOICE_PT
                : Constants.email.subject.INVOICE_EN;
        }

        const invoiceNumberList: string[] = process.env.INVOICE_RETIFICATION_LIST
            ? process.env.INVOICE_RETIFICATION_LIST.split(',').map(id => id.trim()).filter(id => id.length > 0)
            : [];
        this.logger.log(`[${context}] SessionId: ${sessionId}`);
        if (invoiceNumberList.includes(sessionId)) {
            subject = (language === 'PT' || language === 'PT_PT')
                ? `${Constants.email.subject.PT_PREFIX} ${invoiceNumber} - ${Constants.email.subject.INVOICE_PT}`
                : `${Constants.email.subject.EN_PREFIX} ${invoiceNumber} - ${Constants.email.subject.INVOICE_EN}`;
        }
        // Send the email with the Excel attachment
        await this.mailService.sendEmail({
            to: email,
            bcc: emailCC,
            subject,
            html: htmlContent,
            attachments: attachments.map(attachment => ({
                ...attachment,
                filename: attachment.filename.replace(/\//g, '_')
            })),
            clientName: clientName
        });

        this.logger.log(`Email with Excel attachment sent successfully`);
    }

}
