import { Controller, Get, Query, UseInterceptors, ValidationPipe, Headers } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { Invoice } from '../../invoice/entities/invoice.entity';
import { InvoiceQueryDto } from './invoice.dto'
import { InvoiceExternalAPIInterceptor } from './invoice.interceptor';

@Controller('evioapi/invoices')
export class InvoiceController {
    constructor(private readonly invoiceService: InvoiceService) { }

    @Get()
    @UseInterceptors(InvoiceExternalAPIInterceptor)
    findAll(
        @Query(new ValidationPipe({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: true,
            transformOptions: {
                enableImplicitConversion: true,
            },
        })) query: InvoiceQueryDto,
        @Headers('userid') user: string,
    ): Promise<Invoice[]> {
        return this.invoiceService.findInvoices(query, user);
    }
}