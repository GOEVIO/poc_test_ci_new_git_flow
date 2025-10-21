import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from './invoice/entities/invoice.entity';
import { CreditNote } from './credit-note/entities/credit-note.entity';
import { AuditLog } from './audit-log/audit-log.entity';

@Injectable()
export class InvoiceService {
  constructor(
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(CreditNote)
    private creditNoteRepository: Repository<CreditNote>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  async createCreditNote(data: Partial<CreditNote>): Promise<CreditNote> {
    const creditNote = this.creditNoteRepository.create({
      ...data,
      status: 'created',
    });
    return this.creditNoteRepository.save(creditNote);
  }

  async findAllInvoices(): Promise<Invoice[]> {
    return this.invoiceRepository.find();
  }

  async findInvoiceById(id: string): Promise<Invoice | null> {
    return this.invoiceRepository.findOneBy({ id });
  }
}