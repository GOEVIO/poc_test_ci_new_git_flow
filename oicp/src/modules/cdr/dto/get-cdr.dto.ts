import { Type, Expose } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsOptional,
  IsString,
  IsInt,
} from 'class-validator'

export class ApiGetCdrsRequestDto {
  @IsString()
  providerId!: string

  @Type(() => Date)
  @IsDate()
  from!: Date

  @Type(() => Date)
  @IsDate()
  to!: Date

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sessionIds?: string[]

  @IsOptional()
  @IsString()
  operatorId?: string

  @IsOptional()
  @IsBoolean()
  cdrForwarded?: boolean
}

export class HubjectGetCdrsRequestDto {
  @Expose({ name: 'ProviderID' })
  @IsString()
  providerId!: string

  @Expose({ name: 'From' })
  @Type(() => Date)
  @IsDate()
  from!: Date

  @Expose({ name: 'To' })
  @Type(() => Date)
  @IsDate()
  to!: Date

  @Expose({ name: 'SessionID' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sessionIds?: string[]

  @Expose({ name: 'OperatorID' })
  @IsOptional()
  @IsString()
  operatorId?: string

  @Expose({ name: 'CDRForwarded' })
  @IsOptional()
  @IsBoolean()
  cdrForwarded?: boolean
}

export class ProcessDataDto {
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

  @Type(() => Object)
  body: Record<string, any>

  @IsString()
  source: string
}
