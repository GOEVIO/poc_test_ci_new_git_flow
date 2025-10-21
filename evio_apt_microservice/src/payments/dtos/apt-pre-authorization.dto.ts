import { ApiProperty } from '@nestjs/swagger'
import {
  IsDefined,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator'
import { PreAuthorizationStatusReason } from 'evio-library-commons'

export class AptPreAuthorizationBodyDto {
  @ApiProperty({
    description: 'Pre Authorization Amount',
    type: 'number',
    example: 100,
  })
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'Invalid amount' }
  )
  amount!: number

  @ApiProperty({
    description: 'Pre Authorization Currency',
    type: 'string',
    example: 'EUR',
  })
  @IsNotEmpty({ message: 'Invalid currency' })
  currency!: string

  @ApiProperty({
    description: 'Pre Authorization Serial Number',
    type: 'string',
  })
  @IsOptional()
  serialNumber?: string

  @ApiProperty({
    description: 'Pre Authorization Model',
    type: 'string',
  })
  @IsOptional()
  model?: string
}

export class AptPreAuthorizationResponseDto {
  @ApiProperty({
    description: 'Hash userCardHash for the pre-authorization',
    type: 'string',
    example: 'hash_123456789',
  })
  userCardHash!: string

  @ApiProperty({
    description: 'Transaction ID for the pre-authorization',
    type: 'string',
    example: 'transaction_123456789',
  })
  pspReference!: string

  @ApiProperty({
    description: 'Transaction ID for the pre-authorization',
    type: 'string',
    example: 'transaction_123456789',
  })
  preAuthorisationId!: string
}

export class AptCancelPreAuthorizationBody {
  @ApiProperty({
    description: 'PSP Reference for the canceled pre-authorization',
    type: 'string',
    example: 'R3GWM322JLF4QM65',
  })
  @IsDefined()
  @IsString()
  pspReference!: string

  @ApiProperty({
    description: 'Reason for the canceled pre-authorization',
    type: 'string',
  })
  @IsOptional()
  @IsEnum(PreAuthorizationStatusReason, { message: 'Invalid status reason' })
  statusReason?: PreAuthorizationStatusReason
}
