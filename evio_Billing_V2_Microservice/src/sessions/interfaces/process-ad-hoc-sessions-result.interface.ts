import { Invoice } from '../../invoice/entities/invoice.entity';
import { InvoiceBilling } from '../../invoice/entities/invoice-billing.entity';
import { InvoiceCommunicationItem } from './invoice-communication-item.interface';
import { Attachment } from './attachment.interface';

export interface ProcessAdHocSessionsResult {
  invoiceCreated: Invoice;
  invoiceBilling: InvoiceBilling;
  invoiceCommunication: InvoiceCommunicationItem[];
  invoiceProcessed: Invoice;
  attachments: Attachment[];
}