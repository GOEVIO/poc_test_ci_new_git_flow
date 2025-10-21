import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { InvoiceService } from './invoice/invoice.service';
import { Invoice } from './invoice/entities/invoice.entity';
import { CreditNote } from './credit-note/entities/credit-note.entity';

@Controller('invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Post()
  create(@Body() data: Partial<Invoice>): Promise<Invoice> {
    return this.invoiceService.createInvoice(data);
  }

  @Get()
  findAll(): Promise<Invoice[]> {
    return this.invoiceService.findAllInvoices();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Invoice | null> {
    return this.invoiceService.findInvoiceById(id);
  }

  @Post('credit-notes')
  createCreditNote(@Body() data: Partial<CreditNote>): Promise<CreditNote> {
    return this.invoiceService.createCreditNote(data);
  }
}