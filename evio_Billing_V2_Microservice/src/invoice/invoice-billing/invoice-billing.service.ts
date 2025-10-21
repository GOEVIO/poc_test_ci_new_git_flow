import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceBilling } from '../entities/invoice-billing.entity';

@Injectable()
export class InvoiceBillingService {
  constructor(
    @InjectRepository(InvoiceBilling)
    private readonly billingRepo: Repository<InvoiceBilling>,
  ) {}

  async create(data: Partial<InvoiceBilling>): Promise<InvoiceBilling> {
    const invoice = this.billingRepo.create(data);
    return await this.billingRepo.save(invoice);
  }

  async findByInvoiceId(invoiceId: string): Promise<InvoiceBilling | null> {
    return await this.billingRepo.findOne({ where: { invoice_id: invoiceId } });
  }
}
