import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsArray,
  ValidateNested,
  IsDefined,
  Length,
  MaxLength,
  IsEnum,
} from 'class-validator'
import { Expose, Type } from 'class-transformer'

class MeterValueInBetweenDto {
  @Expose({ name: 'meterValues' })
  @IsArray()
  @IsNumber({}, { each: true })
  meterValues!: number[]
}

class SignedMeteringValueDto {
  @Expose({ name: 'SignedMeteringValue' })
  @IsString()
  @MaxLength(3000)
  @IsOptional()
  signedMeteringValue?: string

  @Expose({ name: 'MeteringStatus' })
  @IsString()
  @IsOptional()
  meteringStatus?: string
}

class CalibrationLawVerificationInfoDto {
  @Expose({ name: 'CalibrationLawCertificateID' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  calibrationLawCertificateId?: string

  @Expose({ name: 'PublicKey' })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  publicKey?: string

  @Expose({ name: 'MeteringSignatureUrl' })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  meteringSignatureUrl?: string

  @Expose({ name: 'MeteringSignatureEncodingFormat' })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  meteringSignatureEncodingFormat?: string

  @Expose({ name: 'SignedMeteringValuesVerificationInstruction' })
  @IsString()
  @MaxLength(400)
  @IsOptional()
  signedMeteringValuesVerificationInstruction?: string
}

class RFIDMifareFamilyIdentificationDto {
  @Expose({ name: 'UID' })
  @IsString()
  uid!: string
}

class RFIDIdentificationDto {
  @Expose({ name: 'UID' })
  @IsString()
  uid!: string

  @Expose({ name: 'EvcoID' })
  @IsString()
  @IsOptional()
  evcoId?: string

  @Expose({ name: 'RFID' })
  @IsString()
  rfid!: string

  @Expose({ name: 'PrintedNumber' })
  @IsString()
  @IsOptional()
  printedNumber?: string

  @Expose({ name: 'ExpiryDate' })
  @IsDateString()
  @IsOptional()
  expiryDate?: string
}

class LegacyHashDataDto {
  @IsString()
  Function: string

  @IsOptional()
  @IsString()
  @MaxLength(100)
  Salt?: string

  @IsOptional()
  @IsString()
  @MaxLength(20)
  Value?: string
}

class HashedPinDto {
  @IsString()
  Function: string

  @ValidateNested()
  @Type(() => LegacyHashDataDto)
  @IsOptional()
  LegacyHashData?: LegacyHashDataDto

  @IsString()
  Value: string
}

class QRCodeIdentificationDto {
  @Expose({ name: 'EvcoID' })
  @IsString()
  evcoId!: string

  @Expose({ name: 'HashedPIN' })
  @ValidateNested()
  @Type(() => HashedPinDto)
  @IsOptional()
  hashedPin?: HashedPinDto

  @Expose({ name: 'PIN' })
  @IsString()
  @IsOptional()
  @Length(0, 20)
  pin?: string
}

class PlugAndChargeIdentificationDto {
  @Expose({ name: 'EvcoID' })
  @IsString()
  evcoId!: string
}

class RemoteIdentificationDto {
  @Expose({ name: 'EvcoID' })
  @IsString()
  evcoId!: string
}

export class IdentificationDto {
  @Expose({ name: 'RFIDMifareFamilyIdentification' })
  @ValidateNested()
  @Type(() => RFIDMifareFamilyIdentificationDto)
  @IsOptional()
  rfidMifareFamilyIdentification?: RFIDMifareFamilyIdentificationDto

  @Expose({ name: 'RFIDIdentification' })
  @ValidateNested()
  @Type(() => RFIDIdentificationDto)
  @IsOptional()
  rfidIdentification?: RFIDIdentificationDto

  @Expose({ name: 'QRCodeIdentification' })
  @ValidateNested()
  @Type(() => QRCodeIdentificationDto)
  @IsOptional()
  qrCodeIdentification?: QRCodeIdentificationDto

  @Expose({ name: 'PlugAndChargeIdentification' })
  @ValidateNested()
  @Type(() => PlugAndChargeIdentificationDto)
  @IsOptional()
  plugAndChargeIdentification?: PlugAndChargeIdentificationDto

  @Expose({ name: 'RemoteIdentification' })
  @ValidateNested()
  @Type(() => RemoteIdentificationDto)
  @IsOptional()
  remoteIdentification?: RemoteIdentificationDto
}

export class ReceiveCdrDto {
  @Expose({ name: 'SessionID' })
  @IsString()
  @IsDefined()
  sessionId!: string

  @Expose({ name: 'CPOPartnerSessionID' })
  @IsString()
  @IsOptional()
  cpoPartnerSessionId?: string

  @Expose({ name: 'EMPPartnerSessionID' })
  @IsString()
  @IsOptional()
  empPartnerSessionId?: string

  @Expose({ name: 'PartnerProductID' })
  @IsString()
  @IsOptional()
  partnerProductId?: string

  @Expose({ name: 'EvseID' })
  @IsString()
  @IsDefined()
  evseId!: string

  @Expose({ name: 'Identification' })
  @ValidateNested({ each: true })
  @Type(() => IdentificationDto)
  @IsDefined()
  identification!: IdentificationDto

  @Expose({ name: 'ChargingStart' })
  @IsDateString()
  chargingStart?: string

  @Expose({ name: 'ChargingEnd' })
  @IsDateString()
  chargingEnd?: string

  @Expose({ name: 'SessionStart' })
  @IsDateString()
  @IsDefined()
  sessionStart!: string

  @Expose({ name: 'SessionEnd' })
  @IsDateString()
  @IsDefined()
  sessionEnd!: string

  @Expose({ name: 'MeterValueStart' })
  @IsNumber()
  @IsOptional()
  meterValueStart?: number

  @Expose({ name: 'MeterValueEnd' })
  @IsNumber()
  @IsOptional()
  meterValueEnd?: number

  @Expose({ name: 'MeterValueInBetween' })
  @ValidateNested({ each: true })
  @Type(() => MeterValueInBetweenDto)
  @IsOptional()
  meterValueInBetween?: MeterValueInBetweenDto

  @Expose({ name: 'ConsumedEnergy' })
  @IsNumber()
  @IsDefined()
  consumedEnergy!: number

  @Expose({ name: 'SignedMeteringValues' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SignedMeteringValueDto)
  @IsOptional()
  signedMeteringValues?: SignedMeteringValueDto[]

  @Expose({ name: 'CalibrationLawVerificationInfo' })
  @ValidateNested()
  @Type(() => CalibrationLawVerificationInfoDto)
  @IsOptional()
  calibrationLawVerificationInfo?: CalibrationLawVerificationInfoDto

  @Expose({ name: 'HubOperatorID' })
  @IsString()
  @IsOptional()
  hubOperatorId?: string

  @Expose({ name: 'HubProviderID' })
  @IsString()
  @IsOptional()
  hubProviderId?: string
}
