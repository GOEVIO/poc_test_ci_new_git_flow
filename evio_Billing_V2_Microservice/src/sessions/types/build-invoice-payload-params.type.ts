import { Session } from "../interfaces/session.interface";

export interface BuildInvoicePayloadParams {
  createdInvoiceId: string;
  invoiceBilling: any;
  group: Session[];
  vatStatus: { tab_iva?: number } | null;
  vatCountry: string;
  doctype: string;
  documentlayout: string;
  printtypeid: string;
  originSession: string;
  paymentConditions: { payment_condition_id?: string } | null;
  description: string;
  endDate?: string;
  codmotivoisencao?: string;
  motivoisencao?: string;
}