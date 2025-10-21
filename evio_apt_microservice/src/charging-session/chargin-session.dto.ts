import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  ValidateIf,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { isPublicCharger } from 'evio-library-commons'
import { Transform } from 'class-transformer'

class ChargingSessionDefaultDataDto {
  @ApiPropertyOptional({
    description: 'Electric vehicle ID',
    example: '-1',
    default: '-1',
  })
  @IsOptional()
  evId?: string

  @ApiProperty({
    description: 'Charger ID',
    example: 'CBC-00011',
  })
  @IsString({ message: 'Charger ID must be a string' })
  @IsNotEmpty({ message: 'Charger ID must not be empty' })
  chargerId!: string

  @ApiProperty({
    description: 'Plug ID',
    example: 'CBC-00011-01-01',
  })
  @IsString({ message: 'Plug ID must be a string' })
  @IsNotEmpty({ message: 'Plug ID must not be empty' })
  plugId!: string

  @ApiProperty({
    description: 'Charger Type',
    example: '004',
  })
  @IsString({ message: 'Charger Type must be a string' })
  @IsNotEmpty({ message: 'Charger Type must not be empty' })
  chargerType!: string

  @IsString({ message: 'User ID must be a string' })
  @IsNotEmpty({ message: 'User ID must not be empty' })
  @ApiProperty({
    description: 'User ID',
    example: '6895e74ccc69504e24bb6540',
  })
  userId!: string

  @ApiProperty({
    description: 'The client name associated with the APT',
    maxLength: 20,
    example: 'EVIO',
  })
  @IsString({ message: 'Client Name must be a string' })
  @IsOptional()
  client_name?: string

  @IsString({ message: 'Client Type must be a string' })
  @IsNotEmpty({ message: 'Client Type must not be empty' })
  clientType!: string
}

export class ChargingSessionDto extends ChargingSessionDefaultDataDto {
  @ApiProperty({
    description: 'Payment Service Provider Reference',
    example: 'HQ78G8NF1LSM7L75',
  })
  @IsString({ message: 'Card pspReference must be a string' })
  @IsNotEmpty({ message: 'Card pspReference must not be empty' })
  @Length(5, 54, {
    message: 'Card pspReference must be between 5 and 54 characters long',
  })
  pspReference!: string

  @ApiPropertyOptional({
    description: 'Tariff ID',
    example: '-1',
    default: '-1',
  })
  @ValidateIf((o) => !isPublicCharger(o.chargerType))
  @IsNotEmpty({
    message: 'Tariff ID must not be empty when charger is not public',
  })
  @IsString({ message: 'Tariff ID must be a string' })
  @Transform(({ obj, value }) =>
    isPublicCharger(obj.chargerType) ? '-1' : value
  )
  tariffId?: string
}

export class StopChargingSessionDto extends ChargingSessionDefaultDataDto {
  @ApiProperty({
    description: 'Session ID',
    example: '6899d07c189b880013bfc27e',
  })
  @IsString({ message: 'Session ID must be a string' })
  @IsNotEmpty({ message: 'Session ID must not be empty' })
  sessionId!: string
}
