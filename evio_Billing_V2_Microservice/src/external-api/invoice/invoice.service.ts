import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from '../../invoice/entities/invoice.entity';
import { InvoiceQueryDto } from './invoice.dto'

@Injectable()
export class InvoiceService {
    constructor(
        @InjectRepository(Invoice)
        private invoiceRepository: Repository<Invoice>,
    ) { }

    async findInvoices(query: InvoiceQueryDto, clientId: string): Promise<Invoice[]> {
        const { startDate, endDate, page = 1, limit = 10 } = query;

        const pageNumber = Number(page) || 1;
        const limitQuery = Number(limit) || 10;

        const queryBuilder = this.invoiceRepository.createQueryBuilder('invoice')
            .select([
                "invoice.id as id",
                "invoice.invoice_number as invoice_number",
                "invoice.total_amount_exc_vat as total_amount_exc_vat",
                "invoice.total_amount_inc_vat as total_amount_inc_vat",
                "invoice.credited_amount_exc_vat as credited_amount_exc_vat",
                "invoice.currency as currency",
                "invoice.vat_country as vat_country",
                "invoice.vat_rate as vat_rate",
                "invoice.sent_at AS issue_date",
            ])
            .innerJoin('invoice_billing', 'ib', 'ib.invoice_id = invoice.id')
            .where('ib.user_id = :clientId', { clientId });

        if (startDate) {
            queryBuilder.andWhere('invoice.sent_at >= :startDate', { startDate });
        }
        if (endDate) {
            queryBuilder.andWhere('invoice.sent_at <= :endDate', { endDate });
        }

        const data = await queryBuilder
            .orderBy('invoice.sent_at', 'DESC', 'NULLS LAST')
            .offset((pageNumber - 1) * limitQuery)
            .limit(limitQuery)
            .getRawMany();

        return data;
    }
}