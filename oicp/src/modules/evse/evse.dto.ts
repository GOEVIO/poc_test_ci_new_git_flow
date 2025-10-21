import { ApiProperty } from '@nestjs/swagger'
import { Expose, Type } from 'class-transformer'
import {
  IsNotEmpty,
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsISO8601,
  IsEnum,
  ValidateNested,
  IsDefined,
  IsInt,
  IsDate,
} from 'class-validator'

import {
  OcpiEvseCapability,
  OicpGeoCoordinatesType,
} from 'evio-library-commons'
import { StatusCodeDto } from '../../shared/dto/status-code.dto'

export class PullEvseDto {
  @IsString()
  @IsNotEmpty()
  @Expose({ name: 'page' })
  @ApiProperty({ example: 'Page Number' })
  page: number

  @IsString()
  @IsNotEmpty()
  @Expose({ name: 'size' })
  @ApiProperty({ example: 'Itens Per Page' })
  size: number
}

class SortDto {
  @IsBoolean()
  sorted: boolean

  @IsBoolean()
  unsorted: boolean

  @IsBoolean()
  empty: boolean
}

class PageableDto {
  @Type(() => SortDto)
  @IsObject()
  sort: SortDto

  @IsNumber()
  pageSize: number

  @IsNumber()
  pageNumber: number

  @IsNumber()
  offset: number

  @IsBoolean()
  paged: boolean

  @IsBoolean()
  unpaged: boolean
}

export class PullEvseResultDto<T> {
  @IsArray()
  content: T[]

  @IsNumber()
  number: number

  @IsNumber()
  size: number

  @IsNumber()
  totalElements: number

  @Type(() => PageableDto)
  @IsObject()
  pageable: PageableDto

  @IsBoolean()
  last: boolean

  @IsNumber()
  totalPages: number

  @IsBoolean()
  first: boolean

  @IsNumber()
  numberOfElements: number

  @Type(() => StatusCodeDto)
  @IsObject()
  StatusCode: StatusCodeDto

  @IsBoolean()
  empty: boolean
}

enum Accessibility {
  FreePubliclyAccessible = 'Free publicly accessible',
  RestrictedAccess = 'Restricted access',
  PayingPubliclyAccessible = 'Paying publicly accessible',
  TestStation = 'Test Station',
}

enum CalibrationLawDataAvailability {
  Local = 'Local',
  External = 'External',
  NotAvailable = 'Not Available',
}

class GeoCoordinates {
  @IsNumber()
  Latitude: string

  @IsNumber()
  Longitude: string
}

class SearchCenter {
  @ValidateNested()
  @Type(() => GeoCoordinates)
  GeoCoordinates: GeoCoordinates

  @IsNumber()
  Radius: number // in kilometers
}

export class PullEvseDataDto {
  @IsDefined()
  @IsString()
  ProviderID: string

  @IsDefined()
  @IsEnum(OicpGeoCoordinatesType)
  GeoCoordinatesResponseFormat: OicpGeoCoordinatesType

  @IsOptional()
  @ValidateNested()
  @Type(() => SearchCenter)
  SearchCenter?: SearchCenter

  @IsOptional()
  @IsISO8601()
  LastCall?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  CountryCodes?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  OperatorIds?: string[]

  @IsOptional()
  @IsArray()
  @IsEnum(OcpiEvseCapability, { each: true })
  AuthenticationModes?: OcpiEvseCapability[]

  @IsOptional()
  @IsArray()
  @IsEnum(Accessibility, { each: true })
  Accessibility?: Accessibility[]

  @IsOptional()
  @IsArray()
  @IsEnum(CalibrationLawDataAvailability, { each: true })
  CalibrationLawDataAvailability?: CalibrationLawDataAvailability[]

  @IsOptional()
  @IsBoolean()
  RenewableEnergy?: boolean

  @IsOptional()
  @IsBoolean()
  IsHubjectCompatible?: boolean

  @IsOptional()
  @IsBoolean()
  IsOpen24Hours?: boolean

  @IsOptional()
  @IsArray()
  dynamicOperatorIds: string[] | undefined
}

export class ProcessDataDto {
  @IsDate()
  @Type(() => Date)
  start: Date

  @IsBoolean()
  isLastPage: boolean

  @IsBoolean()
  isFirstPage: boolean

  @IsInt()
  page: number

  @IsInt()
  size: number

  @IsInt()
  numberOfElements: number

  @IsString()
  url: string

  @ValidateNested()
  @Type(() => PullEvseDataDto)
  body: PullEvseDataDto

  @IsString()
  source: string

  @IsArray()
  operatorIds: string[] | undefined

  @IsArray()
  dynamicOperatorIds: string[] | undefined

  @IsString()
  mode: string
}
