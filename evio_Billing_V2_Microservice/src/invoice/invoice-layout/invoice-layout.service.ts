import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceLayout } from '../entities/invoice-layout.entity';
import { InvoiceLayoutType } from './enum/invoice-layout-type.enum';

@Injectable()
export class InvoiceLayoutService {
  private readonly logger = new Logger(InvoiceLayoutService.name);

  constructor(
    @InjectRepository(InvoiceLayout)
    private readonly invoiceLayoutRepo: Repository<InvoiceLayout>,
  ) { }

  async findByInvoiceId(id: number): Promise<InvoiceLayout | null> {
    return await this.invoiceLayoutRepo.findOne({ where: { id } });
  }

  async findLayoutByClientAndLanguage(
    clientName: string,
    language: string,
    type: InvoiceLayoutType = InvoiceLayoutType.Invoice,
    paymentType?: string
  ): Promise<InvoiceLayout> {
    const context = 'findLayoutByClientAndLanguage';
    this.logger.log(`[${context}] Searching for invoice layout by client and language...`);

    // Define the search criteria in order of priority
    const criteria = [
      { client_name: clientName, language, type, payment_type: paymentType },
      { client_name: clientName, language, type, payment_type: undefined },
      { client_name: clientName, language: 'EN_GB', type, payment_type: paymentType },
      { client_name: clientName, language: 'EN_GB', type, payment_type: undefined },
      { client_name: 'EVIO', language, type, payment_type: paymentType },
      { client_name: 'EVIO', language, type, payment_type: undefined },
      { client_name: 'EVIO', language: 'EN_GB', type, payment_type: paymentType },
      { client_name: 'EVIO', language: 'EN_GB', type, payment_type: undefined },
    ];

    for (const where of criteria) {
      const layout = await this.invoiceLayoutRepo.findOne({ where });
      if (layout) {
        this.logger.log(`[${context}] Found layout with criteria: ${JSON.stringify(where)}`);
        return layout;
      }
      this.logger.warn(`[${context}] No layout found with criteria: ${JSON.stringify(where)}`);
    }

    this.logger.error(`[${context}] No invoice layout found for any fallback criteria.`);
    throw new Error(`No invoice layout found for client: ${clientName}, language: ${language}, type: ${type}, paymentType: ${paymentType}`);
  }
}
