import {
  IsOptional,
  IsString,
  IsEmail,
  IsBoolean,
  IsEnum,
  IsObject,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { defaultTin, TinType } from 'evio-library-commons'

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

export class BillingBodyDto {
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

  @ApiPropertyOptional({ type: String })
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
}
