import { Expose, Transform, Type } from 'class-transformer'

import { ApiProperty } from '@nestjs/swagger'
import { UUID } from 'crypto'
import { MockAptResultExample } from '../tests/mocks/apt-result.example'

export class GetPlugResponse {
  @ApiProperty({
    description: 'Unique identifier for the plug Postgres ID',
    type: 'string',
    format: 'uuid',
  })
  @Expose()
  id!: UUID

  @ApiProperty({
    description: 'Unique identifier for the plug',
    type: 'string',
    format: 'string',
  })
  @Expose()
  plug_id!: string

  @ApiProperty({
    description: 'Unique identifier for the charger',
    type: 'string',
    format: 'uuid',
  })
  @Expose()
  chargerId!: UUID
}

export class GetChargerResponse {
  @ApiProperty({
    description: 'Unique identifier for the charger Postgres ID',
    type: 'string',
    format: 'uuid',
  })
  @Expose()
  id!: UUID

  @ApiProperty({
    description: 'Unique identifier for the charger',
    type: 'string',
    format: 'string',
  })
  @Expose()
  hwId!: string

  @ApiProperty({
    description: 'Unique identifier for the charger',
    type: 'string',
    format: 'string',
  })
  @Expose()
  charger_type!: string

  @ApiProperty({
    description: 'Plug information associated with the charger',
    type: GetPlugResponse,
  })
  @Expose()
  @Type(() => GetPlugResponse)
  plugs?: GetPlugResponse
}

export class GetAptResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the APT',
    type: 'string',
    format: 'uuid',
  })
  @Expose()
  id?: UUID

  @ApiProperty({
    description: 'Brand of the APT',
    example: MockAptResultExample.brand,
    type: 'string',
  })
  @Expose()
  brand!: string

  @ApiProperty({
    description: 'Model of the APT',
    example: MockAptResultExample.model,
    type: 'string',
  })
  @Expose()
  model!: string

  @ApiProperty({
    description: 'Financial provider associated with the APT',
    example: MockAptResultExample.financial_provider,
    type: 'string',
  })
  @Expose()
  financial_provider!: string

  @ApiProperty({
    description: 'Firmware version of the APT',
    example: MockAptResultExample.firmware_version,
    type: 'string',
  })
  @Expose()
  firmware_version!: string

  @ApiProperty({
    description: 'Android application version running on the APT',
    example: MockAptResultExample.android_application_version,
    type: 'string',
  })
  @Expose()
  android_application_version!: string

  @ApiProperty({
    description: 'Indicates if the APT has a SIM card',
    type: 'boolean',
    example: MockAptResultExample.has_sim_card,
  })
  @Expose()
  has_sim_card!: boolean

  @ApiProperty({
    description: 'Number of charger stations connected to the APT',
    required: false,
    type: 'number',
    example: MockAptResultExample.number_of_chargers,
  })
  @Expose()
  number_of_chargers?: number

  @ApiProperty({
    description: 'IDs of the charger stations connected to the APT',
    type: 'array',
    items: { type: 'object', properties: { hwId: { type: 'string' } } },
    required: false,
    example: MockAptResultExample.chargers,
    uniqueItems: true,
  })
  @Expose()
  @Type(() => GetChargerResponse)
  chargers?: GetChargerResponse[]

  @ApiProperty({
    description: 'Networks available in Evio for this APT',
    type: 'array',
    items: { type: 'string' },
    example: MockAptResultExample.networks_available,
    required: true,
    uniqueItems: true,
  })
  @Expose()
  networks_available!: string[]

  @ApiProperty({
    description: 'Tariff type for the APT',
    default: 'AD_HOC',
    type: 'string',
    example: MockAptResultExample.tariff_type,
  })
  @Expose()
  tariff_type!: string

  @ApiProperty({
    description: 'Description of the agreement',
    required: false,
    type: 'string',
    example: MockAptResultExample.description_of_the_agreement,
  })
  @Expose()
  description_of_the_agreement?: string

  @ApiProperty({
    description: 'Serial number of the APT',
    uniqueItems: true,
    example: MockAptResultExample.serial_number,
    type: 'string',
  })
  @Expose()
  serial_number!: string

  @ApiProperty({
    description: 'User ID associated with the APT',
    type: 'string',
    example: MockAptResultExample.user_id,
  })
  @Expose()
  user_id!: string

  @ApiProperty({
    description: 'Date when the APT was created',
    type: 'string',
    format: 'date-time',
    required: false,
    example: MockAptResultExample.created_at,
  })
  @Expose()
  @Transform(({ value }) =>
    value instanceof Date ? value.toISOString() : value
  )
  created_at?: Date | string

  @ApiProperty({
    description: 'Date when the APT was last updated',
    type: 'string',
    format: 'date-time',
    required: false,
    example: MockAptResultExample.updated_at,
  })
  @Expose()
  @Transform(({ value }) =>
    value instanceof Date ? value.toISOString() : value
  )
  updated_at?: Date | string

  @ApiProperty({
    description: 'Client name associated with the APT',
    example: MockAptResultExample.client_name,
    type: 'string',
  })
  @Expose()
  client_name!: string

  @ApiProperty({
    description: 'The user ID of the APT owner',
    example: MockAptResultExample.apt_owner_id,
    type: 'string',
  })
  @Expose()
  apt_owner_id!: string

  @ApiProperty({
    description: 'The user ID of the creator',
    example: MockAptResultExample.create_user_id,
    type: 'string',
  })
  @Expose()
  create_user_id!: string
}
