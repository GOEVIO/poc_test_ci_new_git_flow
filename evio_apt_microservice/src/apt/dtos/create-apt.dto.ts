import { Expose, Type } from 'class-transformer'
import {
  IsString,
  Length,
  IsOptional,
  IsBoolean,
  ArrayUnique,
  IsNotEmpty,
} from 'class-validator'

import { ApiProperty } from '@nestjs/swagger'
import { UUID } from 'crypto'
import { AptChargerDto } from '../../chargers/dtos/charger.dto'

export class BodyAptDto {
  @ApiProperty({
    description: 'The brand of the device',
    maxLength: 100,
    example: 'Some Brand',
  })
  @IsString({ message: 'Brand must be a string' })
  @IsNotEmpty({ message: 'Brand should not be empty' })
  @Length(1, 100)
  brand!: string

  @ApiProperty({
    description: 'The model of the device',
    maxLength: 100,
    example: 'Model X',
  })
  @IsString({ message: 'Model must be a string' })
  @IsNotEmpty({ message: 'Model should not be empty' })
  @Length(1, 100)
  model!: string

  @ApiProperty({
    description: 'The financial provider of the device',
    maxLength: 100,
    example: 'Financial Provider Name',
  })
  @IsString({ message: 'Financial Provider must be a string' })
  @IsNotEmpty({ message: 'Financial Provider should not be empty' })
  @Length(1, 100)
  financial_provider!: string

  @ApiProperty({
    description: 'The firmware version of the device',
    maxLength: 100,
    example: '1.0.0',
  })
  @IsString({ message: 'Firmware Version must be a string' })
  @IsNotEmpty({ message: 'Firmware Version should not be empty' })
  @Length(1, 100)
  firmware_version!: string

  @ApiProperty({
    description: 'The Android application version of the device',
    maxLength: 100,
    example: '2.0.0',
  })
  @IsString({ message: 'Android Application Version must be a string' })
  @IsNotEmpty({ message: 'Android Application Version should not be empty' })
  @Length(1, 100)
  android_application_version!: string

  @ApiProperty({
    description: 'The SIM card status of the device',
    type: Boolean,
    example: true,
  })
  @IsBoolean({ message: 'Has SIM Card must be a boolean' })
  has_sim_card!: boolean

  @ApiProperty({
    description: 'IDs of the Charger Stations',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        hwId: { type: 'string' },
        charger_type: { type: 'string' },
      },
    },
    example: [
      { hwId: 'hwId1', charger_type: 'type1' },
      { hwId: 'hwId2', charger_type: 'type2' },
    ],
    required: false,
    uniqueItems: true,
  })
  @IsOptional()
  @Type(() => AptChargerDto)
  @ArrayUnique({ message: 'IDs of the Charger Stations must be unique' })
  chargers?: AptChargerDto[]

  @ApiProperty({
    description: 'Networks available in Evio',
    type: [String],
    required: false,
    example: ['Network1', 'Network2'],
  })
  @IsString({
    each: true,
    message: 'Networks Available in Evio must be an array of strings',
  })
  @ArrayUnique({ message: 'Networks Available in Evio must be unique' })
  networks_available?: string[]

  @ApiProperty({
    description: 'Tariff Type of the device',
    default: 'AD_HOC',
    maxLength: 50,
  })
  @IsOptional()
  @IsString({
    message: 'Tariff Type must be a string',
  })
  tariff_type?: string

  @ApiProperty({
    description: 'Description of the Agreement',
    required: false,
    maxLength: 500,
    example: 'Description of the Agreement',
  })
  @IsOptional()
  @IsString({
    message: 'Description of the Agreement must be a string',
  })
  description_of_the_agreement?: string

  @ApiProperty({
    description: 'Serial Number of the device',
    maxLength: 100,
    example: '000353535',
  })
  @IsString({ message: 'Serial Number must be a string' })
  @IsNotEmpty({ message: 'Serial Number should not be empty' })
  serial_number!: string

  @ApiProperty({
    description: 'The client name associated with the APT',
    maxLength: 20,
    example: 'EVIO',
  })
  @IsString({ message: 'Client Name must be a string' })
  @IsNotEmpty({ message: 'Client Name should not be empty' })
  client_name!: string

  @ApiProperty({
    description: 'The IP address of the device',
    maxLength: 100,
    example: '192.000.0.1',
  })
  @IsString({ message: 'IP must be a string' })
  @IsNotEmpty({ message: 'IP should not be empty' })
  ip?: string

  @ApiProperty({
    description: 'The user ID of the creator',
    maxLength: 100,
    example: '688ce949e8a4a0e373ba0a22',
  })
  @IsString({ message: 'Create User ID must be a string' })
  @IsNotEmpty({ message: 'Create User ID should not be empty' })
  create_user_id!: string

  @ApiProperty({
    description: 'The user ID of the APT owner',
    maxLength: 100,
    example: '688ce949e8a4a0e373ba0a22',
  })
  @IsString({ message: 'APT Owner ID must be a string' })
  @IsNotEmpty({ message: 'APT Owner ID should not be empty' })
  apt_owner_id!: string
}

export class CreateAptResponseDto {
  @ApiProperty({ description: 'The ID of the created APT', type: String })
  @Expose()
  id?: UUID

  @ApiProperty({ description: 'The APT serial number', type: String })
  @Expose()
  serial_number!: string

  @ApiProperty({
    description: 'The user ID associated with the APT',
    type: String,
  })
  @Expose()
  user_id!: string
}
