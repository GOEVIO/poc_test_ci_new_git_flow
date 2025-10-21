export interface BillingProvider {
  authenticate(): Promise<void>;
  createInvoice(data: any): Promise<any>;
  createCreditNote(data: any): Promise<any>;
  fetchDocument(documentId: string, retryProcess?: boolean): Promise<Buffer>;
  uploadDocument(file: Buffer, folder: string, documentId: string): Promise<string>;
}
