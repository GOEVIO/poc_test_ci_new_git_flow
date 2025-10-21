import { Injectable, Logger } from '@nestjs/common';
import { Invoice } from '../../invoice/entities/invoice.entity';
import { Session } from '../interfaces/session.interface';
import ChargerLibrary from 'evio-library-chargers';
import {
    ChargingSessionReadRepository as OcpiSessionRepository,
} from 'evio-library-ocpi';
import { InvoiceBilling } from '../../invoice/entities/invoice-billing.entity';
import BillingLibrary from 'evio-library-billing';
import { formatLocalISOString } from '../../utils/date-format';
import { CreditNote } from '../../credit-note/entities/credit-note.entity';

@Injectable()
export class SessionInvoiceService {
    private readonly logger = new Logger(SessionInvoiceService.name);

    constructor() { }

    async updateSessionInvoiceNumber(session: Session, sessionNetwork: string, invoice: Invoice, creditNote?: CreditNote): Promise<void> {
        const context = 'updateInvoiceNumberInSession';
        try {
            this.logger.log(`[${context}] Updating invoice number in session`, { sessionId: session._id, invoiceNumber: invoice.invoice_number });

            if (!invoice.invoice_number) {
                this.logger.error(`[${context}] Invoice number is undefined for invoice ID: ${invoice.id}`);
                throw new Error(`Invoice number is undefined for invoice ID: ${invoice.id}`);
            }

            const invoiceArray = [{
                invoiceId: invoice.id,
                invoiceCreatedDate: new Date().toISOString(),
                documentNumber: invoice.invoice_number
            }];

            const creditNoteArray = creditNote ? [{
                creditNoteId: creditNote.id,
                creditNoteCreatedDate: creditNote.created_at.toISOString(),
                creditNoteDocumentNumber: creditNote.credit_note_number
            }] : [];

            let updated;
            if (sessionNetwork === 'EVIO') {
                updated = await ChargerLibrary.updateInvoiceDocumentNumberById(
                    session._id,
                    invoice.invoice_number,
                    invoiceArray,
                    creditNoteArray
                );
            } else {
                updated = await OcpiSessionRepository.updateInvoiceDocumentNumber(
                    session.id,
                    invoice.invoice_number,
                    invoiceArray,
                    creditNoteArray
                );
            }

            if (updated) {
                this.logger.log(`[${context}] documentNumber updated successfully!`, { sessionId: session._id });
            } else {
                this.logger.log(`[${context}] No changes were made.`, { sessionId: session._id });
            }
        } catch (error) {
            this.logger.error(`[${context}] Error updating invoice number in session: ${error.message}`);
        }
    }

    async insertInvoiceData(invoice: Invoice, sessionData: Session, billingData: InvoiceBilling): Promise<void> {
        const context = 'insertInvoiceData';
        try {
            this.logger.log(`[${context}] Inserting invoice data into MongoDB`);

            const createdDate = invoice.sent_at
                ? formatLocalISOString(invoice.sent_at)
                : formatLocalISOString();

            await BillingLibrary.insertInvoice({
                chargerType: sessionData.chargerType,
                clientName: sessionData.clientName,
                syncToHistory: false,
                userId: billingData.user_id,
                type: 'invoice',
                status: '40',
                billingType: sessionData.billingPeriod,
                documentNumber: invoice.invoice_number,
                documentId: invoice.third_party_id,
                attach: {
                    overview: {
                        footer: {
                            total_exc_vat: sessionData.finalPrices?.totalPrice?.excl_vat,
                            total_inc_vat: sessionData.finalPrices?.totalPrice?.incl_vat
                        }
                    }
                },
                createdAt: createdDate,
                updatedAt: createdDate
            });
            this.logger.log(`[${context}] Invoice inserted in MongoDB via evio-library-billing`);
        } catch (err) {
            this.logger.error(`[${context}] Error inserting invoice in MongoDB: ${err.message}`);
        }
    }
}