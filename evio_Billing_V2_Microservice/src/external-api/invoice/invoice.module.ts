import { Module } from '@nestjs/common';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { Invoice } from '../../invoice/entities/invoice.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
    imports: [
        TypeOrmModule.forFeature([Invoice]),
      ],
    controllers: [InvoiceController],
    providers: [InvoiceService],
})
export class ExternalAPIInvoiceModule { }