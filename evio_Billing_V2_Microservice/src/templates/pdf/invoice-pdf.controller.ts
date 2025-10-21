import {
  Controller,
  Post,
  Body,
  Res,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoiceData } from './dtos/invoice.dto';
import { Response } from 'express';

@Controller('invoice-pdf')
export class InvoicePdfController {
  constructor(private readonly invoicePdfService: InvoicePdfService) {}

  @Post()
  @UsePipes(ValidationPipe)
  async generateInvoice(@Body() data: InvoiceData, @Res() res: Response) {
    const pdfBuffer = await this.invoicePdfService.generatePdf(data);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename=invoice.pdf',
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }
}
