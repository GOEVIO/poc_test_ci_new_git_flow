import { Injectable, Inject } from '@nestjs/common';
import { BillingProvider } from './providers/billing-provider.interface';

@Injectable()
export class BillingService {
  constructor(
    @Inject('BillingProvider')
    private readonly provider: BillingProvider,
  ) {}

  async issueInvoice(data: any) {
    return this.provider.createInvoice(data);
  }

  async issueCreditNote(data: any) {
    return this.provider.createCreditNote(data);
  }

  async getDocument(documentId: string, retryProcess?: boolean): Promise<Buffer> {
    return await this.provider.fetchDocument(documentId, retryProcess);
  }

  async uploadDocument(file: Buffer, folder:string, documentId: string): Promise<string> {
    return await this.provider.uploadDocument(file, folder, documentId);
  }
}
