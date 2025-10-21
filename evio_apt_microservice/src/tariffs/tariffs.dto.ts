import { Expose, Transform, Type } from 'class-transformer'
import {
  ArrayNotEmpty,
  IsArray,
  IsDefined,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
  ValidateNested,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  DeviceTypes,
  isNotEmptyObject,
  OcpiTariffDimenstionType,
} from 'evio-library-commons'
import { IsReallyString } from '../common/decorators/validators/isReallyString'
import { UUID } from 'crypto'
import {
  tariffsDetails,
  tariffsElements,
  tariffsPriceComponents,
  tariffsRestrictions,
  tariffsDetailsToUpdate,
  tariffsElementsToUpdate,
  tariffsPriceComponentsToUpdate,
  tariffsRestrictionsToUpdate,
} from './tests/mocks/tariffs-mock'
import { AptPlugs } from '../database/entities/apt-charger-plugs.entity'

export class TariffRestrictionDto {
  @Expose()
  @IsOptional()
  @IsString()
  @IsUUID()
  id?: UUID

  @ApiPropertyOptional({
    type: [String],
    description: 'Days of the week',
    example: tariffsRestrictions.day_of_week,
  })
  @Expose()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  day_of_week?: string[]

  @ApiPropertyOptional({
    type: Number,
    description: 'Minimum duration',
    example: tariffsRestrictions.min_duration,
  })
  @Expose()
  @IsOptional()
  @IsNumber()
  min_duration?: number

  @ApiPropertyOptional({
    type: String,
    description: 'Start time',
    example: tariffsRestrictions.start_time,
  })
  @Expose()
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value ? value.substring(0, 5) : value))
  start_time?: string

  @ApiPropertyOptional({
    type: String,
    description: 'End time',
    example: tariffsRestrictions.end_time,
  })
  @Expose()
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value ? value.substring(0, 5) : value))
  end_time?: string

  @ApiPropertyOptional({
    type: String,
    description: 'Start date',
    example: tariffsRestrictions.start_date,
  })
  @Expose()
  @IsOptional()
  @IsString()
  start_date?: string

  @ApiPropertyOptional({
    type: String,
    description: 'End date',
    example: tariffsRestrictions.end_date,
  })
  @Expose()
  @IsOptional()
  @IsString()
  end_date?: string

  @ApiPropertyOptional({
    type: Number,
    description: 'Minimum kWh',
    example: tariffsRestrictions.min_duration,
  })
  @Expose()
  @IsOptional()
  @IsNumber()
  min_kwh?: number

  @ApiPropertyOptional({
    type: Number,
    description: 'Maximum kWh',
    example: tariffsRestrictions.max_kwh,
  })
  @Expose()
  @IsOptional()
  @IsNumber()
  max_kwh?: number

  @ApiPropertyOptional({
    type: Number,
    description: 'Minimum current',
    example: tariffsRestrictions.min_duration,
  })
  @Expose()
  @IsOptional()
  @IsNumber()
  min_current?: number

  @ApiPropertyOptional({
    type: Number,
    description: 'Maximum current',
    example: tariffsRestrictions.max_current,
  })
  @Expose()
  @IsOptional()
  @IsNumber()
  max_current?: number

  @ApiPropertyOptional({
    type: Number,
    description: 'Minimum power',
    example: tariffsRestrictions.min_duration,
  })
  @Expose()
  @IsOptional()
  @IsNumber()
  min_power?: number

  @ApiPropertyOptional({
    type: Number,
    description: 'Maximum power',
    example: tariffsRestrictions.max_power,
  })
  @Expose()
  @IsOptional()
  @IsNumber()
  max_power?: number

  @ApiPropertyOptional({
    type: Number,
    description: 'Maximum duration',
    example: tariffsRestrictions.max_duration,
  })
  @Expose()
  @IsOptional()
  @IsNumber()
  max_duration?: number

  @ApiPropertyOptional({
    enum: ['RESERVATION', 'RESERVATION_EXPIRES'],
    description: 'Reservation type',
    example: tariffsRestrictions.reservation,
  })
  @Expose()
  @IsOptional()
  @IsEnum(['RESERVATION', 'RESERVATION_EXPIRES'])
  reservation?: 'RESERVATION' | 'RESERVATION_EXPIRES'
}

export class TariffPriceComponentsDto {
  @Expose()
  @IsOptional()
  @IsString()
  @IsUUID()
  id?: UUID

  @ApiPropertyOptional({
    enum: OcpiTariffDimenstionType,
    description: 'Component type',
    example: tariffsPriceComponents.type,
  })
  @Expose()
  @IsOptional()
  @IsEnum(OcpiTariffDimenstionType)
  type?: OcpiTariffDimenstionType

  @ApiPropertyOptional({
    type: Number,
    description: 'Price',
    example: tariffsPriceComponents.price,
  })
  @Expose()
  @IsOptional()
  @IsNumber()
  price?: number

  @ApiPropertyOptional({
    type: Number,
    description: 'VAT',
    example: tariffsPriceComponents.vat,
  })
  @Expose()
  @IsOptional()
  @IsNumber()
  vat?: number

  @ApiPropertyOptional({
    type: Number,
    description: 'Step size',
    example: tariffsPriceComponents.step_size,
  })
  @Expose()
  @IsOptional()
  @IsNumber()
  step_size?: number
}

export class TariffElementsDto {
  @ApiPropertyOptional({
    type: [TariffPriceComponentsDto],
    description: 'Price components',
    example: [tariffsPriceComponents],
  })
  @Expose()
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => TariffPriceComponentsDto)
  price_components?: TariffPriceComponentsDto[]

  @ApiPropertyOptional({
    type: TariffRestrictionDto,
    description: 'Restrictions',
    example: tariffsRestrictions,
  })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => TariffRestrictionDto)
  restrictions?: TariffRestrictionDto

  @Expose()
  @IsOptional()
  @IsString()
  @IsUUID()
  id?: UUID
}

export class TariffDetailsDto {
  @ApiPropertyOptional({
    type: [TariffElementsDto],
    description: 'Tariff elements',
    example: [tariffsElements],
  })
  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TariffElementsDto)
  elements?: TariffElementsDto[]

  @ApiProperty({
    type: String,
    description: 'Tariff owner',
    example: tariffsDetails.tariff_owner,
  })
  @Expose()
  @IsNotEmpty()
  @IsString()
  @IsReallyString({ message: 'Tariff owner must be a valid string' })
  tariff_owner!: string

  @IsOptional()
  @ValidateNested()
  @Type(() => AptPlugs)
  plug?: AptPlugs

  @IsOptional()
  @IsString()
  plug_id?: string

  @Expose()
  @IsOptional()
  @IsString()
  @IsUUID()
  id?: UUID

  @ApiPropertyOptional({
    type: String,
    enum: DeviceTypes,
    description: 'Device type',
    example: DeviceTypes.APT,
  })
  @Transform(({ value }) => (value ? value.toUpperCase() : value))
  @IsDefined()
  @IsEnum(DeviceTypes, { message: 'auth_type must be a valid enum value' })
  auth_type?: DeviceTypes
}

export class CreateTariffDto {
  @ApiProperty({
    type: TariffDetailsDto,
    description: 'Tariff details',
    example: tariffsDetails,
  })
  @Expose()
  @Type(() => TariffDetailsDto)
  @ValidateNested()
  @IsDefined()
  details!: TariffDetailsDto
}

export class UpdateTariffRestrictionDto extends TariffRestrictionDto {
  @ApiProperty({
    type: String,
    format: 'uuid',
    description: 'Restriction ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Expose()
  @ValidateIf(
    (obj) => obj !== undefined && obj !== null && isNotEmptyObject(obj)
  )
  @IsString()
  @IsUUID()
  id!: UUID
}

export class UpdateTariffPriceComponentsDto extends TariffPriceComponentsDto {
  @ApiProperty({
    type: String,
    format: 'uuid',
    description: 'Price component ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Expose()
  @ValidateIf((obj) => obj !== undefined && obj !== null)
  @IsString()
  @IsUUID()
  id!: UUID
}

export class UpdateTariffElementsDto {
  @ApiProperty({
    type: String,
    format: 'uuid',
    description: 'Element ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Expose()
  @ValidateIf((obj) => obj !== undefined && obj !== null)
  @IsString()
  @IsUUID()
  id!: UUID

  @ApiPropertyOptional({
    type: [UpdateTariffPriceComponentsDto],
    description: 'Price components',
    example: [tariffsPriceComponentsToUpdate],
  })
  @Expose()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UpdateTariffPriceComponentsDto)
  price_components?: UpdateTariffPriceComponentsDto[]

  @ApiPropertyOptional({
    type: UpdateTariffRestrictionDto,
    description: 'Restrictions',
    example: tariffsRestrictionsToUpdate,
  })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateTariffRestrictionDto)
  restrictions?: UpdateTariffRestrictionDto
}

export class UpdateTariffDetailsDto extends TariffDetailsDto {
  @ApiProperty({
    type: String,
    format: 'uuid',
    description: 'Tariff details ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Expose()
  @IsOptional()
  @IsString()
  @IsUUID()
  id!: UUID

  @ApiPropertyOptional({
    type: [UpdateTariffElementsDto],
    description: 'Tariff elements',
    example: [tariffsElementsToUpdate],
  })
  @Expose()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UpdateTariffElementsDto)
  elements?: UpdateTariffElementsDto[]
}

export class UpdateTariffDto {
  @ApiProperty({
    type: UpdateTariffDetailsDto,
    description: 'Tariff details',
    example: tariffsDetailsToUpdate,
  })
  @Expose()
  @ValidateNested()
  @IsDefined()
  @Type(() => UpdateTariffDetailsDto)
  details!: UpdateTariffDetailsDto
}

export class GetTariffsQueryDto {
  @ApiPropertyOptional({
    enum: [DeviceTypes.APT, DeviceTypes.QR_CODE],
    description: 'Device type',
    example: DeviceTypes.APT,
  })
  @IsDefined()
  @Transform(({ value }) => (value ? value.toUpperCase() : value))
  @IsDefined()
  @IsEnum(DeviceTypes, { message: 'device must be a valid enum value' })
  device?: DeviceTypes
}
