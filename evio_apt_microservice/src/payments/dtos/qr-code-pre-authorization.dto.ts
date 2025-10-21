import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Expose } from 'class-transformer'
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator'
import { defaultTin, TinType } from 'evio-library-commons'
import { v7 as uuidv7 } from 'uuid'

class AddressDto {
  @ApiProperty({ type: String })
  @IsOptional()
  @IsString()
  street!: string

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  postalCode?: string

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  city?: string

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  country?: string

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  countryCode?: string

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  number?: string

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  floor?: string
}

class BillingInfoDto {
  @ApiProperty({ type: String })
  @IsOptional()
  @IsString()
  name?: string = 'Final Consumer'

  @ApiProperty({ type: String, description: 'Email of the user' })
  @IsEmail({}, { message: 'Invalid email format' })
  email!: string

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  phone?: string

  @ApiPropertyOptional({ type: AddressDto })
  @IsOptional()
  @IsObject()
  address?: AddressDto

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  tin?: string = defaultTin

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  viesVat?: boolean = false

  @ApiProperty({ enum: TinType })
  @IsOptional()
  @IsEnum(TinType)
  clientType?: TinType = TinType.PRIVATE

  @IsOptional()
  @IsString()
  language?: string

  @IsOptional()
  @IsString()
  userId?: string
}

export class QrCodePreAuthorizationBodyDto {
  @IsNotEmpty()
  @IsString()
  encryptedCardNumber!: string

  @IsNotEmpty()
  @IsString()
  encryptedSecurityCode!: string

  @IsNotEmpty()
  @IsString()
  encryptedExpiryMonth!: string

  @IsNotEmpty()
  @IsString()
  encryptedExpiryYear!: string

  @IsNotEmpty()
  @IsString()
  holderName!: string

  @IsNotEmpty()
  @IsString()
  currency!: string

  @IsNotEmpty()
  @IsNumber()
  amount!: number

  @IsString()
  @IsOptional()
  merchantReference: string = uuidv7()

  @IsOptional()
  @IsString()
  returnUrl?: string

  @IsOptional()
  @IsObject()
  billingInfo?: BillingInfoDto
}

export class QrCodePreAuthorizationResponseDto {
  @ApiProperty({
    description: 'Transaction ID for the pre-authorization',
    type: 'string',
    example: 'transaction_123456789',
  })
  @Expose()
  pspReference!: string

  @ApiProperty({
    description: 'Transaction ID for the pre-authorization',
    type: 'string',
    example: 'transaction_123456789',
  })
  @Expose()
  preAuthorisationId!: string
}
