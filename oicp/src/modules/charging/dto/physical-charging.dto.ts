import {
  IsOptional,
  IsString,
  IsArray,
  Matches,
  MaxLength,
  ValidateNested,
  IsNotEmpty,
  IsDateString,
  IsEnum,
} from 'class-validator'
import { Type, Expose } from 'class-transformer'
import { StatusCodeDto } from '@/shared/dto/status-code.dto'
import { OicpAuthorizationStatusType } from 'evio-library-commons'

export class RFIDMifareFamilyIdentificationDto {
  @IsOptional()
  @IsString()
  @Expose({ name: 'UID' })
  uid?: string
}

export class RemoteIdentificationDto {
  @IsOptional()
  @IsString()
  @Expose({ name: 'EvcoID' })
  evcoId?: string
}

export class RFIDIdentificationDto {
  @IsOptional()
  @IsString()
  @Expose({ name: 'EvcoID' })
  evcoId?: string

  @IsOptional()
  @IsDateString()
  @Expose({ name: 'ExpiryDate' })
  expiryDate?: string

  @IsOptional()
  @IsString()
  @Expose({ name: 'PrintedNumber' })
  printedNumber?: string

  @IsOptional()
  @IsString()
  @Expose({ name: 'RFID' })
  rfid?: string

  @IsOptional()
  @IsString()
  @Expose({ name: 'UID' })
  uid?: string
}

export class IdentificationDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => RFIDMifareFamilyIdentificationDto)
  @Expose({ name: 'RFIDMifareFamilyIdentification' })
  rfidMifareFamilyIdentification?: RFIDMifareFamilyIdentificationDto

  @IsOptional()
  @ValidateNested()
  @Expose({ name: 'QRCodeIdentification' })
  qrCodeIdentification?: any // To be ignored

  @IsOptional()
  @ValidateNested()
  @Type(() => RemoteIdentificationDto)
  @Expose({ name: 'PlugAndChargeIdentification' })
  plugAndChargeIdentification?: RemoteIdentificationDto

  @IsOptional()
  @ValidateNested()
  @Type(() => RemoteIdentificationDto)
  @Expose({ name: 'RemoteIdentification' })
  remoteIdentification?: RemoteIdentificationDto

  @IsOptional()
  @ValidateNested()
  @Type(() => RFIDIdentificationDto)
  @Expose({ name: 'RFIDIdentification' })
  rfidIdentification?: RFIDIdentificationDto
}

export class BaseRequestDto {
  @IsOptional()
  @IsString()
  @Expose({ name: 'CPOPartnerSessionID' })
  cpoPartnerSessionId?: string

  @IsOptional()
  @IsString()
  @Expose({ name: 'EMPPartnerSessionID' })
  empPartnerSessionId?: string

  @IsOptional()
  @IsString()
  @Expose({ name: 'EvseID' })
  evseId?: string

  @IsOptional()
  @IsString()
  @Expose({ name: 'PartnerProductID' })
  partnerProductId?: string

  @IsOptional()
  @IsString()
  @Expose({ name: 'OperatorID' })
  operatorId?: string
}

export class PhysicalStartDto extends BaseRequestDto {
  @ValidateNested()
  @Type(() => IdentificationDto)
  @Expose({ name: 'Identification' })
  identification!: IdentificationDto

  @IsOptional()
  @IsString()
  @Expose({ name: 'SessionID' })
  sessionId?: string
}

export class PhysicalStopDto extends BaseRequestDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => IdentificationDto)
  @Expose({ name: 'Identification' })
  identification?: IdentificationDto

  @IsString()
  @Expose({ name: 'SessionID' })
  sessionId: string
}

export class PhysicalStartResponseDto {
  @IsOptional()
  @IsString()
  @MaxLength(250)
  @Expose({ name: 'CPOPartnerSessionID' })
  cpoPartnerSessionId?: string

  @IsOptional()
  @IsString()
  @MaxLength(250)
  @Expose({ name: 'EMPPartnerSessionID' })
  empPartnerSessionId?: string

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9]{8}(-[A-Za-z0-9]{4}){3}-[A-Za-z0-9]{12}$/)
  @Expose({ name: 'SessionID' })
  sessionId?: string

  @IsOptional()
  @IsString()
  @Matches(/^([A-Za-z]{2}\-?[A-Za-z0-9]{3}|[A-Za-z]{2}[\*|-]?[A-Za-z0-9]{3})$/)
  @Expose({ name: 'ProviderID' })
  providerId?: string

  @IsNotEmpty()
  @IsEnum(OicpAuthorizationStatusType as object)
  @Expose({ name: 'AuthorizationStatus' })
  authorizationStatus: OicpAuthorizationStatusType

  @ValidateNested()
  @IsEnum(StatusCodeDto as object)
  @Expose({ name: 'StatusCode' })
  statusCode!: StatusCodeDto

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IdentificationDto)
  @Expose({ name: 'AuthorizationStopIdentifications' })
  authorizationStopIdentifications?: IdentificationDto[]
}
