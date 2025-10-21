import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ExcelTemplateService } from '../templates/excel.template.service';
import { ExcelTemplate } from '../invoice/entities/excel-template.entity';

@Controller('invoices')
export class ExcelTemplateController {
  constructor(private readonly invoiceService: ExcelTemplateService) {}

}