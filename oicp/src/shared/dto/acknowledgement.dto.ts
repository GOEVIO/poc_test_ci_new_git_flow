import {
  IsString,
  IsOptional,
  MaxLength,
  IsEnum,
  IsBoolean,
  IsDefined,
  ValidateNested
} from 'class-validator'
import {Type } from 'class-transformer'
import { OicpStatusCodes } from 'evio-library-commons'
class StatusCodeDto {
  @IsEnum(OicpStatusCodes)
  Code: OicpStatusCodes

  @IsOptional()
  @IsString()
  @MaxLength(200)
  Description?: string

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  AdditionalInfo?: string
}

export class eRoamingAcknowledgementDto {
  @IsBoolean()
  Result: boolean

  @ValidateNested()
  @Type(() => StatusCodeDto)
  @IsDefined()
  StatusCode?: StatusCodeDto

  @IsOptional()
  SessionID?: string

  @IsOptional()
  @IsString()
  @MaxLength(250)
  CPOPartnerSessionID?: string

  @IsOptional()
  @IsString()
  @MaxLength(250)
  EMPPartnerSessionID?: string
}
