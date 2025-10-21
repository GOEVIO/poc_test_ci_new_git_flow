import {
  IsString,
  IsUUID,
  IsArray,
  ValidateNested,
  IsNumber,
  IsEnum,
  IsNotEmpty,
  IsOptional,
} from 'class-validator'
import { Expose, Type } from 'class-transformer'
import { OcpiTariffDimenstionType } from 'evio-library-commons'
import { UUID } from 'crypto'

export class AptChargerPriceComponentDto {
  @IsString()
  @IsEnum(OcpiTariffDimenstionType)
  type?: OcpiTariffDimenstionType

  @IsNumber()
  price?: number

  @IsNumber()
  vat?: number

  @IsNumber()
  step_size?: number

  @IsUUID()
  id?: UUID
}

export class AptChargerRestrictionDto {
  @IsUUID()
  id?: UUID

  @IsArray()
  @IsOptional()
  day_of_week?: string[]

  @IsNumber()
  @IsOptional()
  min_duration?: number

  @IsString()
  @IsOptional()
  start_time?: string

  @IsString()
  @IsOptional()
  end_time?: string

  @IsString()
  @IsOptional()
  start_date?: string

  @IsString()
  @IsOptional()
  end_date?: string

  @IsNumber()
  @IsOptional()
  min_kwh?: number

  @IsNumber()
  @IsOptional()
  max_kwh?: number

  @IsNumber()
  @IsOptional()
  min_current?: number

  @IsNumber()
  @IsOptional()
  max_current?: number

  @IsNumber()
  @IsOptional()
  min_power?: number

  @IsNumber()
  @IsOptional()
  max_power?: number

  @IsNumber()
  @IsOptional()
  max_duration?: number

  @IsEnum(['RESERVATION', 'RESERVATION_EXPIRES'])
  @IsOptional()
  reservation?: 'RESERVATION' | 'RESERVATION_EXPIRES'
}

export class AptChargerTariffElementDto {
  @IsUUID()
  id?: UUID

  @ValidateNested()
  @Type(() => AptChargerRestrictionDto)
  restrictions?: AptChargerRestrictionDto

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AptChargerPriceComponentDto)
  price_components?: AptChargerPriceComponentDto[]
}

export class AptChargerTariffDetailDto {
  @IsString()
  tariff_owner!: string

  @IsUUID()
  id?: UUID

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AptChargerTariffElementDto)
  elements?: AptChargerTariffElementDto[]
}

export class AptChargerPlugDto {
  @IsString()
  plug_id!: string

  @IsUUID()
  id?: UUID

  @ValidateNested()
  @Type(() => AptChargerTariffDetailDto)
  tariffs_detail?: AptChargerTariffDetailDto
}

export class AptChargerDto {
  @IsString({ message: 'hwId must be a string' })
  @IsNotEmpty({ message: 'hwId should not be empty' })
  @Expose()
  hwId!: string

  @IsString({ message: 'Charger Type must be a string' })
  @IsNotEmpty({ message: 'Charger Type should not be empty' })
  @Expose()
  charger_type!: string

  @IsUUID()
  id?: UUID

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AptChargerPlugDto)
  @Expose()
  plugs?: AptChargerPlugDto[]
}
