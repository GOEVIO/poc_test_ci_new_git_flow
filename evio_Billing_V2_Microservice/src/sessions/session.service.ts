import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from './interfaces/session.interface';
import { InvoiceService } from '../invoice/invoice.service';
import { Invoice } from '../invoice/entities/invoice.entity';
import { InvoiceStatusId } from '../enums/invoice-status.enum';
import {
    ChargingSessionReadRepository as OcpiSessionRepository,
} from 'evio-library-ocpi';
import ChargerLibrary from 'evio-library-chargers';
import { InvoiceType } from '../enums/Invoice-type.enum';
import { InvoiceCommunication } from '../enums/invoice-communication.enum';
import { InvoiceCommunicationItem } from './interfaces/invoice-communication-item.interface';
import IdentityLibrary from 'evio-library-identity';
import { UserIdToBillingInfo } from './interfaces/user-id-to-billing-info.interface';
import { VatStatus } from '../invoice/entities/vat-status.entity';
import { InvoiceCommunicationService } from '../invoice/invoice-communication/invoice-communication.service';
import { InvoiceBillingService } from '../invoice/invoice-billing/invoice-billing.service';
import { BillingService } from '../billing/billing.service';
import { CustomMailerService } from '../notification/mailer.service';
import { ExcelTemplateService } from '../templates/excel.template.service';
import { CollectorService } from '../collector/collector.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { InvoicePdfService } from '../templates/pdf/invoice-pdf.service';
import { InvoiceLayoutService } from '../invoice/invoice-layout/invoice-layout.service';
import { PaymentConditionsId, PaymentConditionStringToEnumByLang } from '../enums/payment-conditions.enum';
import { PaymentConditions } from '../invoice/entities/payment-conditions.entity';
import { InvoiceBilling } from '../invoice/entities/invoice-billing.entity';
import { Attachment } from './interfaces/attachment.interface';
import { normalizeLanguage } from '../utils/normalizeLanguage';
import { sendMessage } from 'evio-event-producer';
import { getServiceDescription } from './helpers/sevice-description';
import { TaxExemption } from '../invoice/entities/tax-exemptions.entity';
import Constants from '../utils/constants';
import { PdfPayloadBuilderService } from '../templates/pdf/pdf-payload-builder.service';
import { InvoiceExecutionService } from '../invoice/invoice-execution/invoice-execution.service';
import { InvoiceExecutionStatus } from '../enums/invoice-execution-status.enum';
import { ProcessAdHocSessionsResult } from './interfaces/process-ad-hoc-sessions-result.interface';
import { SessionInvoiceService } from './services/session-invoice.service';
import { buildS3FileName, uploadFileToS3, downloadFileFromS3 } from '../utils/aws-s3.util';
import { SessionFilters } from './interfaces/session-group.interface';
import { FilePurpose } from '../enums/file-purpose.enum';
import { FileReferenceService } from '../file-reference/file-reference.service';
import { PaymentService } from '../payments/payment.service';
import { VatStatusService } from '../vat-status/vat-status.service';
import { getLatestSessionDate } from './helpers/filter-sessions';
import { TaxExemptionService } from '../tax-exemption/tax-exemption.service';
import { InvoiceLayoutType } from '../invoice/invoice-layout/enum/invoice-layout-type.enum';
import { InvoiceEmailService } from '../shared/invoice-email.service';
@Injectable()
export class SessionService {
    private readonly logger = new Logger(SessionService.name);

    constructor(
        @InjectRepository(VatStatus) private vatStatusRepository: Repository<VatStatus>,
        @InjectRepository(PaymentConditions) private paymentConditionsRepository: Repository<PaymentConditions>,
        @InjectRepository(TaxExemption) private taxExemptionRepository: Repository<TaxExemption>,
        private readonly invoiceService: InvoiceService,
        private invoiceCommunicationService: InvoiceCommunicationService,
        private readonly invoiceBillingService: InvoiceBillingService,
        private excelTemplateService: ExcelTemplateService,
        private readonly billingService: BillingService,
        private readonly mailService: CustomMailerService,
        private readonly collectorService: CollectorService,
        private readonly invoiceLayoutService: InvoiceLayoutService,
        private auditLogService: AuditLogService,
        private invoicePdfService: InvoicePdfService,
        private readonly pdfPayloadBuilderService: PdfPayloadBuilderService,
        private readonly invoiceExecutionService: InvoiceExecutionService,
        private readonly sessionInvoiceService: SessionInvoiceService,
        private readonly fileReferenceService: FileReferenceService,
        private readonly paymentService: PaymentService,
        private readonly vatStatusService: VatStatusService,
        private readonly taxExemptionService: TaxExemptionService,
        private readonly invoiceEmailService: InvoiceEmailService,
    ) { }

    /**
   * Fetches a single session adhoc and processes it into an invoice.
   *
   * @param sessionId The session ID to process
   * @returns void
   */
    async handleAdHocSession(sessionId: string, cdrId?: string): Promise<void> {
        this.logger.log(`Received ad hoc request for sessionId: ${sessionId}, cdrId: ${cdrId}`);
        // Fetch ad hoc sessions
        const sessions = await this.getAdHocSessions(sessionId, cdrId);
        if (!sessions.length) {
            this.logger.warn(`⚠️ No sessions found for sessionId: ${sessionId}, cdrId: ${cdrId}`);
            return;
        }
        this.logger.log(`✅ Fetched ${sessions.length} session(s) for sessionId: ${sessionId}`);
        // Create invoice for sessions in DB 
        try {
            const result = await this.processAdHocSessions(sessions);
            if (!result) return;

            await this.sendAdHocInvoiceEmails(
                result.invoiceBilling,
                result.invoiceCommunication,
                result.attachments,
                result.invoiceCreated,
                result.invoiceProcessed,
                sessions[0]
            );

            this.logger.log(`🏁 Ad hoc session handling completed for sessionId: ${sessionId}`);
        } catch (error) {
            this.logger.error(`❌ Error processing ad hoc session: ${error.message}`, error.stack);
        }
    }

    async handleAdHocMissingSessions(): Promise<void> {
        const context = 'handleAdHocMissingSessions';
        this.logger.log(`Handling ad-hoc missing sessions...`);

        // Fetch adhoc sessions
        const sessions = await this.getAdHocMissingSessions();
        if (!sessions.length) {
            this.logger.warn(`⚠️ [${context}] No sessions found for the previous day without invoiceId`);
            return;
        }

        for (const session of sessions) {
            try {
                this.logger.log(` [${context}] Processing ad-hoc session missing invoice: ${session._id}`);
                const result = await this.processAdHocSessions([session]);
                this.logger.log(` [${context}] Processed ad-hoc session missing invoice: ${session._id}`);
                if (!result) return;

                await this.sendAdHocInvoiceEmails(
                    result.invoiceBilling,
                    result.invoiceCommunication,
                    result.attachments,
                    result.invoiceCreated,
                    result.invoiceProcessed,
                    session
                );
                this.logger.log(` [${context}] Finished processing ad-hoc session missing invoice: ${session._id}`);
            } catch (error) {
                this.logger.error(` [${context}] Error processing ad-hoc session missing invoice: ${session._id}`, error);
                continue;
            }
        }
    }

    /**
     * Reprocesses an ad-hoc session by its ID.
     * @param sessionId The ID of the session to reprocess
     * @return Promise<void>
     * @throws BadRequestException if the sessionId is invalid
    */
    reprocessAdHocSession(sessionId: string, cdrId: string): Promise<void> {
        this.logger.log(`Reprocessing ad-hoc session with ID: ${sessionId}`);
        return this.handleAdHocSession(sessionId, cdrId);
    }

    /**
     * Fetches multiple sessions by specific period.
     * @param billingPeriod The billing period to filter sessions
     * @returns Array of sessions
     */
    async handlePeriodicSession(billingPeriod: string, userId?: string): Promise<void> {
        // 1. Verify if there is already a periodic billing run in progress
        const alreadyRunning = await this.invoiceExecutionService.isExecutionInProgress(billingPeriod);
        if (alreadyRunning) {
            this.logger.warn(`There is already a periodic billing run in progress for the period: ${billingPeriod}`);
            return;
        }

        // 2. Create a new execution for the billing period
        const execution = await this.invoiceExecutionService.startExecution(billingPeriod);

        try {
            this.logger.log({ message: 'Fetching sessions for period', billingPeriod });
            const { sessions } = await this.getSessionsByPeriod(billingPeriod, userId);
            if (!sessions.length) {
                this.logger.log({ message: 'No valid sessions found', billingPeriod });
                await this.invoiceExecutionService.finishExecution(execution.id, InvoiceExecutionStatus.COMPLETED);
                return;
            }

            await this.groupAndProcessSessions(sessions, billingPeriod);
            this.logger.log({ message: 'Sessions processed successfully', billingPeriod });
            await this.invoiceExecutionService.finishExecution(execution.id, InvoiceExecutionStatus.COMPLETED);
        } catch (error) {
            this.logger.error({ message: 'Error processing sessions', billingPeriod, error });
            await this.invoiceExecutionService.finishExecution(execution.id, InvoiceExecutionStatus.FAILED, error.message);
        }
    }

    /**
     * Gets ad-hoc sessions by session ID.
     * @param sessionId single session ID
     * @returns array of sessions
     */
    async getAdHocSessions(sessionId: string, cdrId?: string): Promise<Session[]> {
        return this.getSessionsAdHoc(sessionId, cdrId);
    }

    /**
     * Retrieves sessions for a specific billing period from OCPI and OCPP repositories.
     *
     * This method fetches unprocessed sessions (i.e., sessions without an associated invoice)
     * for the given billing period, ensuring they meet specific criteria such as completion status,
     *
     * @param billingPeriod - The billing period to filter sessions (e.g., 'WEEKLY', 'BI_WEEKLY', 'MONTHLY').
     * @param userId - (Optional) The user ID to filter sessions.
     * @returns A promise that resolves to an array of `Session` objects from both OCPI and OCPP repositories.
     * @throws BadRequestException if the billing period is invalid or if an error occurs during session retrieval.
     */
    async getSessionsByPeriod(billingPeriod: string, userId?: string): Promise<{ sessions: Session[] }> {
        this.logger.log(`Fetching sessions for period: ${billingPeriod}`);
        const range = this.getPeriodRangeFromEnv(billingPeriod);
        if (!range) return { sessions: [] };

        const { startDate, endDate } = range;

        const baseFilters: SessionFilters = {
            invoiceId: null,
            invoiceStatus: false,
            userIdToBillingInfo: { $exists: true, $ne: null },
            billingPeriod
        };

        if (userId) {
            baseFilters['$and'] = [
                { 'userIdToBillingInfo._id': userId },
                { 'userIdToBillingInfo._id': { $ne: Constants.evioUser.userId } }
            ];
        } else {
            baseFilters['userIdToBillingInfo._id'] = { $ne: Constants.evioUser.userId };
        }

        const sessionBillingStartDate = new Date(Constants.sessions.sessionBillingStartDate);
        const sessionBillingEndDate = Constants.sessions.sessionBillingEndDate
            ? new Date(Constants.sessions.sessionBillingEndDate)
            : endDate;

        const queryOCPI = {
            ...baseFilters,
            status: 'COMPLETED',
            cdrId: { $ne: '-1' },
            'finalPrices.totalPrice.incl_vat': { $gt: 0 },
            end_date_time: {
                $gte: sessionBillingStartDate.toISOString(),
                $lte: sessionBillingEndDate.toISOString()
            }
        };

        const queryOCPP = {
            ...baseFilters,
            status: "40",
            totalPower: { $gt: 0 },
            timeCharged: { $gt: 60 },
            'totalPrice.incl_vat': { $gt: 0 },
            'tariff.billingType': 'billingTypeForBilling',
            'paymentMethod': { $ne: 'notPay' },
            stopDate: {
                $gte: new Date(sessionBillingStartDate.toISOString()),
                $lte: new Date(endDate.toISOString())
            },
            $nor: [
                { chargerType: "011", clientName: "Salvador Caetano" } // Remove in the future
            ]
        };

        this.logger.log(`billingPeriod: ${billingPeriod} | Fetching OCPI sessions for query: ${JSON.stringify(queryOCPI)}`);
        this.logger.log(`billingPeriod: ${billingPeriod} | Fetching OCPP sessions for query: ${JSON.stringify(queryOCPP)}`);

        let sessionsOCPI = await OcpiSessionRepository.findSessionsByQuery(queryOCPI);
        sessionsOCPI = await Promise.all(
            sessionsOCPI.map(async (session) => {
                await this.adjustOcpiBillingPeriodIfUnknown(session);
                // Only return sessions whose billingPeriod remained equal to the requested one
                return session.billingPeriod === billingPeriod ? session : null;
            })
        );
        sessionsOCPI = sessionsOCPI.filter(Boolean);

        const sessionsOCPP = await ChargerLibrary.findSessionsByQuery(queryOCPP);

        // Combine and sort sessions by end_date_time or stopDate
        const allSessions = [...sessionsOCPI, ...sessionsOCPP].sort((a, b) => {
            const aSessionDate = new Date(a.end_date_time || a.stopDate || 0).getTime();
            const bSessionDate = new Date(b.end_date_time || b.stopDate || 0).getTime();
            return aSessionDate - bSessionDate;
        });

        this.logger.log(`Fetched ${allSessions.length} sessions for period: ${billingPeriod}`);
        return {
            sessions: allSessions
        };
    }

    /**
     * Groups sessions and processes them into an invoice.
     * @param sessions array of sessions
     * @returns created Invoice or null
     */
    async groupAndProcessAdHocSessions(sessions: Session[]): Promise<Invoice | null> {
        if (!sessions.length) {
            return null;
        }

        const [sessionGroup] = [sessions];
        return await this.processSessionGroup(sessionGroup);
    }

    /**
     * Processes an ad-hoc session by creating an invoice and returning it.
     * @param sessions array of sessions
     * @returns the created Invoice
     */
    async processAdHocSession(sessions: Session[]): Promise<Invoice> {
        try {
            const invoiceCreated = await this.groupAndProcessAdHocSessions(sessions);
            return invoiceCreated!;
        } catch (error) {
            this.logger.error(`Failed to process ad-hoc sessions: ${error}`);
            throw new BadRequestException(`Ad-hoc session processing failed`);
        }
    }

    /**
     * Retrieves sessions for a specific ad-hoc session ID.
     * @param sessionId session identifier
     */
    async getSessionsAdHoc(sessionId: string, cdrId?: string): Promise<Session[]> {
        const context = 'getSessionsAdHoc';
        this.logger.log(`[${context}] Starting ad-hoc session query for sessionId: ${sessionId}`);

        if (!ObjectId.isValid(sessionId)) {
            throw new BadRequestException(`Invalid sessionId: ${sessionId}`);
        }

        const sessionObjectId = new ObjectId(sessionId);

        try {
            const [ocpiSession] = await OcpiSessionRepository.findSessionsByQuery({ _id: sessionObjectId });
            const [ocppSession] = await ChargerLibrary.findSessionsByQuery({ _id: sessionObjectId });

            this.logger.log(`[${context}] OCPI session fields: ${JSON.stringify({
                invoiceId: ocpiSession?.invoiceId,
                billingPeriod: ocpiSession?.billingPeriod,
                userIdToBillingInfo: ocpiSession?.userIdToBillingInfo,
                status: ocpiSession?.status,
                cdrId: cdrId,
                incl_vat: ocpiSession?.total_cost?.incl_vat,
            })}`);

            this.logger.log(`[${context}] OCPP session fields: ${JSON.stringify({
                invoiceId: ocppSession?.invoiceId,
                billingPeriod: ocppSession?.billingPeriod,
                userIdToBillingInfo: ocppSession?.userIdToBillingInfo,
                status: ocppSession?.status,
                totalPower: ocppSession?.totalPower,
                timeCharged: ocppSession?.timeCharged,
            })}`);

            const filteredSessions: Session[] = [];

            // Apply OCPI filters
            if (
                ocpiSession &&
                !ocpiSession.invoiceId &&
                ocpiSession.invoiceStatus === false &&
                ocpiSession.billingPeriod === 'AD_HOC' &&
                ocpiSession.userIdToBillingInfo &&
                ocpiSession.status === 'COMPLETED' &&
                cdrId !== '-1' &&
                ocpiSession.finalPrices?.totalPrice.incl_vat > 0 &&
                new Date(ocpiSession.end_date_time) > new Date(Constants.sessions.sessionBillingStartDate)
            ) {
                this.logger.log(`[${context}] OCPI session passed all filters`);
                ocpiSession.cdrId = cdrId;

                // Adjust billing period if unknown
                await this.adjustOcpiBillingPeriodIfUnknown(ocpiSession);
                if (ocpiSession.billingPeriod === 'AD_HOC') {
                    filteredSessions.push(ocpiSession);
                } else {
                    this.logger.log(`[${context}] OCPI session skipped because billingPeriod is now '${ocpiSession.billingPeriod}' (expected 'AD_HOC')`);
                }
            }

            // Apply OCPP filters
            if (
                ocppSession &&
                !ocppSession.invoiceId &&
                ocppSession.invoiceStatus === false &&
                ocppSession.billingPeriod === 'AD_HOC' &&
                ocppSession.userIdToBillingInfo &&
                ocppSession.status === '40' &&
                ocppSession.totalPower > 0 &&
                ocppSession.timeCharged > 60 &&
                ocppSession.totalPrice.incl_vat > 0 &&
                ocppSession.tariff.billingType === 'billingTypeForBilling' &&
                ocppSession.paymentMethod !== 'notPay' &&
                new Date(ocppSession.stopDate) > new Date(Constants.sessions.sessionBillingStartDate) &&
                !(ocppSession.chargerType === "011" && ocppSession.clientName === "Salvador Caetano")
            ) {
                this.logger.log(`[${context}] OCPP session passed all filters`);
                filteredSessions.push(ocppSession);
            }

            this.logger.log(`[${context}] Total filtered sessions returned: ${filteredSessions.length}`);
            return filteredSessions;
        } catch (err) {
            this.logger.error(`[${context}] Error fetching ad-hoc session ${sessionId}: ${err.stack}`);
            throw new BadRequestException(`Failed to fetch ad-hoc session ${sessionId}`);
        }
    }

    private async adjustOcpiBillingPeriodIfUnknown(ocpiSession: Session): Promise<Session> {
        const context = 'adjustOcpiBillingPeriodIfUnknown';
        if (
            ocpiSession &&
            ocpiSession.paymentMethod === 'Unknown' &&
            ocpiSession.userIdToBillingInfo?._id
        ) {
            const billingProfile = await IdentityLibrary.findBillingProfileByUserId(ocpiSession.userIdToBillingInfo._id);
            if (billingProfile && billingProfile.billingPeriod) {

                await OcpiSessionRepository.updateSession(
                    ocpiSession._id,
                    { billingPeriod: billingProfile.billingPeriod }
                );

                ocpiSession.billingPeriod = billingProfile.billingPeriod;

                this.logger.log(`[${context}] OCPI session billingPeriod updated in the database to: ${billingProfile.billingPeriod} | idSession: ${ocpiSession.id}`);
            }
        }
        return ocpiSession;
    }

    getPeriodRangeFromEnv(period: string): { startDate: Date; endDate: Date } | null {
        const today = new Date();

        if (period === 'WEEKLY') {
            const targetDay = parseInt(process.env.WEEKLY_DAY_OF_WEEK || '1');
            if (today.getDay() !== targetDay) return null;

            const endDate = new Date(today);
            endDate.setDate(endDate.getDate() - 1);
            endDate.setHours(23, 59, 59, 999);

            const startDate = new Date(endDate);
            startDate.setDate(startDate.getDate() - 6);
            startDate.setHours(0, 0, 0, 0);

            return { startDate, endDate };
        }

        if (period === 'BI_WEEKLY') {
            const targetDays = (process.env.BIWEEKLY_DAYS_OF_MONTH || '8,16')
                .split(',')
                .map(Number);

            if (!targetDays.includes(today.getDate())) return null;

            const endDate = new Date(today);
            endDate.setDate(endDate.getDate() - 1);
            endDate.setHours(23, 59, 59, 999);

            const startDate = new Date(endDate);
            startDate.setDate(startDate.getDate() - 14);
            startDate.setHours(0, 0, 0, 0);

            return { startDate, endDate };
        }

        if (period === 'MONTHLY') {
            const targetDay = parseInt(process.env.MONTHLY_DAY_OF_MONTH || '8');
            if (today.getDate() !== targetDay) return null;

            const currentMonth = today.getMonth();
            const currentYear = today.getFullYear();

            const startDate = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0, 0);
            const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

            return { startDate, endDate };
        }

        return null;
    }

    /**
     * Groups sessions by user and processes them into invoices.
     * @param sessions list of Session
     */
    async groupAndProcessSessions(sessions: Session[], billingPeriod: string): Promise<void> {
        const sessionsByUser = this.collectorService.groupSessionsByUser(sessions);

        for (const [userId, userSessions] of sessionsByUser.entries()) {
            const groupedSessions = this.collectorService.groupUserSessionsByInvoiceCriteria(userSessions);

            for (const group of groupedSessions.values()) {
                try {
                    await this.processSessionGroupForUser(group, billingPeriod);
                } catch (error) {
                    this.logger.error(`Failed to create invoice for user ${userId}: ${error.message}`);
                }
            }
        }
    }

    /**
     * Processes a group of sessions for a user, handling invoice creation and related steps.
     */
    private async processSessionGroupForUser(
        group: Session[],
        billingPeriod: string
    ): Promise<void> {
        const context = 'processSessionGroupForUser';
        this.logger.log(`[${context}] Processing session group for user: ${group[0].userIdToBillingInfo._id}, sessions count: ${group.length}`);

        const latestDate = getLatestSessionDate(group);
        const endDate = latestDate ?? new Date().toISOString().split('T')[0];

        const totalExlVat = group.reduce((s, x) => s + (x.finalPrices?.totalPrice?.excl_vat || x.totalPrice?.excl_vat || 0), 0);
        const totalIncVat = group.reduce((s, x) => s + (x.finalPrices?.totalPrice?.incl_vat || x.totalPrice?.incl_vat || 0), 0);

        const firstSession = group[0];
        const invoiceType = firstSession.invoiceType;
        const communicationSetting = firstSession.invoiceCommunication;

        const sessionFileBaseName = `${group[0]._id}_${new Date().toISOString()}`;
        const fileName = buildS3FileName('session', sessionFileBaseName, 'json');
        const s3Url = await uploadFileToS3(Buffer.from(JSON.stringify(group)), fileName);

        if (!s3Url) throw new BadRequestException('Failed to upload sessions to S3');

        const mapDate = endDate
            ? `${endDate.slice(0, 4)}${endDate.slice(5, 7)}`
            : `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}`;

        const createdInvoice = await this.invoiceService.createInvoice({
            client_name: firstSession.clientName,
            billing_type: firstSession.billingPeriod,
            total_amount_exc_vat: totalExlVat,
            total_amount_inc_vat: totalIncVat,
            credited_amount_exc_vat: 0,
            currency: firstSession.currency,
            vat_country: firstSession.fees?.countryCode,
            vat_rate: firstSession.fees?.IVA,
            vies_vat: !!firstSession.viesVAT,
            status: InvoiceStatusId.Created,
            sessions: [],
            sessions_url: fileName,
            map_date: mapDate,
        });

        await this.fileReferenceService.saveFileReference({
            related_object_type: 'invoice',
            related_object_id: createdInvoice.id,
            file_type: 'session',
            file_purpose: FilePurpose.SESSION_JSON,
            file_url: s3Url,
        });

        await this.updateSessionsWithInvoiceId(group, createdInvoice.id);

        const invoiceCommunication = await this.attemptGetInvoiceCommunication(invoiceType, communicationSetting, firstSession, createdInvoice.id);
        if (!invoiceCommunication) return;

        await Promise.all(invoiceCommunication.map(item => this.invoiceCommunicationService.create(item)));

        const userIdToBillingInfo = await this.attemptBuildUserIdToBillingInfo(firstSession.userIdToBillingInfo._id, createdInvoice.id, invoiceCommunication[0].language);
        if (!userIdToBillingInfo) return;

        const invoiceBilling = await this.invoiceBillingService.create(userIdToBillingInfo);

        const vatCountry = this.vatStatusService.resolveVatCountry(group);
        const vatStatus = await this.vatStatusService.getVatStatus(firstSession, vatCountry);

        // For periodic invoice when payment method is 'transfer' its necessary to create transaction and payment
        if (firstSession.paymentMethod === 'transfer') {
            const transaction = await this.paymentService.createTransaction(group, createdInvoice, invoiceBilling.user_id);
            await this.paymentService.createPayment(group, createdInvoice, billingPeriod, invoiceBilling.user_id, transaction._id!);
        }

        let paymentPeriod = group[0].userIdWillPayInfo?.paymentPeriod || group[0].paymentType || '';
        if (paymentPeriod === 'PROMPT_PAYMENT') {
            paymentPeriod = 'AD_HOC';
        }
        const layout = await this.invoiceLayoutService.findLayoutByClientAndLanguage(
            firstSession.clientName,
            invoiceCommunication[0].language,
            InvoiceLayoutType.Invoice,
            paymentPeriod
        );

        if (!layout) throw new Error(`Invoice layout not found for given client and language | invoiceId: ${createdInvoice.id}`);

        const paymentConditions = await this.paymentConditionsRepository.findOne({
            where: { id: invoiceBilling?.payment_conditions_id! },
        });

        const codeDescription = firstSession.country_code == 'PT' ? 'SERV221021' : 'SERV221022';
        const description = getServiceDescription(codeDescription, invoiceCommunication[0].language);

        let exemptionReasonCode;
        let descriptionExemption;
        if (vatStatus?.tab_iva?.toString() === '4') {
            const taxExemption = await this.taxExemptionService.getTaxExemptionByLanguage(invoiceBilling.country_code);
            exemptionReasonCode = taxExemption.code;
            descriptionExemption = taxExemption.description;
        }

        const invoicePayload = this.invoiceService.buildInvoicePayload({
            createdInvoiceId: createdInvoice.id,
            invoiceBilling,
            group,
            vatStatus,
            vatCountry: vatCountry ?? '',
            doctype: layout.doctype,
            documentlayout: layout.id.toString(),
            printtypeid: layout.printtypeid,
            originSession: createdInvoice.vat_country === "PT" ? "ISERV21021" : "ISERV21022",
            paymentConditions: paymentConditions,
            endDate,
            description,
            codmotivoisencao: exemptionReasonCode,
            motivoisencao: descriptionExemption,
        });
        this.logger.log(`[${context}] Creating invoice with payload: ${JSON.stringify(invoicePayload)}`);

        const invoiceProcessed = await this.billingService.issueInvoice(invoicePayload);

        await this.sessionInvoiceService.insertInvoiceData(invoiceProcessed, firstSession, invoiceBilling);
        await this.updateSessionInvoiceNumbers(group, invoiceProcessed);

        const attachments = await this.prepareAttachments(invoiceProcessed, invoiceBilling, invoiceCommunication, group);

        await this.invoiceEmailService.sendInvoiceEmails(invoiceCommunication, attachments, createdInvoice.id, createdInvoice.client_name, invoiceProcessed.invoice_number, firstSession._id);
    }

    /**
     * Attempts to get invoice communication, returns null on error.
     */
    private async attemptGetInvoiceCommunication(
        invoiceType: InvoiceType,
        communicationSetting: string,
        session: Session,
        invoiceId: string
    ): Promise<InvoiceCommunicationItem[] | null> {
        try {
            return await this.getInvoiceCommunication(invoiceType, communicationSetting as InvoiceCommunication, session, invoiceId);
        } catch (error) {
            this.logger.warn(error.message);
            return null;
        }
    }

    /**
     * Attempts to build user billing info, logging and skipping on error.
     */
    private async attemptBuildUserIdToBillingInfo(
        userId: string,
        invoiceId: string,
        language: string
    ): Promise<UserIdToBillingInfo | null> {
        try {
            return await this.buildUserIdToBillingInfo(userId, invoiceId, language);
        } catch (error) {
            this.logger.warn(error.message);
            return null;
        }
    }

    /**
     * Updates all sessions in the group with the invoice ID.
     */
    private async updateSessionsWithInvoiceId(group: Session[], invoiceId: string): Promise<void> {
        const sessionIdsEVIO: string[] = [];
        const sessionIdsOCPI: string[] = [];

        for (const session of group) {
            const sessionNetwork = session.network || session.source;
            if (sessionNetwork === 'EVIO') {
                sessionIdsEVIO.push(session._id);
            } else {
                sessionIdsOCPI.push(session.id);
            }
        }

        try {
            if (sessionIdsEVIO.length > 0) {
                const updatedEVIO = await ChargerLibrary.updateNewInvoiceIdByIds(sessionIdsEVIO, invoiceId, true);
                this.logger.log(`[updateSessionsWithInvoiceId] Updated EVIO sessions: ${updatedEVIO}`);
            }
            if (sessionIdsOCPI.length > 0) {
                const updatedOCPI = await OcpiSessionRepository.updateNewInvoiceIdByIds(sessionIdsOCPI, invoiceId, true);
                this.logger.log(`[updateSessionsWithInvoiceId] Updated OCPI sessions: ${updatedOCPI}`);
            }
        } catch (error) {
            this.logger.error(`Failed to update invoice IDs for sessions | invoiceId: ${invoiceId} | error: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Updates session invoice numbers after invoice is processed.
     */
    private async updateSessionInvoiceNumbers(group: Session[], invoiceProcessed: Invoice): Promise<void> {
        const sessionNetwork = group[0].network || group[0].source;
        if (sessionNetwork) {
            for (const session of group) {
                await this.sessionInvoiceService.updateSessionInvoiceNumber(session, sessionNetwork, invoiceProcessed);

                const payload = {
                    sessionId: session._id,
                    origin: sessionNetwork == 'EVIO' ? 'ocpp' : 'ocpi22',
                    from: `service billing_v2 - Updating invoice number`,
                };
                await sendMessage(payload, 'session_history_v2_key');
            }
        }
    }

    /**
     * Core logic to convert a list of sessions into an invoice.
     * @param sessions list of Session objects
     */
    private async processSessionGroup(sessions: Session[]): Promise<Invoice> {
        const totalExc = sessions.reduce((s, x) => s + (x.finalPrices?.totalPrice?.excl_vat || x.totalPrice?.excl_vat || 0), 0);
        const totalInc = sessions.reduce((s, x) => s + (x.finalPrices?.totalPrice?.incl_vat || x.totalPrice?.incl_vat || 0), 0);

        this.logger.log(`[processSessionGroup] Client: ${sessions[0].clientName} | Total excl. VAT: ${totalExc.toFixed(2)} | Total incl. VAT: ${totalInc.toFixed(2)}`);

        const sessionFileBaseName = `${sessions[0]._id}_${new Date().toISOString()}`;
        const fileName = buildS3FileName('session', sessionFileBaseName, 'json');
        const s3Url = await uploadFileToS3(Buffer.from(JSON.stringify(sessions)), fileName);
        this.logger.log(`[processSessionGroup] S3 upload result: ${s3Url}`);

        if (!s3Url) {
            this.logger.error('Failed to upload sessions to S3');
            throw new BadRequestException('Failed to upload sessions to S3');
        }

        const vatCountry = this.vatStatusService.resolveVatCountry(sessions);
        const createdInvoice = await this.invoiceService.createInvoice({
            client_name: sessions[0].clientName,
            billing_type: sessions[0].billingPeriod,
            total_amount_exc_vat: totalExc,
            total_amount_inc_vat: totalInc,
            credited_amount_exc_vat: 0,
            currency: sessions[0].currency,
            vat_country: vatCountry,
            vat_rate: sessions[0].fees?.IVA,
            vies_vat: !!sessions[0].viesVAT,
            status: InvoiceStatusId.Created,
            sessions: [],
            sessions_url: fileName,
        });

        await this.fileReferenceService.saveFileReference({
            related_object_type: 'invoice',
            related_object_id: createdInvoice.id,
            file_type: 'session',
            file_purpose: FilePurpose.SESSION_JSON,
            file_url: s3Url,
        });

        const updatePromises = sessions.map(async (session) => {
            try {
                let updated = false;
                const sessionNetwork = session.network || session.source;

                this.logger.log(`Updating invoice ID for session ${session._id} with network type ${sessionNetwork}`);
                // OCPP
                if (sessionNetwork == 'EVIO') {
                    updated = await ChargerLibrary.updateNewInvoiceIdById(session._id, createdInvoice.id, true);
                }
                // OCPI
                else {
                    updated = await OcpiSessionRepository.updateNewInvoiceIdById(session.id, createdInvoice.id, true);
                }
                if (updated) {
                    this.logger.log('Invoice ID updated successfully!', { sessionId: session._id });
                } else {
                    this.logger.log('No changes were made.', { sessionId: session._id });
                }
            } catch (error) {
                this.logger.error(`Failed to update invoice ID for session ${session._id}: ${error.message}`, error.stack);
                throw error;
            }
        });
        await Promise.all(updatePromises);


        return createdInvoice;
    }

    /**
       * Generates invoice communication items based on type and settings.
       * @param invoiceType Type of invoice
       * @param communicationSetting Communication setting
       * @param sessionData Session data
       * @param invoiceId Invoice ID
       * @returns Array of communication items
       */
    async getInvoiceCommunication(
        invoiceType: InvoiceType,
        communicationSetting: InvoiceCommunication,
        sessionData: Session,
        invoiceId: string,
    ): Promise<InvoiceCommunicationItem[]> {
        const context = 'Function getInvoiceCommunication';
        const [user, billingProfile] = await Promise.all([
            IdentityLibrary.findUserById(sessionData.userId),
            IdentityLibrary.findBillingProfileByUserId(sessionData.userIdToBillingInfo._id),
        ]);

        if (!billingProfile) {
            this.logger.error(`Billing profile not found for userId: ${sessionData.userIdToBillingInfo._id}`);
            throw new Error(`Billing profile not found for userId: ${sessionData.userIdToBillingInfo._id}`);
        }

        if (!user) {
            this.logger.error(`[${context}] User not found for userId: ${sessionData.userId}`);
        }

        const billingName = billingProfile.billingName ?? billingProfile.name;
        const language = user?.language?.toUpperCase() ?? 'EN-GB';
        const type = billingProfile?.clientType === 'PRIVATECUSTOMER' ? 'b2c' : 'b2b';

        this.logger.log(`[${context}] userId: ${sessionData?.userId}, billingProfile email: ${billingProfile.email}, user email: ${user?.email}`);
        const resolvedEmail = billingProfile.email ?? user?.email;
        if (!resolvedEmail) {
            this.logger.error(`[${context}] No email found for userId: ${sessionData.userId}`);
            throw new Error(`No email found for userId: ${sessionData.userId}`);
        }

        const buildCommunication = (name: string, emails: string, userId: string): InvoiceCommunicationItem[] => {
            this.logger.log(`[${context}] Building communication items for userId: ${userId}`);
            return emails
                .split(';')
                .map(email => email.trim())
                .filter(email => email.length > 0)
                .map(email => ({
                    invoice_id: invoiceId,
                    user_id: userId,
                    name,
                    email,
                    language,
                    client_type: type,
                }));
        };

        // when invoiceType is empty, consider it as INVOICES_INCLUDED
        const realInvoiceType = invoiceType || InvoiceType.INVOICE_INCLUDED;
        // when communicationSetting is empty, consider it as ONLY_COMPANY
        const finalCommunicationSetting = communicationSetting || InvoiceCommunication.ONLY_COMPANY;

        if (realInvoiceType !== InvoiceType.INVOICE_INDIVIDUAL) {
            return buildCommunication(billingName, resolvedEmail, billingProfile.userId);
        }

        switch (finalCommunicationSetting) {
            case InvoiceCommunication.ONLY_DRIVER:
                return buildCommunication(billingName, resolvedEmail, sessionData.userId);
            case InvoiceCommunication.ONLY_COMPANY: {
                return buildCommunication(billingName, resolvedEmail, sessionData.userIdToBillingInfo._id);
            }
            case InvoiceCommunication.DRIVER_COMPANY: {
                return [
                    ...buildCommunication(billingName, resolvedEmail, sessionData.userIdToBillingInfo._id),
                    ...buildCommunication(billingName, resolvedEmail, billingProfile.userId),
                ];
            }
            default:
                return buildCommunication(billingName, resolvedEmail, sessionData.userId);
        }
    }

    /**
       * Generates APT invoice communication items based on type and settings.
       * @param invoiceType Type of invoice
       * @param communicationSetting Communication setting
       * @param sessionData Session data
       * @param invoiceId Invoice ID
       * @returns Array of communication items
       */
    async getAPTInvoiceCommunication(
        invoiceType: InvoiceType,
        communicationSetting: InvoiceCommunication,
        sessionData: Session,
        invoiceId: string,
    ): Promise<InvoiceCommunicationItem[]> {
        const context = 'Function getAPTInvoiceCommunication';

        const userIdToBillingInfo = sessionData.userIdToBillingInfo;

        const billingName = userIdToBillingInfo.name;
        const language = userIdToBillingInfo.language?.toUpperCase() ?? 'EN-GB';
        const type = userIdToBillingInfo.clientType === 'PRIVATECUSTOMER' ? 'b2c' : 'b2b';
        const email = userIdToBillingInfo.email;

        if (!billingName || !email) {
            this.logger.error(`[${context}] No billing info found for userId: ${sessionData.userIdToBillingInfo._id} || email: ${email} || name: ${billingName}`);
            throw new Error(`No billing info found for userId: ${sessionData.userIdToBillingInfo._id}`);
        }

        const buildCommunication = (name: string, emails: string, userId?: string): InvoiceCommunicationItem[] => {
            this.logger.log(`[${context}] Building communication items for userId: ${userId}`);
            return emails
                .split(';')
                .map(email => email.trim())
                .filter(email => email.length > 0)
                .map(email => ({
                    invoice_id: invoiceId,
                    user_id: userId,
                    name,
                    email,
                    language,
                    client_type: type,
                }));
        };

        // when invoiceType is empty, consider it as INVOICES_INCLUDED
        const realInvoiceType = invoiceType || InvoiceType.INVOICE_INCLUDED;
        // when communicationSetting is empty, consider it as ONLY_COMPANY
        const finalCommunicationSetting = communicationSetting || InvoiceCommunication.ONLY_COMPANY;

        if (realInvoiceType !== InvoiceType.INVOICE_INDIVIDUAL) {
            return buildCommunication(billingName, email);
        }

        switch (finalCommunicationSetting) {
            case InvoiceCommunication.ONLY_DRIVER:
                return buildCommunication(billingName, email);
            case InvoiceCommunication.ONLY_COMPANY: {
                return buildCommunication(billingName, email);
            }
            case InvoiceCommunication.DRIVER_COMPANY: {
                return [
                    ...buildCommunication(billingName, email),
                    ...buildCommunication(billingName, email),
                ];
            }
            default:
                return buildCommunication(billingName, email);
        }
    }

    /**
     * Builds user ID to billing info object.
     * @param userIdToBilling User ID for billing
     * @param invoiceId Invoice ID
     * @returns Billing info object
     */
    async buildUserIdToBillingInfo(userIdToBilling: string, invoiceId: string, language: string): Promise<UserIdToBillingInfo> {
        const context = 'Function buildUserIdToBillingInfo';
        this.logger.log(`[${context}] Building billing info for userId: ${userIdToBilling}, invoiceId: ${invoiceId}`);
        const billingProfile = await IdentityLibrary.findBillingProfileByUserId(userIdToBilling);

        if (!billingProfile) {
            this.logger.error(`[${context}][Error] Billing profile not found for userId: ${userIdToBilling}`);
            throw new BadRequestException(`Billing profile not found for userId: ${userIdToBilling}`);
        }

        // // Do not generate invoice if TIN belongs to EVIO
        if (billingProfile.nif === Constants.evioUser.nif) {
            this.logger.error(`[${context}][Error] Billing profile TIN number is invalid for userId: ${userIdToBilling} | EVIO TIN number`);
            throw new BadRequestException(`Tin number is invalid for billing profile of userId: ${userIdToBilling} | EVIO TIN number`);
        }

        const billingName = billingProfile.billingName ?? billingProfile.name;
        const type = billingProfile.clientType === 'PRIVATECUSTOMER' ? 'b2c' : 'b2b';

        let paymentConditionId: PaymentConditionsId | null = null;

        const paymentConditionString = billingProfile.paymentConditions?.trim();
        const languageNormalized = normalizeLanguage(language);

        if (paymentConditionString && language) {
            const mappingByLanguage = PaymentConditionStringToEnumByLang[languageNormalized];
            if (!mappingByLanguage) {
                throw new BadRequestException(`Unsupported language: ${language}`);
            }

            paymentConditionId = mappingByLanguage[paymentConditionString];
            if (!paymentConditionId) {
                this.logger.warn(`[buildUserIdToBillingInfo] Unknown payment condition: ${paymentConditionString} for language: ${language}`);
            }
        }

        this.logger.log(`[${context}] Billing info built successfully for userId: ${userIdToBilling}, invoiceId: ${invoiceId}`);
        return {
            user_id: billingProfile.userId,
            invoice_id: invoiceId,
            name: billingName,
            vat_number: billingProfile.nif,
            client_type: type,
            street: billingProfile.billingAddress?.street ?? ' ',
            number: billingProfile.billingAddress?.number ?? ' ',
            floor: billingProfile.billingAddress?.floor ?? ' ',
            zip_code: billingProfile.billingAddress?.zipCode ?? ' ',
            purchase_order: billingProfile.purchaseOrder ?? ' ',
            payment_conditions_id: paymentConditionId,
            city: billingProfile.billingAddress?.city ?? ' ',
            state: billingProfile.billingAddress?.state ?? ' ',
            country: billingProfile.billingAddress?.country ?? ' ',
            country_code: billingProfile.billingAddress?.countryCode ?? ' '
        };
    }

    /**
     * Builds user ID to billing info object for APT.
     * @param userIdToBilling User ID for billing
     * @param invoiceId Invoice ID
     * @returns Billing info object
     */
    async buildAPTUserIdToBillingInfo(session: Session, invoiceId: string): Promise<UserIdToBillingInfo> {
        const context = 'Function buildAPTUserIdToBillingInfo';
        this.logger.log(`[${context}] Building billing info for invoiceId: ${invoiceId}`);
        const billingProfile = session.userIdToBillingInfo;

        if (!billingProfile) {
            this.logger.error(`[${context}][Error] Billing profile not found for invoiceId: ${invoiceId}`);
            throw new BadRequestException(`Billing profile not found for invoiceId: ${invoiceId}`);
        }

        const language = billingProfile.language?.toUpperCase() || 'EN-GB';
        const billingName = billingProfile.name;
        const type = billingProfile.clientType === 'PRIVATECUSTOMER' ? 'b2c' : 'b2b';

        let paymentConditionId: PaymentConditionsId | null = null;

        const paymentConditionString = "Prompt_Payment";
        const languageNormalized = normalizeLanguage(language);

        if (paymentConditionString && language) {
            const mappingByLanguage = PaymentConditionStringToEnumByLang[languageNormalized];
            if (!mappingByLanguage) {
                throw new BadRequestException(`Unsupported language: ${language}`);
            }

            paymentConditionId = mappingByLanguage[paymentConditionString];
            if (!paymentConditionId) {
                this.logger.warn(`[${context}] Unknown payment condition: ${paymentConditionString} for language: ${language}`);
            }
        }

        return {
            user_id: billingProfile.userId,
            invoice_id: invoiceId,
            name: billingName,
            vat_number: billingProfile.tin,
            client_type: type,
            street: billingProfile.address?.street ?? '',
            number: billingProfile.address?.number ?? '',
            floor: billingProfile.address?.floor ?? '',
            zip_code: billingProfile.address?.postalCode ?? '',
            purchase_order: billingProfile.purchaseOrder ?? '',
            payment_conditions_id: paymentConditionId,
            city: billingProfile.address?.city ?? '',
            state: billingProfile.address?.state ?? '',
            country: billingProfile.address?.country ?? '',
            country_code: billingProfile.address?.countryCode ?? ''
        };
    }

    /**
     * Sends an invoice email with an Excel attachment to the specified recipient.
     *
     * @param name - Name of the user to be used in the email content
     * @param countryCode - VAT country code for localization
     * @param excelBuffer - Buffer containing the generated Excel file
     * @param email - Recipient email address
     */
    async sendInvoiceEmailWithAttachment(
        name: string,
        language: string,
        attachments: any,
        email: string | string[],
        invoiceId: string,
        clientName: string,
        invoiceNumber: string,
        sessionId: string,
        emailCC?: string
    ): Promise<void> {
        const context = 'sendInvoiceEmailWithAttachment';
        this.logger.log(`[${context}] Preparing to send invoice email to: ${email}, invoiceId: ${invoiceId}`);
        // Generate the HTML content of the email
        const htmlContent = await this.mailService.prepareEmailHtml(name, language, clientName);

        // Determine the subject of the email based on the country code
        let subject = (language === 'PT' || language === 'PT_PT')
            ? Constants.email.subject.INVOICE_PT
            : Constants.email.subject.INVOICE_EN;

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
            attachments,
            clientName: clientName
        });

        await this.auditLogService.logAction({
            objectType: 'invoice',
            relatedObjectId: invoiceId,
            action: 'send_invoice_email',
            oldValue: { "email_sent": false },
            newValue: { "email_sent": true },
            description: `Invoice email successfully sent to customer.`,
            triggeredBy: 'system',
        });

        this.logger.log(`Email with Excel attachment sent successfully`);
    }

    private async createInvoiceForSessions(sessions: Session[]): Promise<Invoice> {
        this.logger.log(`Creating invoice for session(s)...`);
        const invoiceCreated = await this.processAdHocSession(sessions);
        this.logger.log(`✅ Invoice created with id: ${invoiceCreated.id}`);
        return invoiceCreated;
    }

    private async createInvoiceCommunications(session: Session, invoiceId: string): Promise<InvoiceCommunicationItem[]> {
        this.logger.log(`Generating invoice communication entries...`);
        const getInvoiceCommunication = session.createdWay === 'APT_START_SESSION' ? this.getAPTInvoiceCommunication.bind(this) : this.getInvoiceCommunication.bind(this);

        this.logger.log(`Session network is APT, using APT-specific communication generation.`);
        const entries: InvoiceCommunicationItem[] = await getInvoiceCommunication(
            session.invoiceType,
            session.invoiceCommunication,
            session,
            invoiceId,
        );

        this.logger.log(`✅ Invoice communication entries to create: ${entries.length}`);
        await Promise.all(entries.map(item => this.invoiceCommunicationService.create(item)));
        this.logger.log(`✅ Invoice communication records created successfully`);
        return entries;
    }

    private async createInvoiceBilling(session: Session, invoiceId: string, language: string): Promise<InvoiceBilling> {
        this.logger.log(`Creating invoice billing record...`);
        let billingData: UserIdToBillingInfo;
        if (session.createdWay === 'APT_START_SESSION') {
            this.logger.log(`Session network is APT, using APT-specific billing info generation. invoiceId: ${invoiceId}`);
            billingData = await this.buildAPTUserIdToBillingInfo(session, invoiceId);
        }
        else {
            billingData = await this.buildUserIdToBillingInfo(session.userIdToBillingInfo._id, invoiceId, language);
        }

        const billing = await this.invoiceBillingService.create(billingData);
        this.logger.log(`✅ Invoice billing created for user: ${billingData.user_id}`);

        return billing;
    }

    private async getInvoiceLayout(client: string, language: string, paymentPeriod: string): Promise<{ id: string; doctype: string; printtypeid: string, linkedCreditNoteId?: number }> {
        this.logger.log(`Searching for invoice layout by client and language...`);
        const layout = await this.invoiceLayoutService.findLayoutByClientAndLanguage(client, language, InvoiceLayoutType.Invoice, paymentPeriod);
        if (!layout) {
            this.logger.error(`❌ Invoice layout not found for client: ${client}, language: ${language}`);
            throw new Error('Invoice layout not found for given client and language');
        }
        this.logger.log(`✅ Layout resolved with ID: ${layout.id.toString()}`);
        return {
            id: layout.id.toString(),
            doctype: layout.doctype,
            printtypeid: layout.printtypeid.toString(),
            linkedCreditNoteId: layout.linked_credit_note_id ? Number(layout.linked_credit_note_id) : undefined,
        };
    }

    private async getPaymentConditions(id?: number): Promise<PaymentConditions | null> {
        if (!id) return null;
        this.logger.log(`Fetching PaymentConditions from repository...`);
        return await this.paymentConditionsRepository.findOne({ where: { id } });
    }

    async prepareAttachments(
        invoiceProcessed: Invoice,
        invoiceBilling: InvoiceBilling,
        invoiceCommunication: InvoiceCommunicationItem[],
        sessions: Session[]
    ): Promise<Attachment[]> {
        const attachments: Attachment[] = [];

        this.logger.log(`Retrieving invoice PDF from PHC...`);
        if (!invoiceProcessed.invoice_number) {
            throw new Error('Invoice number is undefined');
        }
        let invoicePhcPdf;
        try {
            invoicePhcPdf = await this.billingService.getDocument(invoiceProcessed.invoice_number);
            if (!invoicePhcPdf) {
                this.logger.warn(`No PDF found for invoice number: ${invoiceProcessed.invoice_number}`);
                throw new Error(`No PDF found for invoice number: ${invoiceProcessed.invoice_number}`);
            }
        } catch (error) {
            this.logger.error(`❌ Error retrieving invoice PDF from PHC: ${error.message}`);
            const payload = { invoiceId: invoiceProcessed.id };
            await sendMessage({ method: 'fetchEmailProcess', payload }, 'billing_v2_key');
            throw new Error(`Failed to retrieve invoice PDF: ${error.message}`);
        }

        const filepath = await this.billingService.uploadDocument(invoicePhcPdf, 'invoice', invoiceProcessed.invoice_number);
        await this.fileReferenceService.saveFileReference({
            related_object_type: 'invoice',
            related_object_id: invoiceProcessed.id,
            file_type: 'invoice',
            file_purpose: FilePurpose.OFFICIAL_INVOICE,
            file_url: filepath,
        });

        try {
            attachments.push({
                filename: `${invoiceProcessed.invoice_number}.pdf`,
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
                invoiceNumber: invoiceProcessed.invoice_number,
                invoiceBilling,
                isAdHoc
            }, cdrExtension);

            const pdfResumeCreated = await this.invoicePdfService.generatePdf(pdfResumePayload);
            attachments.push({
                filename: `resumo_${invoiceCommunication[0].name.trim()}_${invoiceProcessed.invoice_number}.pdf`,
                content: pdfResumeCreated,
                contentType: 'application/pdf',
                encoding: 'base64',
            });
            this.logger.log(`✅ PDF resume generated and added to attachments`);

            const filepath = await this.billingService.uploadDocument(pdfResumeCreated, 'detailed_pdf', invoiceProcessed.invoice_number);
            await this.fileReferenceService.saveFileReference({
                related_object_type: 'invoice',
                related_object_id: invoiceProcessed.id,
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
                    invoiceProcessed.id,
                    invoiceProcessed.invoice_number,
                    endDate,
                    isAdHoc,
                    cdrExtension,
                    InvoiceLayoutType.Invoice
                );
                attachments.push({
                    filename: `resumo_${invoiceCommunication[0].name.trim()}_${invoiceProcessed.invoice_number}.xlsx`,
                    content: excelBuffer,
                    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    encoding: 'base64',
                });
            }

        } catch (error) {
            this.logger.error(`❌ Error preparing attachments: ${error.message}`);
            const payload = { invoiceId: invoiceProcessed.id };
            await sendMessage({ method: 'attachmentsProcess', payload }, 'billing_v2_key');
            throw new Error(`Failed to prepare attachments: ${error.message}`);
        }

        return attachments;
    }
    private async loadInvoiceDependencies(invoiceId: string) {
        const invoice = await this.invoiceService.findInvoiceById(invoiceId);
        if (!invoice || !invoice.invoice_number) {
            const invoiceIdMsg = invoice ? invoice.id : invoiceId;
            this.logger.error(`❌ Invoice number is undefined for invoice ID: ${invoiceIdMsg}`);
            throw new Error(`Invalid invoice number for invoice ID: ${invoiceIdMsg}`);
        }

        const billing = await this.invoiceBillingService.findByInvoiceId(invoice.id);
        const communication = await this.invoiceCommunicationService.findByInvoiceId(invoice.id);
        if (!communication) {
            this.logger.error(`❌ Invoice communication is null for invoice ID: ${invoice.id}`);
            throw new Error(`Invoice communication is null for invoice ID: ${invoice.id}`);
        }

        const communicationItems: InvoiceCommunicationItem[] = Array.isArray(communication)
            ? communication.map(item => ({
                invoice_id: invoice.id,
                client_type: item.client_type,
                email: item.email,
                language: normalizeLanguage(item.language) || 'en',
                name: item.name,
                user_id: item.user_id
            }))
            : [{
                invoice_id: invoice.id,
                client_type: communication.client_type,
                email: communication.email,
                language: normalizeLanguage(communication.language) || 'en',
                name: communication.name,
                user_id: communication.user_id
            }];

        if (!billing || !communicationItems || (!invoice.sessions && !invoice.sessions_url)) {
            this.logger.error(`❌ Missing billing or communication data for invoice ID: ${invoice.id}`);
            throw new Error(`Missing billing or communication data for invoice ID: ${invoice.id}`);
        }

        return { invoice, billing, communicationItems };
    }

    async processFetchPdfFromProvider(invoiceId: string): Promise<void> {
        const context = 'processFetchPdfFromProvider';
        this.logger.log(`[${context}] Starting PDF fetch for invoice ID: ${invoiceId}`);
        const { invoice, billing, communicationItems } = await this.loadInvoiceDependencies(invoiceId);

        this.logger.log(`[${context}] Processing PDF fetch for invoice: ${invoice.id}`);

        if (!invoice.invoice_number) {
            this.logger.error(`[${context}] ❌ Invoice number is undefined for invoice ID: ${invoice.id}`);
            throw new Error(`Invoice number is undefined for invoice ID: ${invoice.id}`);
        }

        this.logger.log(`[${context}] Preparing attachments for invoice ID: ${invoice.id}`);
        let sessions = invoice.sessions;
        if (!sessions || sessions.length === 0) {
            sessions = await this.loadSessionsFromInvoice(invoice);
        }

        const attachments = await this.prepareAttachments(
            invoice,
            billing,
            communicationItems,
            sessions ?? []
        );

        this.logger.log(`[${context}] Sending invoice emails for invoice ID: ${invoice.id}`);
        await this.invoiceEmailService.sendInvoiceEmails(
            communicationItems,
            attachments,
            invoice.id,
            invoice.client_name,
            sessions[0].documentNumber || invoice.invoice_number,
            sessions[0]._id
        );

    }

    async generatePdfFromProvider(invoiceId: string): Promise<void> {
        this.logger.log(`Generating PDF from provider for invoice ID: ${invoiceId}`);
        const invoice = await this.invoiceService.findInvoiceById(invoiceId);
        if (!invoice) {
            this.logger.error(`❌ Invoice not found for ID: ${invoiceId}`);
            throw new Error(`Invoice not found for ID: ${invoiceId}`);
        }

        if (invoice.third_party_id) {
            this.logger.error(`❌ Third party ID exists for invoice ID: ${invoiceId}`);
            throw new Error(`Third party ID exists for invoice ID ${invoiceId}`);
        }

        let sessions = invoice.sessions;
        if (!sessions || sessions.length === 0) {
            sessions = await this.loadSessionsFromInvoice(invoice);
        }

        if (!sessions || sessions.length === 0) {
            this.logger.error(`❌ No sessions found for invoice ID: ${invoiceId}`);
            throw new Error(`No sessions found for invoice ID: ${invoiceId}`);
        }

        const vatCountry = this.vatStatusService.resolveVatCountry(sessions);
        const vatStatus = await this.vatStatusService.getVatStatus(sessions[0], vatCountry);

        const communication = await this.invoiceCommunicationService.findAllByInvoiceId(invoiceId);
        const billing = await this.invoiceBillingService.findByInvoiceId(invoiceId);
        if (!billing) {
            this.logger.error(`❌ Invoice billing is null for invoice ID: ${invoice.id}`);
            throw new Error(`Invoice billing is null for invoice ID: ${invoice.id}`);
        }

        let paymentPeriod = sessions[0].userIdWillPayInfo?.paymentPeriod || sessions[0].paymentType || '';
        if (paymentPeriod === 'PROMPT_PAYMENT') {
            paymentPeriod = 'AD_HOC';
        }
        const layout = await this.getInvoiceLayout(sessions[0].clientName, communication[0].language, paymentPeriod);
        if (!layout) {
            this.logger.error(`❌ Invoice layout not found for client: ${sessions[0].clientName}, language: ${communication[0].language}`);
            throw new Error(`Invoice layout not found for client: ${sessions[0].clientName}, language: ${communication[0].language}`);
        }
        // Update invoice_layout_id in invoice with the linked credit note layout if available
        await this.invoiceService.updateInvoice(
            { id: invoice.id },
            {
                invoice_layout_id: layout.linkedCreditNoteId ?? undefined
            },
        );

        const paymentConditions = await this.getPaymentConditions(Number(billing.payment_conditions_id));
        if (!paymentConditions) {
            this.logger.warn(`Payment conditions not found for ID: ${billing.payment_conditions_id}`);
        }

        const codeDescription = sessions[0].country_code == 'PT' ? 'SERV221021' : 'SERV221022';
        const description = getServiceDescription(codeDescription, communication[0].language);

        // If the VAT status is '4', meaning 0% VAT, we need to fetch tax exemption details
        let exemptionReasonCode;
        let descriptionExemption;
        if (vatStatus?.tab_iva?.toString() === '4') {
            const taxExemption = await this.taxExemptionService.getTaxExemptionByLanguage(billing.country_code);
            exemptionReasonCode = taxExemption.code;
            descriptionExemption = taxExemption.description;
        }

        const invoicePayload = this.invoiceService.buildInvoicePayload({
            createdInvoiceId: invoice.id,
            invoiceBilling: billing,
            group: sessions,
            vatStatus,
            vatCountry,
            doctype: layout.doctype,
            documentlayout: layout.id.toString(),
            printtypeid: layout.printtypeid,
            originSession: invoice.vat_country === "PT" ? "ISERV21021" : "ISERV21022",
            paymentConditions,
            description,
            codmotivoisencao: exemptionReasonCode,
            motivoisencao: descriptionExemption
        });

        this.logger.log(`Creating invoice with payload: ${JSON.stringify(invoicePayload)}`);
        const invoiceProcessed = await this.billingService.issueInvoice(invoicePayload);
        this.logger.log(`✅ Invoice processed with ID: ${invoiceProcessed.id}`);

        await this.processFetchPdfFromProvider(invoice.id);
    }

    async processSendEmail(invoiceId: string): Promise<void> {
        const { invoice, billing, communicationItems } = await this.loadInvoiceDependencies(invoiceId);
        this.logger.log(`Processing send email for invoice: ${invoice.id}`);

        let sessions = invoice.sessions;
        if (!sessions || sessions.length === 0) {
            sessions = await this.loadSessionsFromInvoice(invoice);
        }

        const attachments = await this.prepareAttachments(
            invoice,
            billing,
            communicationItems,
            sessions ?? []
        );

        await this.invoiceEmailService.sendInvoiceEmails(
            communicationItems,
            attachments,
            invoice.id,
            invoice.client_name,
            invoice.invoice_number || '',
            sessions[0]._id
        );
        this.logger.log(`✅ Email sent successfully for invoice ID: ${invoice.id}`);

    }

    /**
     * Returns the start and end Date objects for yesterday.
     */
    private getYesterdayRange(): { start: Date; end: Date } {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        const endOfYesterday = new Date(yesterday);
        endOfYesterday.setHours(23, 59, 59, 999);
        return { start: yesterday, end: endOfYesterday };
    }

    async getAdHocMissingSessions(): Promise<Session[]> {
        const context = 'getAdHocMissingSessions';
        this.logger.log(`[${context}] Fetching ad-hoc sessions from previous day without invoiceId`);

        const { start, end } = this.getYesterdayRange();
        const sessionBillingStartDate = new Date(Constants.sessions.sessionBillingStartDate);

        this.logger.log(`[${context}] Start: ${start.toISOString()}, End: ${end.toISOString()}`);

        // OCPI query
        const queryOCPI = {
            billingPeriod: 'AD_HOC',
            invoiceId: null,
            userIdToBillingInfo: { $exists: true, $ne: null },
            status: 'COMPLETED',
            cdrId: { $ne: '-1' },
            'finalPrices.totalPrice.incl_vat': { $gt: 0 },
            end_date_time: {
                $gte: sessionBillingStartDate.toISOString(),
                $lte: end.toISOString()
            },
            'userIdToBillingInfo._id': { $ne: Constants.evioUser.userId } // Exclude internal EVIO user
        };

        // OCPP query
        const queryOCPP = {
            billingPeriod: 'AD_HOC',
            invoiceId: null,
            userIdToBillingInfo: { $exists: true, $ne: null },
            status: '40',
            totalPower: { $gt: 0 },
            timeCharged: { $gt: 60 },
            'totalPrice.incl_vat': { $gt: 0 },
            'tariff.billingType': 'billingTypeForBilling',
            'paymentMethod': { $ne: 'notPay' },
            stopDate: {
                $gte: sessionBillingStartDate.toISOString(),
                $lte: end.toISOString()
            },
            $nor: [
                { chargerType: "011", clientName: "Salvador Caetano" } // Remove in the future
            ],
            'userIdToBillingInfo._id': { $ne: Constants.evioUser.userId } // Exclude internal EVIO user
        };

        this.logger.log(`[${context}] Query OCPI: ${JSON.stringify(queryOCPI)}`);
        this.logger.log(`[${context}] Query OCPP: ${JSON.stringify(queryOCPP)}`);

        try {
            let sessionsOCPI = await OcpiSessionRepository.findSessionsByQuery(queryOCPI);
            // Adjust billing period if unknown
            sessionsOCPI = await Promise.all(
                sessionsOCPI.map(async (session) => {
                    await this.adjustOcpiBillingPeriodIfUnknown(session);
                    // Only return sessions whose billingPeriod remained as requested
                    return session.billingPeriod === 'AD_HOC' ? session : null;
                })
            );
            sessionsOCPI = sessionsOCPI.filter(Boolean);

            const sessionsOCPP = await ChargerLibrary.findSessionsByQuery(queryOCPP);

            const allSessions = [...sessionsOCPI, ...sessionsOCPP];
            this.logger.log(`[${context}] Found ${allSessions.length} ad-hoc sessions without invoiceId for previous day`);
            return allSessions;
        } catch (error) {
            this.logger.error(`[${context}] Error fetching ad-hoc missing sessions: ${error.message}`);
            throw new BadRequestException(`Failed to fetch ad-hoc missing sessions`);
        }
    }

    async processAdHocSessions(
        sessions: Session[],
        invoiceCreated?: Invoice
    ): Promise<ProcessAdHocSessionsResult | null> {
        if (!sessions.length) {
            return null;
        }

        // If invoiceCreated is not provided, create a new invoice
        invoiceCreated = invoiceCreated || await this.createInvoiceForSessions(sessions);

        const vatCountry = this.vatStatusService.resolveVatCountry(sessions);
        const vatStatus = await this.vatStatusService.getVatStatus(sessions[0], vatCountry);
        const invoiceCommunication = await this.createInvoiceCommunications(sessions[0], invoiceCreated.id);
        let invoiceBilling = await this.createInvoiceBilling(sessions[0], invoiceCreated.id, invoiceCommunication[0].language);
        let paymentPeriod = sessions[0].userIdWillPayInfo?.paymentPeriod || sessions[0].paymentType || '';
        if (paymentPeriod === 'PROMPT_PAYMENT') {
            paymentPeriod = 'AD_HOC';
        }

        const layout = await this.getInvoiceLayout(sessions[0].clientName, invoiceCommunication[0].language, paymentPeriod);
        // Update invoice_layout_id in invoice with the linked credit note layout if available
        await this.invoiceService.updateInvoice(
            { id: invoiceCreated.id },
            {
                invoice_layout_id: layout.linkedCreditNoteId ?? undefined
            },
        );
        
        const paymentConditions = await this.getPaymentConditions(
            invoiceBilling?.payment_conditions_id ? Number(invoiceBilling.payment_conditions_id) : undefined
        );

        const codeDescription = sessions[0].country_code == 'PT' ? 'SERV221021' : 'SERV221022';
        const description = getServiceDescription(codeDescription, invoiceCommunication[0].language);

        // If the VAT status is '4', meaning 0% VAT, we need to fetch tax exemption details
        let exemptionReasonCode;
        let descriptionExemption;
        if (vatStatus?.tab_iva?.toString() === '4') {
            const taxExemption = await this.taxExemptionService.getTaxExemptionByLanguage(invoiceBilling.country_code);
            exemptionReasonCode = taxExemption.code;
            descriptionExemption = taxExemption.description;
        }

        const invoicePayload = this.invoiceService.buildInvoicePayload({
            createdInvoiceId: invoiceCreated.id,
            invoiceBilling,
            group: sessions,
            vatStatus,
            vatCountry,
            doctype: layout.doctype,
            documentlayout: layout.id.toString(),
            printtypeid: layout.printtypeid,
            originSession: invoiceCreated.vat_country === "PT" ? "ISERV21021" : "ISERV21022",
            paymentConditions,
            description,
            codmotivoisencao: exemptionReasonCode,
            motivoisencao: descriptionExemption
        });
        this.logger.debug(`Invoice payload assembled: ${JSON.stringify(invoicePayload)}`);

        const invoiceProcessed = await this.billingService.issueInvoice(invoicePayload);

        // Insert invoice data into MongoDB
        this.logger.log(`Inserting invoice data into MongoDB for invoice ID: ${invoiceProcessed.id}`);
        try {
            const sessionNetwork = sessions[0].network || sessions[0].source;
            if (sessionNetwork) {
                await this.sessionInvoiceService.updateSessionInvoiceNumber(sessions[0], sessionNetwork, invoiceProcessed);
                await this.sessionInvoiceService.insertInvoiceData(invoiceProcessed, sessions[0], invoiceBilling);

                const payload = {
                    sessionId: sessions[0]._id,
                    origin: sessionNetwork == 'EVIO' ? 'ocpp' : 'ocpi22',
                    from: `service billing_v2 - Updating invoice number`,
                };
                await sendMessage(payload, 'session_history_v2_key');
            }
        } catch (error) {
            this.logger.error(`Error inserting invoice data into MongoDB: ${error.message}`);
            const payload = { invoiceId: invoiceProcessed.id };
            await sendMessage({ method: 'fetchEmailProcess', payload }, 'billing_v2_key');
        }

        const attachments = await this.prepareAttachments(invoiceProcessed, invoiceBilling, invoiceCommunication, sessions);

        return { invoiceCreated, invoiceBilling, invoiceCommunication, invoiceProcessed, attachments };
    }

    private async sendAdHocInvoiceEmails(
        invoiceBilling: InvoiceBilling,
        invoiceCommunication: InvoiceCommunicationItem[],
        attachments: Attachment[],
        invoiceCreated: Invoice,
        invoiceProcessed: Invoice,
        session: Session
    ): Promise<void> {
        await this.invoiceEmailService.sendInvoiceEmails(
            invoiceCommunication,
            attachments,
            invoiceCreated.id,
            invoiceProcessed.client_name,
            session.documentNumber || invoiceProcessed.invoice_number || '',
            session._id
        );
    }



    /**
     * Loads sessions from invoice object, fetching from S3 if necessary.
     * @param invoice Invoice object
     * @returns Array of Session
     * @throws BadRequestException if sessions cannot be loaded or parsed
     */
    async loadSessionsFromInvoice(invoice: Invoice): Promise<Session[]> {
        let sessions = invoice.sessions;
        if (!sessions || sessions.length === 0) {
            try {
                const downloadedSessionsBuffer = await downloadFileFromS3(invoice.sessions_url);
                const sessionsString = downloadedSessionsBuffer.toString('utf-8');
                sessions = JSON.parse(sessionsString);
            } catch (error) {
                this.logger.error(`Failed to parse sessions from S3 file: ${error.message}`);
                throw new BadRequestException('Could not parse sessions from S3 file');
            }
        }
        return sessions ?? [];
    }
}
