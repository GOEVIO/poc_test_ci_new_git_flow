export interface InvoiceCommunicationItem {
  invoice_id: string;
  user_id?: string;
  name: string;
  email: string;
  language: string;
  client_type: 'b2c' | 'b2b';
}