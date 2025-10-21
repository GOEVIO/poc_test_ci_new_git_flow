import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  Query,
  Res,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { Response } from 'express';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('invoice')
  async createInvoice(@Body() data: any) {
    try {
      return await this.billingService.issueInvoice(data);
    } catch (error) {
      throw new HttpException(
        'Failed to issue invoice',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('credit-note')
  async createCreditNote(@Body() data: any) {
    try {
      return await this.billingService.issueCreditNote(data);
    } catch (error) {
      throw new HttpException(
        'Failed to issue credit note',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  //TO-DO
  @Get('document')
  async getDocument(
    @Query('id') documentId: string,
    @Query('type') type: 'invoice' | 'credit_note',
    @Res() res: Response,
  ) {
    try {
      const file = await this.billingService.getDocument(documentId);
      if (file) {
        const filepath = await this.billingService.uploadDocument(
          file,
          'invoice',
          documentId,
        );
        console.log(`File uploaded to: ${filepath}`);
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${type}-${documentId}.pdf"`,
      );
      res.send(file);
    } catch (error) {
      throw new HttpException(
        'Failed to fetch document',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
