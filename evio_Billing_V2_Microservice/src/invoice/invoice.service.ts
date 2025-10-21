import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from './entities/invoice.entity';
import { CreditNote } from '../credit-note/entities/credit-note.entity';
import { InvoiceStatusId } from '../enums/invoice-status.enum';
import { AuditLogService } from '../audit-log/audit-log.service';
import { BuildInvoicePayloadParams } from '../sessions/types/build-invoice-payload-params.type';
import { InvoiceBilling } from './entities/invoice-billing.entity';
import { IClientAddressFields } from './interfaces/client-address-fields.interface';

@Injectable()
export class InvoiceService {
  constructor(
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(CreditNote)
    private creditNoteRepository: Repository<CreditNote>,
    private auditLogService: AuditLogService,
  ) { }

  async createInvoice(data: Partial<Invoice>): Promise<Invoice> {
    const invoice = this.invoiceRepository.create({
      ...data,
      status: InvoiceStatusId.Created,
    });
    const savedInvoice = await this.invoiceRepository.save(invoice);

    await this.auditLogService.logAction({
      objectType: 'invoice',
      relatedObjectId: savedInvoice.id,
      action: 'create_invoice',
      oldValue: null,
      newValue: savedInvoice,
      description: `Invoice created with id ${savedInvoice.id}`,
      triggeredBy: 'system',
    });

    return savedInvoice;
  }

  async updateInvoice(
    where: Partial<Invoice>,
    updateData: Partial<Invoice>
  ): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({ where });

    if (!invoice) {
      throw new Error('Invoice not found to update');
    }

    Object.assign(invoice, updateData);

    return this.invoiceRepository.save(invoice);
  }

  async createAdHocInvoice(data: Partial<Invoice>): Promise<Invoice> {
    const invoice: Invoice = {
      ...data,
      type: 'ad_hoc',
      createdAt: new Date(),
    } as Invoice;

    return this.invoiceRepository.save(invoice);
  }
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

  buildInvoicePayload({
    createdInvoiceId,
    invoiceBilling,
    group,
    vatStatus,
    vatCountry,
    doctype,
    documentlayout,
    printtypeid,
    originSession,
    paymentConditions,
    endDate,
    description,
    codmotivoisencao,
    motivoisencao
  }: BuildInvoicePayloadParams) {
    const firstSession = group[0];

    let period = '';
    if (endDate) {
      period = endDate;
    } else if (firstSession.end_date_time) {
      period = new Date(firstSession.end_date_time).toISOString().split('T')[0];
    } else if (firstSession.stopDate) {
      period = new Date(firstSession.stopDate).toISOString().split('T')[0];
    }

    const line: any = {
      code: originSession,
      description: description ?? '',
      quantity: '1',
      value: group.reduce((sum, s) => sum + (s.finalPrices?.totalPrice.excl_vat || s.totalPrice?.excl_vat || 0), 0),
      initialwarehouse: 1,
      tabiva: vatStatus?.tab_iva?.toString() ?? '4',
    };

    // Additional fields if they exist
    if (codmotivoisencao) line.codmotivoisencao = codmotivoisencao;
    if (motivoisencao) line.motivoisencao = motivoisencao;
    if (vatStatus?.tab_iva?.toString() == '4') line.vatexemptioncode = 0; // Assuming 0 for VAT exemption code if tab_iva is 4

    const addressFields = this.getClientAddressFields(invoiceBilling);

    return {
      invoiceId: createdInvoiceId,
      action: 'CREATE',
      doctype,
      date: new Date().toISOString().split('T')[0],
      period,
      purchaseorder: invoiceBilling?.purchase_order ?? "",
      paymentconditionid: paymentConditions?.payment_condition_id ?? "",
      documentlayout,
      printtypeid,
      clientdata: {
        vatcountry: vatCountry,
        vatnumber: invoiceBilling?.vat_number,
        name: invoiceBilling.name.replace(/-\s*/g, '').trim().substring(0, 55), //Phc limit 55 characters
        termsofpayment: 'REGL',
        active: '1',
        vatexemptioncode: '',
        street: addressFields.street,
        postcode: addressFields.postcode,
        city: addressFields.city,
        locality: addressFields.locality,
        addresscountry: addressFields.addresscountry,
      },
      lines: {
        0: line,
      },
    };
  }

  private getClientAddressFields(invoiceBilling: Partial<InvoiceBilling>): IClientAddressFields {
    // If VAT number is '999999990', return all fields as a single space (required by PHC for generic clients)
    if (invoiceBilling && invoiceBilling.vat_number === '999999990') {
        return {
            street: ' ',
            postcode: ' ',
            city: ' ',
            locality: ' ',
            addresscountry: ' ',
        };
    } else {
        // Build street address, including number only if it exists
        // PHC only allows up to 55 characters for the street field
        let streetValue = invoiceBilling?.street ?? '';
        if (invoiceBilling?.number) {
            streetValue += `, ${invoiceBilling.number}`;
            // Only include floor if number exists
            if (invoiceBilling?.floor) {
                streetValue += `, ${invoiceBilling.floor}`;
            }
        }
        const street = streetValue.substring(0, 55);

        return {
            street,
            postcode: invoiceBilling?.zip_code ?? '',
            city: (invoiceBilling?.city ?? '').trim(),
            locality: invoiceBilling?.country ?? '',
            addresscountry: invoiceBilling?.country_code ?? '',
        };
    }
  }

}