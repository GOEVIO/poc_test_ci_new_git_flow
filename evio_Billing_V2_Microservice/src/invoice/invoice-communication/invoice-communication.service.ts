import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceCommunication } from '../entities/invoice-communication.entity';

@Injectable()
export class InvoiceCommunicationService {
  constructor(
    @InjectRepository(InvoiceCommunication)
    private readonly communicationRepo: Repository<InvoiceCommunication>,
  ) {}

  async create(data: Partial<InvoiceCommunication>): Promise<InvoiceCommunication> {
    const invoice = this.communicationRepo.create(data);
    return await this.communicationRepo.save(invoice);
  }

  async findByInvoiceId(invoiceId: string): Promise<InvoiceCommunication | null> {
    return await this.communicationRepo.findOne({ where: { invoice_id: invoiceId } });
  }

  async findAllByInvoiceId(invoiceId: string): Promise<InvoiceCommunication[]> {
    return await this.communicationRepo.find({ where: { invoice_id: invoiceId } });
  }
}
