import { Injectable, NotFoundException, Logger, BadRequestException, InternalServerErrorException, ConflictException, UnprocessableEntityException, Inject, forwardRef } from '@nestjs/common';
import { CreditNote } from './entities/credit-note.entity';
import { CreateCreditNoteRequestDto } from './dto/create-credit-note-request.dto';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { FT } from './entities/FT.entity';
import { Repository, In, DataSource } from 'typeorm';
import { Invoice } from '../invoice/entities/invoice.entity';
import { FileReferenceService } from '../file-reference/file-reference.service';
import { buildS3FileName, downloadFileFromS3, uploadFileToS3 } from '../utils/aws-s3.util';
import { Session } from '../sessions/interfaces/session.interface';
import { BillingService } from '../billing/billing.service';
import { InvoiceBillingService } from '../invoice/invoice-billing/invoice-billing.service';
import { VatStatusService } from '../vat-status/vat-status.service';
import { InvoiceLayoutService } from '../invoice/invoice-layout/invoice-layout.service';
import { InvoiceCommunicationService } from '../invoice/invoice-communication/invoice-communication.service';
import { PaymentConditions } from '../invoice/entities/payment-conditions.entity';
import { InvoiceBilling } from '../invoice/entities/invoice-billing.entity';
import { IClientAddressFields } from '../invoice/interfaces/client-address-fields.interface';
import { BuildCreditNotePayloadParams } from '../sessions/types/build-credit-note-payload-params.type';
import { InvoiceStatusId } from '../enums/invoice-status.enum';
import { FI } from './entities/FI.entity';
import { CreditNoteRepository } from './repositories/credit-note.repository';
import { sendMessage } from 'evio-event-producer';
import { FilePurpose } from '../enums/file-purpose.enum';
import { CustomMailerService } from '../notification/mailer.service';
import { InvoiceService } from '../invoice/invoice.service';
import { getLatestSessionDate } from '../sessions/helpers/filter-sessions';
import { getServiceDescription } from '../sessions/helpers/sevice-description';
import { InvoiceCommunicationItem } from '../sessions/interfaces/invoice-communication-item.interface';
import { Attachment } from '../sessions/interfaces/attachment.interface';
import { ExcelTemplateService } from '../templates/excel.template.service';
import { PdfPayloadBuilderService } from '../templates/pdf/pdf-payload-builder.service';
import { InvoicePdfService } from '../templates/pdf/invoice-pdf.service';
import { InvoiceEmailService } from '../shared/invoice-email.service';
import { SessionInvoiceService } from '../sessions/services/session-invoice.service';
import {
    ChargingSessionReadRepository as OcpiSessionRepository,
} from 'evio-library-ocpi';
import ChargerLibrary from 'evio-library-chargers';
import { InvoiceLayoutType } from '../invoice/invoice-layout/enum/invoice-layout-type.enum';

@Injectable()
export class CreditNoteService {
    private readonly logger = new Logger(CreditNoteService.name);
    private creditNoteRepositoryCustom;

    constructor(
        @InjectRepository(PaymentConditions) private paymentConditionsRepository: Repository<PaymentConditions>,
        @InjectRepository(CreditNote)
        private creditNoteRepository: Repository<CreditNote>,
        @InjectRepository(Invoice)
        private invoiceRepository: Repository<Invoice>,
        private readonly fileReferenceService: FileReferenceService,
        @InjectRepository(FT, 'sqlserver')
        private readonly ftRepository: Repository<FT>,
        @InjectRepository(FI, 'sqlserver')
        private readonly fiRepository: Repository<FI>,
        @InjectDataSource() private readonly dataSource: DataSource,
        private readonly mailService: CustomMailerService,
        private readonly invoiceCommunicationService: InvoiceCommunicationService,
        private readonly invoiceService: InvoiceService,
        private readonly billingService: BillingService,
        private readonly invoiceBillingService: InvoiceBillingService,
        private readonly vatStatusService: VatStatusService,
        private readonly invoiceLayoutService: InvoiceLayoutService,
        private readonly excelTemplateService: ExcelTemplateService,
        private readonly pdfPayloadBuilderService: PdfPayloadBuilderService,
        private readonly invoicePdfService: InvoicePdfService,
        @Inject(forwardRef(() => InvoiceEmailService))
        private readonly invoiceEmailService: InvoiceEmailService,
        private readonly sessionInvoiceService: SessionInvoiceService,
    ) {
        this.creditNoteRepositoryCustom = CreditNoteRepository(this.dataSource);
    }

    /**
     * Creates a credit note for the specified invoice and sessions.
     * @param data - The data required to create the credit note.
     * @return The created credit note.
     * @throws NotFoundException if the invoice or sessions are not found.
     * @throws BadRequestException if the sessions do not belong to the invoice.
     * @throws ConflictException if a credit note is already being processed for the invoice.
     * @throws UnprocessableEntityException if the total to credit exceeds the invoice total.
     * @throws InternalServerErrorException if there is an error processing the credit note.
     */
    async createCreditNote(data: CreateCreditNoteRequestDto): Promise<CreditNote> {
        const context = 'createCreditNote';
        this.logger.log(`[${context}] Starting credit note creation process for invoiceId: ${data.invoiceId} and sessions ${data.session_ids.join(', ')}`);

        const invoice = await this.validateInvoice(data.invoiceId);
        const sessions = await this.validateSessions(invoice, data.session_ids);
        await this.validateCreditNoteExistence(data.invoiceId);
        this.logger.log(`[${context}] No existing credit note found for invoiceId: ${data.invoiceId}. Proceeding with creation.`);

        const creditedAmountFromFI = await this.getCreditedAmountFromFI(invoice.invoice_number!);
        const totalSessionsValue = this.calculateTotalSessionsValue(sessions, data.session_ids);
        const totalToCredit = totalSessionsValue + creditedAmountFromFI;
        this.logger.log(`[${context}] Total to credit calculated: ${totalToCredit} (Sessions: ${totalSessionsValue}, Previously Credited: ${creditedAmountFromFI})`);

        const creditNote = await this.saveCreditNote({
            invoice_id: invoice.id,
            total_amount: totalSessionsValue,
            reason: data.reason,
            created_at: new Date(),
            updated_at: new Date()
        });

        await this.validateCreditAmount(invoice, creditNote, totalToCredit);

        const sessionFileBaseName = `${sessions[0]._id}_${new Date().toISOString()}`;
        await this.saveSessionsFileReference(sessions, sessionFileBaseName, invoice.id);

        const payload = { creditNoteId: creditNote.id };
        await sendMessage({ method: 'processCreditNote', payload }, 'billing_v2_credit_note_key');

        this.logger.log(`[${context}] Credit note creation process initiated successfully for creditNoteId: ${creditNote.id}`);
        return creditNote;
    }

    /**
     * Validates the existence and status of the invoice.
     * @param invoiceId - The ID of the invoice to validate.
     * @return The validated invoice.
     * @throws NotFoundException if the invoice is not found or invalid.
     */
    private async validateInvoice(invoiceId: string): Promise<Invoice> {
        const context = 'validateInvoice';
        this.logger.log(`[${context}] Validating invoice with ID: ${invoiceId}`);
        const invoice = await this.invoiceRepository.findOne({ where: { id: invoiceId } });
        if (!invoice || invoice.status !== InvoiceStatusId.EmailSent || invoice.third_party_id === null) {
            this.logger.error(`[${context}] Invoice ${invoiceId} is invalid. Status: ${invoice?.status}, Third Party ID: ${invoice?.third_party_id}`);
            throw new NotFoundException(`Invoice ${invoiceId} was not found.`);
        }
        return invoice;
    }

    private async validateSessions(invoice: Invoice, sessionIds: string[]): Promise<Session[]> {
        const context = 'validateSessions';
        this.logger.log(`[${context}] Validating sessions for invoice ID: ${invoice.id}`);
        const fileReference = await this.fileReferenceService.findByRelatedObjectId(invoice.id);
        if (!fileReference) {
            this.logger.error(`[${context}] File reference for Invoice ${invoice.id} was not found.`);
            throw new NotFoundException(`File reference for Invoice ${invoice.id} was not found.`);
        }

        const fileUrl = fileReference.find(f => f.file_purpose === 'session_json')?.file_url;
        if (!fileUrl) {
            this.logger.error(`[${context}] File URL for session JSON of Invoice ${invoice.id} is not available.`);
            throw new NotFoundException(`File URL for session JSON of Invoice ${invoice.id} is not available.`);
        }

        const sessions: Session[] = await this.loadSessionsFromInvoice(fileUrl);
        const invoiceSessionIds = sessions?.map(session => session._id) ?? [];
        const missingSessions = sessionIds.filter(id => !invoiceSessionIds.includes(id));
        if (missingSessions.length > 0) {
            this.logger.error(`[${context}] Session(s) ${missingSessions.join(', ')} do not belong to Invoice ${invoice.id}.`);
            throw new BadRequestException(`Session(s) ${missingSessions.join(', ')} do not belong to Invoice ${invoice.id}.`);
        }

        this.logger.log(`[${context}] All sessions validated successfully for Invoice ${invoice.id}.`);
        return sessions;
    }

    private async validateCreditNoteExistence(invoiceId: string): Promise<void> {
        const context = 'validateCreditNoteExistence';
        this.logger.log(`[${context}] Checking for existing credit note for invoiceId: ${invoiceId}`);
        const creditNoteExisting = await this.creditNoteRepository.findOne({ where: { invoice_id: invoiceId } });
        if (creditNoteExisting && creditNoteExisting.status !== '45') {
            this.logger.error(`[${context}] A credit note is already being processed for this invoice: ${invoiceId}.`);
            throw new ConflictException(`A credit note is already being processed for this invoice: ${invoiceId}.`);
        }
    }

    private async getCreditedAmountFromFI(invoiceNumber: string): Promise<number> {
        const ft = await this.getCreditNoteNumberFromSqlServer(invoiceNumber);
        if (ft.length === 0) return 0;
        const fi = await this.getFInvoiceNumberFromSqlServer([ft]);
        return fi.reduce((sum, item) => sum + Math.abs(Number(item.etiliquido || 0)), 0);
    }

    private calculateTotalSessionsValue(sessions: Session[], sessionIds: string[]): number {
        return sessions
            .filter(session => sessionIds.includes(session._id))
            .reduce((sum, session) => sum + (session.finalPrices?.totalPrice.incl_vat || session.totalPrice?.incl_vat || 0), 0) || 0;
    }

    private async validateCreditAmount(invoice: Invoice, creditNote: CreditNote, totalToCredit: number): Promise<void> {
        const context = 'validateCreditAmount';
        this.logger.log(`[${context}] Validating credit amount for Credit Note ID: ${creditNote.id}`);
        if (invoice.total_amount_inc_vat < totalToCredit) {
            this.logger.warn(`Credit Note creation failed for Invoice ${invoice.id}: Total to credit exceeds invoice total.`);
            await this.updateCreditNote({ status: InvoiceStatusId.CreditNoteFailed.toString() }, { id: creditNote.id });
            throw new UnprocessableEntityException(`Total to credit ${totalToCredit} exceeds Invoice ${invoice.id} total of ${invoice.total_amount_inc_vat}.`);
        }
    }

    /**
     * Processes a credit note: validates data, issues the note, updates statuses, and sends notification email.
     * @param creditNoteId The ID of the credit note to process.
     * @throws NotFoundException, BadRequestException, ConflictException, UnprocessableEntityException, InternalServerErrorException
     */
    async processCreditNote(creditNoteId: string): Promise<void> {
        const context = 'processCreditNote';
        this.logger.log(`[${context}] Starting processing for creditNoteId: ${creditNoteId}`);

        let creditNote = await this.creditNoteRepository.findOne({ where: { id: creditNoteId } });
        if (!creditNote) {
            this.logger.error(`[${context}] Credit Note ${creditNoteId} not found.`);
            throw new NotFoundException(`Credit Note ${creditNoteId} not found`);
        }

        const invoice = await this.invoiceService.findInvoiceById(creditNote.invoice_id);
        if (!invoice) {
            this.logger.error(`[${context}] Invoice ${creditNote.invoice_id} not found.`);
            throw new NotFoundException(`Invoice ${creditNote.invoice_id} not found`);
        }

        const fileReference = await this.fileReferenceService.findByRelatedObjectId(invoice.id);
        if (!fileReference) {
            this.logger.error(`[${context}] File reference for Invoice ${invoice.id} was not found.`);
            throw new NotFoundException(`File reference for Invoice ${invoice.id} was not found.`);
        }

        const fileUrl = fileReference.find(f => f.file_purpose === 'session_json')?.file_url;
        if (!fileUrl) {
            this.logger.error(`[${context}] File URL for session JSON of Invoice ${invoice.id} is not available.`);
            throw new NotFoundException(`File URL for session JSON of Invoice ${invoice.id} is not available.`);
        }

        this.logger.log(`[${context}] Loading sessions from invoice...`);
        const sessions: Session[] = await this.loadSessionsFromInvoice(fileUrl);
        this.logger.log(`[${context}] Loaded ${sessions.length} sessions from invoice.`);

        const firstSession = sessions[0];
        const creditedAmountFromFI = await this.getCreditedAmountFromFI(invoice.invoice_number!);
        this.logger.log(`[${context}] Credited amount from FI: ${creditedAmountFromFI}`);

        const sessionIds = sessions.map(s => s._id);
        const totalSessionsValue = this.calculateTotalSessionsValue(sessions, sessionIds);
        this.logger.log(`[${context}] Total sessions value: ${totalSessionsValue}`);

        const totalToCredit = totalSessionsValue + creditedAmountFromFI;
        this.logger.log(`[${context}] Total to credit (sessions + previously credited): ${totalToCredit}`);

        try {
            this.logger.log(`[${context}] Validating credit amount for Credit Note ID: ${creditNote.id}`);
            await this.validateCreditAmount(invoice, creditNote, totalToCredit);
        } catch (error) {
            this.logger.warn(`[${context}] Credit amount validation failed: ${error.message}`);
            await this.updateCreditNote({ status: InvoiceStatusId.CreditNoteFailed.toString() }, { id: creditNote.id });

            const communications = await this.invoiceCommunicationService.findAllByInvoiceId(invoice.id);
            if (communications.length === 0) {
                this.logger.warn(`[${context}] No communication settings found for Invoice ${invoice.id}. Skipping email notification.`);
                return;
            }
            const firstCommunication = communications[0];
            const htmlContent = await this.mailService.prepareEmailHtml(firstCommunication.name, firstCommunication.language, invoice.client_name, 'support');
            const subject = `Nota de crédito não processada: ${invoice.invoice_number}`;
            await this.mailService.sendEmail({
                to: process.env.EVIOMAIL_DEV!,
                bcc: process.env.EVIOMAIL_DEV!,
                subject,
                html: htmlContent,
                attachments: [],
                clientName: invoice.client_name
            });
            this.logger.log(`[${context}] Failure notification email sent for invoice: ${invoice.id}`);
            return;
        }


        const invoiceBilling = await this.invoiceBillingService.findByInvoiceId(invoice.id);
        if (!invoiceBilling) {
            this.logger.error(`[${context}] No billing information found for Invoice ${invoice.id}.`);
            throw new NotFoundException(`No billing information found for Invoice ${invoice.id}.`);
        }

        const vatStatus = await this.vatStatusService.getVatStatus(sessions[0], invoiceBilling?.country_code);

        const invoiceCommunication = await this.invoiceCommunicationService.findAllByInvoiceId(invoice.id);
        if (invoiceCommunication.length === 0) {
            this.logger.error(`[${context}] No communication settings found for Invoice ${invoice.id}.`);
            throw new NotFoundException(`No communication settings found for Invoice ${invoice.id}.`);
        }

        if (typeof invoice.invoice_layout_id !== 'number') {
            this.logger.error(`[${context}] Invoice layout id is undefined for invoiceId: ${invoice.id}`);
            throw new Error(`Invoice layout id is undefined for invoiceId: ${invoice.id}`);
        }
        const layout = await this.invoiceLayoutService.findByInvoiceId(invoice.invoice_layout_id);
        if (!layout) {
            this.logger.error(`[${context}] Invoice layout not found for given client and language | invoiceId: ${invoice.id}`);
            throw new Error(`Invoice layout not found for given client and language | invoiceId: ${invoice.id}`);
        }

        const paymentConditions = await this.paymentConditionsRepository.findOne({
            where: { id: invoiceBilling?.payment_conditions_id! },
        });

        const latestDate = getLatestSessionDate(sessions);
        const endDate = latestDate ?? new Date().toISOString().split('T')[0];

        const codeDescription = firstSession.country_code == 'PT' ? 'SERV221021' : 'SERV221022';
        const description = getServiceDescription(codeDescription, invoiceCommunication[0].language);

        const creditNotePayload = this.buildInvoicePayload({
            externalheaderid: creditNote.id,
            rectificationreason: creditNote.reason,
            ftorigem: invoice.invoice_number!,
            invoiceBilling,
            group: sessions,
            vatStatus,
            vatCountry: invoiceBilling.country_code?.toString(),
            doctype: layout.doctype,
            documentlayout: layout.id.toString(),
            printtypeid: layout.printtypeid,
            originSession: invoice.vat_country === "PT" ? "ISERV21021" : "ISERV21022",
            paymentConditions,
            endDate,
            description
        });
        this.logger.log(`[${context}] Credit note payload built: ${JSON.stringify(creditNotePayload)}`);

        try {
            this.logger.log(`[${context}] Issuing credit note in billing system...`);
            const invoiceProcessed = await this.billingService.issueCreditNote(creditNotePayload);
            if (invoiceProcessed?.fno) {
                const currentYear = new Date().getFullYear();
                const creditNoteNumber = `NC ${currentYear}A${layout.doctype}/${invoiceProcessed.fno}`;
                await this.updateCreditNote({ status: InvoiceStatusId.SentToThirdPartySuccessful.toString(), credit_note_number: creditNoteNumber, third_party_id: invoiceProcessed.invoiceStampID }, { id: creditNote.id });
                creditNote.credit_note_number = creditNoteNumber;
                await this.invoiceService.updateInvoice({ id: invoice.id }, { updated_at: new Date(), credited_amount_exc_vat: totalToCredit });
                this.logger.log(`[${context}] Credit note issued and updated: ${creditNoteNumber}`);
            }
        } catch (error) {
            this.logger.error(`[${context}] Error processing credit note ${creditNote.id}: ${error.message}`, error.stack);
            await this.updateCreditNote({ status: InvoiceStatusId.SendToThirdPartyError.toString() }, { id: creditNote.id });
            const payload = { creditNoteId: creditNote.id };
            await sendMessage({ method: 'creditNotePdfProcess', payload }, 'billing_v2_key');

            throw new InternalServerErrorException(`Failed to process credit note ${creditNote.id}`);
        }

        const communicationItems = invoiceCommunication.map(comm => ({
            ...comm,
            client_type: comm.client_type === 'b2b' ? 'b2b' : 'b2c'
        })) as InvoiceCommunicationItem[];

        let pdfBuffer: Buffer | undefined = undefined;
        try {
            pdfBuffer = await this.fetchCreditNotePdf(creditNote);
        } catch (error) {
            this.logger.error(`[${context}] Error generating PDF for credit note ${creditNote.id}: ${error.message}`, error.stack);
            const payload = { creditNoteId: creditNote.id, error };
            await sendMessage({ method: 'fetchCreditNotePDF', payload }, 'billing_v2_credit_note_key');

            throw new InternalServerErrorException(`Failed to generate PDF for credit note ${creditNote.id}`);
        }

        if (!pdfBuffer) {
            throw new InternalServerErrorException(`[${context}] PDF buffer for credit note ${creditNote.id} could not be generated.`);
        }

        this.logger.log(`[${context}] Preparing attachments for email...`);
        const attachments = await this.prepareAttachments(
            creditNote,
            invoiceBilling,
            communicationItems,
            sessions,
            pdfBuffer
        );

        for (const session of sessions) {
            const sessionNetwork = session.network || session.source;
            if (!sessionNetwork) {
                this.logger.warn(`[${context}] Session ${session._id} has no network/source information. Skipping session update.`);
                continue;
            }
            await this.sessionInvoiceService.updateSessionInvoiceNumber(session, sessionNetwork, invoice, creditNote);
            let updated;
            if (sessionNetwork == 'EVIO') {
                updated = await ChargerLibrary.updateNewInvoiceIdById(session._id, undefined, false);
            } else {
                updated = await OcpiSessionRepository.updateNewInvoiceIdById(session.id, undefined, false);
            }
            if (updated) {
                this.logger.log(`[${context}] Invoice ID updated successfully for session: ${session._id}`);
            } else {
                this.logger.log(`[${context}] No changes were made for session: ${session._id}`);
            }
        }

        this.logger.log(`[${context}] Sending invoice emails for invoice ID: ${invoice.id}`);
        await this.invoiceEmailService.sendInvoiceEmails(
            communicationItems,
            attachments,
            creditNote.id,
            invoice.client_name,
            creditNote.credit_note_number ?? '',
            sessions[0]._id,
            'creditNote'
        );
        this.logger.log(`[${context}] Email sent for credit note: ${creditNote.id}`);
    }
    /**
     * Loads sessions from invoice object, fetching from S3 if necessary.
     * @param invoice Invoice object
     * @returns Array of Session
     * @throws BadRequestException if sessions cannot be loaded or parsed
     */
    private async loadSessionsFromInvoice(fileUrl: string): Promise<Session[]> {
        let sessions: Session[] = [];
        if (!sessions || sessions.length === 0) {
            try {
                const fileKey = fileUrl.replace(/^https:\/\/[^\/]+\/(.+)$/, '$1');
                const downloadedSessionsBuffer = await downloadFileFromS3(fileKey);
                const sessionsString = downloadedSessionsBuffer.toString('utf-8');
                sessions = JSON.parse(sessionsString);
            } catch (error) {
                this.logger.error(`Failed to parse sessions from S3 file: ${error.message}`);
                throw new BadRequestException('Could not parse sessions from S3 file');
            }
        }
        return sessions ?? [];
    }

    async saveCreditNote(data: Partial<CreditNote>): Promise<CreditNote> {
        return await this.creditNoteRepositoryCustom.createCreditNote({
            ...data,
            status: InvoiceStatusId.Created.toString(),
        });
    }

    async updateCreditNote(updateData: Partial<CreditNote>, where: Partial<CreditNote>): Promise<void> {
        await this.creditNoteRepositoryCustom.updateCreditNote(where, updateData);
    }

    buildInvoicePayload({
        externalheaderid,
        rectificationreason,
        ftorigem,
        invoiceBilling,
        group,
        vatStatus,
        vatCountry,
        doctype,
        documentlayout,
        printtypeid,
        originSession,
        endDate,
        description
    }: BuildCreditNotePayloadParams) {
        const firstSession = group[0];

        let period = '';
        if (endDate) {
            period = endDate;
        } else if (firstSession.end_date_time) {
            period = new Date(firstSession.end_date_time).toISOString().split('T')[0];
        } else if (firstSession.stopDate) {
            period = new Date(firstSession.stopDate).toISOString().split('T')[0];
        }

        const line: any = {
            code: originSession,
            description: description ?? '',
            quantity: '1',
            value: group.reduce((sum, s) => sum + (s.finalPrices?.totalPrice.excl_vat || s.totalPrice?.excl_vat || 0), 0),
            initialwarehouse: 1,
            tabiva: vatStatus?.tab_iva?.toString() ?? '4',
        };

        // Additional fields if they exist
        if (vatStatus?.tab_iva?.toString() == '4') line.vatexemptioncode = 0; // Assuming 0 for VAT exemption code if tab_iva is 4

        const addressFields = this.getClientAddressFields(invoiceBilling);

        return {
            action: 'CREATE',
            doctype,
            externalheaderid,
            rectificationreason,
            date: new Date().toISOString().split('T')[0],
            documentlayout,
            printtypeid,
            ftorigem,
            clientdata: {
                vatcountry: vatCountry,
                vatnumber: invoiceBilling?.vat_number,
                name: invoiceBilling.name.replace(/-\s*/g, '').trim().substring(0, 55), //Phc limit 55 characters
                termsofpayment: 'REGL',
                active: '1',
                vatexemptioncode: '',
                street: addressFields.street,
                postcode: addressFields.postcode,
                city: addressFields.city,
                locality: addressFields.locality,
                addresscountry: addressFields.addresscountry,
            },
            lines: {
                0: line,
            },
        };
    }

    private getClientAddressFields(invoiceBilling: Partial<InvoiceBilling>): IClientAddressFields {
        // If VAT number is '999999990', return all fields as a single space (required by PHC for generic clients)
        if (invoiceBilling && invoiceBilling.vat_number === '999999990') {
            return {
                street: ' ',
                postcode: ' ',
                city: ' ',
                locality: ' ',
                addresscountry: ' ',
            };
        } else {
            // Build street address, including number only if it exists
            // PHC only allows up to 55 characters for the street field
            let streetValue = invoiceBilling?.street ?? '';
            if (invoiceBilling?.number) {
                streetValue += `, ${invoiceBilling.number}`;
                // Only include floor if number exists
                if (invoiceBilling?.floor) {
                    streetValue += `, ${invoiceBilling.floor}`;
                }
            }
            const street = streetValue.substring(0, 55);

            return {
                street,
                postcode: invoiceBilling?.zip_code ?? '',
                city: (invoiceBilling?.city ?? '').trim(),
                locality: invoiceBilling?.country ?? '',
                addresscountry: invoiceBilling?.country_code ?? '',
            };
        }
    }
    async getCreditNoteNumberFromSqlServer(invoiceNumber: string): Promise<any | null> {
        const normalizedInvoiceNumber = invoiceNumber.replace(/_/g, '/');

        const result = await this.ftRepository.find({
            where: {
                pnome: normalizedInvoiceNumber,
            },
        });
        return result ?? null;
    }
    async getFInvoiceNumberFromSqlServer(data: any[]): Promise<any[]> {
        if (!data || !Array.isArray(data) || data.length === 0) {
            throw new BadRequestException('data array must not be empty');
        }
        const ftstamps = data[0]
            .map(item => item?.ftstamp?.trim())
            .filter(ftstamp => typeof ftstamp === 'string' && ftstamp.length > 0);

        if (ftstamps.length === 0) {
            throw new BadRequestException('No valid ftstamp values found in data array');
        }

        const results = await this.fiRepository.find({
            where: {
                ftstamp: In(ftstamps),
            },
        });
        return results;
    }
    private async saveSessionsFileReference(
        sessions: Session[],
        sessionFileBaseName: string,
        invoiceId: string
    ): Promise<void> {
        const context = 'saveSessionsFileReference';
        this.logger.log(`[${context}] Uploading sessions file to S3 for invoiceId: ${invoiceId}`);
        const fileName = buildS3FileName('session', sessionFileBaseName, 'json');
        const s3Url = await uploadFileToS3(Buffer.from(JSON.stringify(sessions)), fileName);
        if (!s3Url) {
            this.logger.error(`[${context}] Failed to upload sessions to S3`);
            throw new BadRequestException('Failed to upload sessions to S3');
        }
        this.logger.log(`[${context}] Sessions file uploaded to S3 successfully: ${s3Url}`);
        await this.fileReferenceService.saveFileReference({
            related_object_type: 'credit_note',
            related_object_id: invoiceId,
            file_type: 'session',
            file_purpose: FilePurpose.SESSION_JSON,
            file_url: s3Url,
        });
        this.logger.log(`[${context}] File reference for sessions saved successfully`);
    }

    async prepareAttachments(
        creditNoteProcessed: CreditNote,
        invoiceBilling: InvoiceBilling,
        invoiceCommunication: InvoiceCommunicationItem[],
        sessions: Session[],
        invoicePhcPdf: Buffer
    ): Promise<Attachment[]> {
        const attachments: Attachment[] = [];

        this.logger.log(`Retrieving invoice PDF from PHC...`);
        if (!creditNoteProcessed.credit_note_number) {
            throw new Error('Credit note number is undefined');
        }

        try {
            attachments.push({
                filename: `${creditNoteProcessed.credit_note_number}.pdf`,
                content: invoicePhcPdf,
                contentType: 'application/pdf',
                encoding: 'base64',
            });
            this.logger.log(`✅ Invoice PDF retrieved and added to attachments`);
            const isAdHoc = sessions[0].billingPeriod === 'AD_HOC';
            const sessionNetwork = sessions[0].network || sessions[0].source;

            const sessionIds = sessions.map(s => s.id);

            let cdrExtension;
            if (sessionNetwork !== 'EVIO') {
                if (isAdHoc) {
                    cdrExtension = await this.excelTemplateService.calculateEnergyInfoFromCdr(sessions[0]);
                } else {
                    cdrExtension = await this.excelTemplateService.calculateEnergyInfoFromPeriodicCdr(sessionIds);
                }
            }

            this.logger.log(`Generating PDF resume...`);
            const pdfResumePayload = await this.pdfPayloadBuilderService.buildPayload({
                sessions,
                invoiceCommunication,
                invoiceNumber: creditNoteProcessed.credit_note_number,
                invoiceBilling,
                isAdHoc
            }, cdrExtension);

            const pdfResumeCreated = await this.invoicePdfService.generatePdf(pdfResumePayload);
            attachments.push({
                filename: `resumo_${invoiceCommunication[0].name.trim()}_${creditNoteProcessed.credit_note_number}.pdf`,
                content: pdfResumeCreated,
                contentType: 'application/pdf',
                encoding: 'base64',
            });
            this.logger.log(`✅ PDF resume generated and added to attachments`);

            const filepath = await this.billingService.uploadDocument(pdfResumeCreated, 'detailed_pdf', creditNoteProcessed.credit_note_number);
            await this.fileReferenceService.saveFileReference({
                related_object_type: 'invoice',
                related_object_id: creditNoteProcessed.id,
                file_type: 'pdf',
                file_purpose: FilePurpose.DETAILED_PDF,
                file_url: filepath,
            });

            let endDate;
            if (isAdHoc) {
                endDate = sessions[0].end_date_time ? sessions[0].end_date_time.split('T')[0] : new Date().toISOString().split('T')[0];
            }
            else {
                let latestDate: string | undefined = undefined;
                for (const session of sessions) {
                    const dateStr = session.end_date_time || session.stopDate;
                    if (dateStr) {
                        if (!latestDate || new Date(dateStr) > new Date(latestDate)) {
                            latestDate = dateStr;
                        }
                    }
                }
                endDate = latestDate
                    ? new Date(latestDate).toISOString().split('T')[0]
                    : new Date().toISOString().split('T')[0];
            }

            if (invoiceBilling.client_type === 'b2b') {
                const excelBuffer = await this.excelTemplateService.generateExcel(
                    invoiceCommunication[0].language,
                    sessions,
                    creditNoteProcessed.id,
                    creditNoteProcessed.credit_note_number,
                    endDate,
                    isAdHoc,
                    cdrExtension,
                    InvoiceLayoutType.CreditNote
                );
                attachments.push({
                    filename: `resumo_${invoiceCommunication[0].name.trim()}_${creditNoteProcessed.credit_note_number}.xlsx`,
                    content: excelBuffer,
                    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    encoding: 'base64',
                });
                const filepath = await this.billingService.uploadDocument(pdfResumeCreated, 'detailed_pdf', creditNoteProcessed.credit_note_number);
                await this.fileReferenceService.saveFileReference({
                    related_object_type: 'invoice',
                    related_object_id: creditNoteProcessed.id,
                    file_type: 'pdf',
                    file_purpose: FilePurpose.DETAILED_EXCEL,
                    file_url: filepath,
                });
            }

        } catch (error) {
            this.logger.error(`❌ Error preparing attachments: ${error.message}`);
            const payload = { invoiceId: creditNoteProcessed.id };
            await sendMessage({ method: 'attachmentsProcess', payload }, 'billing_v2_key');
            throw new Error(`Failed to prepare attachments: ${error.message}`);
        }

        return attachments;
    }

    /**
     * Sends a credit note email given a creditNoteId.
     * Loads all required data (credit note, sessions, communication, and fetches attachments from S3)
     * and sends the email using the InvoiceEmailService.
     * Throws NotFoundException if any required data is missing.
     * @param creditNoteId The ID of the credit note to send by email
     */
    async sendCreditNoteEmailById(creditNoteId: string): Promise<void> {
        const context = 'sendCreditNoteEmailById';
        this.logger.log(`[${context}] Starting process for creditNoteId: ${creditNoteId}`);

        // Fetch credit note
        const creditNote = await this.getCreditNoteOrThrow(creditNoteId, context);

        // Fetch file references for attachments and sessions
        const fileReferences = await this.getFileReferencesOrThrow(creditNote.id, context);

        // Fetch attachments from S3
        const attachments = await this.getCreditNoteAttachmentsFromS3(fileReferences, creditNote, context);

        // Fetch sessions from S3
        const sessions = await this.getSessionsFromFileReferences(fileReferences, creditNote.id, context);

        // Fetch invoice communication
        const communicationItems = await this.getCommunicationItemsOrThrow(creditNote.id, context);

        this.logger.log(`[${context}] All data loaded. Sending email...`);

        await this.invoiceEmailService.sendInvoiceEmails(
            communicationItems,
            attachments,
            creditNote.id,
            creditNote.invoice_id,
            creditNote.credit_note_number ?? '',
            sessions[0]._id,
            'creditNote'
        );

        this.logger.log(`[${context}] Credit note email sent for creditNoteId: ${creditNoteId}`);
    }

    // Métodos utilitários privados com logs

    private async getCreditNoteOrThrow(creditNoteId: string, context: string): Promise<CreditNote> {
        this.logger.log(`[${context}] Fetching credit note...`);
        const creditNote = await this.creditNoteRepository.findOne({ where: { id: creditNoteId } });
        if (!creditNote) {
            this.logger.error(`[${context}] Credit Note ${creditNoteId} not found`);
            throw new NotFoundException(`Credit Note ${creditNoteId} not found`);
        }
        return creditNote;
    }

    private async getFileReferencesOrThrow(relatedObjectId: string, context: string): Promise<any[]> {
        this.logger.log(`[${context}] Fetching file references...`);
        const fileReferences = await this.fileReferenceService.findByRelatedObjectId(relatedObjectId);
        if (!fileReferences || fileReferences.length === 0) {
            this.logger.error(`[${context}] No file references found for related object ${relatedObjectId}.`);
            throw new NotFoundException(`No file references found for related object ${relatedObjectId}.`);
        }
        return fileReferences;
    }

    private async getCreditNoteAttachmentsFromS3(fileReferences: any[], creditNote: CreditNote, context: string): Promise<Attachment[]> {
        this.logger.log(`[${context}] Fetching attachments from S3...`);
        const attachmentTypes = [
            { purpose: FilePurpose.OFFICIAL_CREDIT_NOTE, filename: `${creditNote.credit_note_number}.pdf`, contentType: 'application/pdf' },
            { purpose: FilePurpose.DETAILED_PDF, filename: `resumo_${creditNote.credit_note_number}.pdf`, contentType: 'application/pdf' },
            { purpose: FilePurpose.DETAILED_EXCEL, filename: `resumo_${creditNote.credit_note_number}.xlsx`, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
        ];

        const attachments: Attachment[] = [];
        for (const type of attachmentTypes) {
            const ref = fileReferences.find(f => f.file_purpose === type.purpose);
            if (ref && ref.file_url) {
                try {
                    const fileKey = ref.file_url.replace(/^https:\/\/[^\/]+\/(.+)$/, '$1');
                    const fileBuffer = await downloadFileFromS3(fileKey);
                    attachments.push({
                        filename: type.filename,
                        content: fileBuffer,
                        contentType: type.contentType,
                        encoding: 'base64',
                    });
                    this.logger.log(`[${context}] Attachment loaded: ${type.filename}`);
                } catch (err) {
                    this.logger.warn(`[${context}] Could not load attachment ${type.filename}: ${err.message}`);
                }
            } else {
                this.logger.warn(`[${context}] File reference not found for purpose: ${type.purpose}`);
            }
        }
        this.logger.log(`[${context}] Total attachments loaded: ${attachments.length}`);
        return attachments;
    }

    private async getSessionsFromFileReferences(fileReferences: any[], contextId: string, context: string): Promise<Session[]> {
        this.logger.log(`[${context}] Fetching sessions from S3...`);
        const sessionFileRef = fileReferences.find(f => f.file_purpose === FilePurpose.SESSION_JSON);
        if (!sessionFileRef || !sessionFileRef.file_url) {
            this.logger.error(`[${context}] File URL for session JSON of object ${contextId} is not available.`);
            throw new NotFoundException(`File URL for session JSON of object ${contextId} is not available.`);
        }
        const sessions: Session[] = await this.loadSessionsFromInvoice(sessionFileRef.file_url);
        this.logger.log(`[${context}] Loaded ${sessions.length} sessions.`);
        return sessions;
    }

    private async getCommunicationItemsOrThrow(invoiceId: string, context: string): Promise<InvoiceCommunicationItem[]> {
        this.logger.log(`[${context}] Fetching invoice communication...`);
        const invoiceCommunication = await this.invoiceCommunicationService.findAllByInvoiceId(invoiceId);
        if (!invoiceCommunication.length) {
            this.logger.error(`[${context}] No communication settings found for Credit Note ${invoiceId}.`);
            throw new NotFoundException(`No communication settings found for Credit Note ${invoiceId}.`);
        }
        const communicationItems = invoiceCommunication.map(comm => ({
            ...comm,
            client_type: comm.client_type === 'b2b' ? 'b2b' : 'b2c'
        })) as InvoiceCommunicationItem[];
        this.logger.log(`[${context}] Loaded ${communicationItems.length} communication items.`);
        return communicationItems;
    }

    async fetchCreditNotePdf(creditNoteProcessed: CreditNote): Promise<Buffer> {
        const context = 'fetchCreditNotePdf';
        if (!creditNoteProcessed.credit_note_number) {
            this.logger.error(`[${context}] Credit note number is undefined`);
            throw new Error('Credit note number is undefined');
        }
        try {
            creditNoteProcessed.credit_note_number = creditNoteProcessed.credit_note_number.replace(/\//g, '_');
            const invoicePhcPdf = await this.billingService.getDocument(creditNoteProcessed.credit_note_number);
            if (!invoicePhcPdf) {
                this.logger.warn(`[${context}] No PDF found for invoice number: ${creditNoteProcessed.credit_note_number}`);
                throw new Error(`No PDF found for invoice number: ${creditNoteProcessed.credit_note_number}`);
            }
            const filepath = await this.billingService.uploadDocument(invoicePhcPdf, 'invoice', creditNoteProcessed.credit_note_number);
            await this.fileReferenceService.saveFileReference({
                related_object_type: 'credit_note',
                related_object_id: creditNoteProcessed.id,
                file_type: 'pdf',
                file_purpose: FilePurpose.OFFICIAL_CREDIT_NOTE,
                file_url: filepath,
            });
            this.logger.log(`[${context}] PDF successfully retrieved from provider`);
            return invoicePhcPdf;
        } catch (error) {
            this.logger.error(`[${context}] Error retrieving invoice PDF from PHC: ${error.message}`);
            throw new Error(`Failed to retrieve invoice PDF: ${error.message}`);
        }
    }

    /**
     * Retries fetching the credit note PDF, prepares attachments, and sends the email.
     * Use this in retry flows when the PDF was not found/generated in the first attempt.
     * @param creditNoteId The ID of the credit note to process.
     * @throws InternalServerErrorException if the PDF still cannot be fetched or email sending fails.
     */
    async retryFetchCreditNotePdfAndSendEmail(creditNoteId: string): Promise<void> {
        const context = 'retryFetchCreditNotePdfAndSendEmail';
        this.logger.log(`[${context}] Starting retry process for creditNoteId: ${creditNoteId}`);

        // Fetch all required entities
        const creditNote = await this.creditNoteRepository.findOne({ where: { id: creditNoteId } });
        if (!creditNote) {
            this.logger.error(`[${context}] Credit Note ${creditNoteId} not found.`);
            throw new NotFoundException(`Credit Note ${creditNoteId} not found`);
        }

        const invoice = await this.invoiceService.findInvoiceById(creditNote.invoice_id);
        if (!invoice) {
            this.logger.error(`[${context}] Invoice ${creditNote.invoice_id} not found.`);
            throw new NotFoundException(`Invoice ${creditNote.invoice_id} not found`);
        }

        const invoiceBilling = await this.invoiceBillingService.findByInvoiceId(invoice.id);
        if (!invoiceBilling) {
            this.logger.error(`[${context}] No billing information found for Invoice ${invoice.id}.`);
            throw new NotFoundException(`No billing information found for Invoice ${invoice.id}.`);
        }

        const invoiceCommunication = await this.invoiceCommunicationService.findAllByInvoiceId(invoice.id);
        if (invoiceCommunication.length === 0) {
            this.logger.error(`[${context}] No communication settings found for Invoice ${invoice.id}.`);
            throw new NotFoundException(`No communication settings found for Invoice ${invoice.id}.`);
        }
        const communicationItems = invoiceCommunication.map(comm => ({
            ...comm,
            client_type: comm.client_type === 'b2b' ? 'b2b' : 'b2c'
        })) as InvoiceCommunicationItem[];

        // Sessions
        const fileReference = await this.fileReferenceService.findByRelatedObjectId(invoice.id);
        if (!fileReference) {
            this.logger.error(`[${context}] File reference for Invoice ${invoice.id} was not found.`);
            throw new NotFoundException(`File reference for Invoice ${invoice.id} was not found.`);
        }
        const fileUrl = fileReference.find(f => f.file_purpose === 'session_json')?.file_url;
        if (!fileUrl) {
            this.logger.error(`[${context}] File URL for session JSON of Invoice ${invoice.id} is not available.`);
            throw new NotFoundException(`File URL for session JSON of Invoice ${invoice.id} is not available.`);
        }
        const sessions: Session[] = await this.loadSessionsFromInvoice(fileUrl);

        // Retry fetching the PDF
        let pdfBuffer: Buffer | undefined = undefined;
        try {
            pdfBuffer = await this.fetchCreditNotePdf(creditNote);
        } catch (error) {
            this.logger.error(`[${context}] Error generating PDF for credit note ${creditNote.id}: ${error.message}`, error.stack);
            throw new InternalServerErrorException(`Failed to generate PDF for credit note ${creditNote.id}`);
        }

        if (!pdfBuffer) {
            throw new InternalServerErrorException(`[${context}] PDF buffer for credit note ${creditNote.id} could not be generated.`);
        }

        // Prepare attachments and send email
        this.logger.log(`[${context}] Preparing attachments for email...`);
        const attachments = await this.prepareAttachments(
            creditNote,
            invoiceBilling,
            communicationItems,
            sessions,
            pdfBuffer
        );

        this.logger.log(`[${context}] Sending invoice emails for invoice ID: ${invoice.id}`);
        await this.invoiceEmailService.sendInvoiceEmails(
            communicationItems,
            attachments,
            creditNote.id,
            invoice.client_name,
            creditNote.credit_note_number ?? '',
            sessions[0]._id,
            'creditNote'
        );
        this.logger.log(`[${context}] Email sent for credit note: ${creditNote.id}`);
    }
}