import {
  IsString,
  IsArray,
  ValidateNested,
  IsNumber,
  IsObject,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class Branding {
  @IsString()
  logoPath: string;

  @IsString()
  companyEmail: string;
}

export class Customer {
  @IsString()
  name: string;

  @IsString()
  address: string;

  @IsString()
  language: string;
}

export class SummaryItem {
  @IsString()
  description: string;

  @IsString()
  price: string;

  @IsString()
  vat: string;
}

export class SummaryData {
  @IsString()
  invoiceNumber: string;

  @IsString()
  totalExclVat: string;

  @IsString()
  totalInclVat: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SummaryItem)
  items: SummaryItem[];
}

export class SessionData {
  @IsString()
  title: string;

  @IsNumber()
  count: number;

  @IsString()
  totalTime: string;

  @IsString()
  totalEnergy: string;

  @IsString()
  totalExclVat: string;

  @IsString()
  totalInclVat: string;

  @IsString()
  network: string;

  @IsArray()
  @IsObject({ each: true })
  items: Record<string, any>[];
}

export class StationData {
  @IsString()
  name: string;

  @IsString()
  city: string;

  @IsString()
  tension: string;
}

export class PriceTable {
  @IsNumber()
  unitPriceCEMEOutEmptyBT: number;

  @IsNumber()
  unitPriceCEMEEmptyBT: number;

  @IsNumber()
  unitPriceTAROutEmptyBT: number;

  @IsNumber()
  unitPriceTAREmptyBT: number;

  @IsNumber()
  unitPriceCEMEOutEmptyMT: number;

  @IsNumber()
  unitPriceCEMEEmptyMT: number;

  @IsNumber()
  unitPriceTAROutEmptyMT: number;

  @IsNumber()
  unitPriceTAREmptyMT: number;
}

export class Footer {
  @IsBoolean()
  summaryText: boolean;
  @IsOptional()
  @ValidateNested()
  @Type(() => PriceTable)
  priceTable: PriceTable;
  @IsNumber()
  activationFeeAdHoc: number;
  @IsNumber()
  activationFee: number;
}
export class InvoiceData {
  @ValidateNested()
  @Type(() => Branding)
  branding: Branding;

  @ValidateNested()
  @Type(() => Customer)
  customer: Customer;

  @ValidateNested()
  @Type(() => SummaryData)
  summary: SummaryData;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SessionData)
  sessions: SessionData[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StationData)
  @IsOptional()
  stations: StationData[];
  @Type(() => Footer)
  @IsOptional()
  @ValidateNested()
  footer: Footer;
}
