import { Module } from '@nestjs/common';
import { VatStatusService } from './vat-status.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VatStatus } from '../invoice/entities/vat-status.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([VatStatus]),
    ],
    providers: [VatStatusService],
    exports: [VatStatusService],
})
export class VatStatusModule { }