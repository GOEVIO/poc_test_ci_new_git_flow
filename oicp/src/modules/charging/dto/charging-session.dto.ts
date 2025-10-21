import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsObject,
  IsISO8601,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { TokenTypes } from 'evio-library-commons'

export class PaymentConditionsDto {
  @IsString()
  paymentType: string

  @IsString()
  paymentMethod: string

  @IsString()
  paymentMethodId: string

  @IsNumber()
  walletAmount: number

  @IsNumber()
  reservedAmount: number

  @IsNumber()
  confirmationAmount: number

  @IsString()
  userIdWillPay: string

  @IsString()
  userIdToBilling: string

  @IsString()
  adyenReference: string

  @IsString()
  transactionId: string

  @IsString()
  clientType: string

  @IsString()
  clientName: string
}

export class CdrTokenDto {
  @IsString()
  uid: string

  @IsString()
  type: string

  @IsString()
  contract_id: string
}

export class AddressDto {
  @IsOptional()
  @IsString()
  city?: string

  @IsOptional()
  @IsString()
  street: string

  @IsOptional()
  @IsString()
  zipCode: string

  @IsOptional()
  @IsString()
  country?: string

  @IsOptional()
  @IsString()
  countryCode?: string
}

export class ChargingSessionDto extends PaymentConditionsDto {
  @IsString()
  chargerType: string

  @IsString()
  source: string

  @IsString()
  location_id: string

  @IsNumber()
  kwh: number

  @IsString()
  auth_method: string

  @IsString()
  token_uid: string

  @IsEnum(TokenTypes)
  token_type: TokenTypes

  @IsString()
  status: string

  @IsString()
  id: string

  @IsString()
  commandResultStart: string

  @IsISO8601()
  last_updated: string

  @IsString()
  command: string

  @IsString()
  cdrId: string

  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto

  @IsString()
  paymentStatus: string

  @IsString()
  userId: string

  @IsOptional()
  @IsString()
  evId?: string

  @IsObject()
  total_cost: {
    excl_vat: number
    incl_vat: number
  }

  @ValidateNested()
  @Type(() => CdrTokenDto)
  cdr_token: CdrTokenDto

  @IsString()
  connector_id: string

  @IsObject()
  tariffCEME: Record<string, any>

  @IsObject()
  tariffOPC: Record<string, any>

  @IsOptional()
  @IsString()
  countryCode?: string

  @IsString()
  evse_uid: string

  @IsString()
  party_id: string

  @IsOptional()
  @IsString()
  chargeOwnerId?: string

  @IsOptional()
  @IsString()
  roamingOperatorID?: string

  @IsISO8601()
  start_date_time: string

  @IsOptional()
  @IsString()
  operator?: string

  @IsString()
  createdWay: string
}
