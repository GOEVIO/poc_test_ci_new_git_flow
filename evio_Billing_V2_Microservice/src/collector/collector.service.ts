import { Injectable, Logger } from '@nestjs/common';
import { InvoiceType } from '../enums/Invoice-type.enum';
import { Session } from '../sessions/interfaces/session.interface';

@Injectable()
export class CollectorService {
    private readonly logger = new Logger(CollectorService.name);

    constructor() { }

    groupSessionsByUser(sessions: Session[]): Map<string, Session[]> {
        const map = new Map<string, Session[]>();
        for (const session of sessions) {
            if (!map.has(session.userIdToBillingInfo._id)) map.set(session.userIdToBillingInfo._id, []);
            map.get(session.userIdToBillingInfo._id)!.push(session);
        }
        return map;
    }

    groupUserSessionsByInvoiceCriteria(
        sessions: Session[],
    ): Map<string, Session[]> {
        const groupedSessions = new Map<string, Session[]>();

        for (const session of sessions) {
            const normalizedInvoiceType =
                (String(session.invoiceType) === "-1" || String(session.invoiceType) === "" || session.invoiceType == null)
                    ? InvoiceType.INVOICE_INCLUDED
                    : session.invoiceType;

            const normalizedInvoiceCommunication =
                (String(session.invoiceCommunication) === "-1" || String(session.invoiceCommunication) === "" || session.invoiceCommunication == null)
                    ? 'ONLY_COMPANY'
                    : session.invoiceCommunication;

            const key = JSON.stringify({
                iva: session.fees?.IVA,
                clientName: session.clientName,
                invoiceType: normalizedInvoiceType,
                invoiceCommunication: normalizedInvoiceCommunication,
                userIdToBilling: session.userIdToBillingInfo._id,
            });

            if (!groupedSessions.has(key)) {
                groupedSessions.set(key, []);
                this.logger.log(`[groupUserSessionsByInvoiceCriteria] New group created with key: ${key}`);
            }

            groupedSessions.get(key)?.push(session);
        }
        return groupedSessions;
    }
}