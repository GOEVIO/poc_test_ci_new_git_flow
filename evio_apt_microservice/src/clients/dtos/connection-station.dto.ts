import { Transform } from 'class-transformer'
import {
  IsDefined,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class ConnectionStationSessionBodyDto {
  @ApiProperty({
    enum: ['start', 'stop'],
    description: "Action to perform: 'start' or 'stop'",
    example: 'start',
  })
  @IsEnum(['start', 'stop'], {
    message: "Action must be either 'start' or 'stop'",
  })
  action!: 'start' | 'stop'

  @ApiPropertyOptional({
    description: 'Electric vehicle ID',
    example: 'EV123',
    default: '-1',
  })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => value ?? '-1')
  evId!: string

  @ApiProperty({
    description: 'ID Tag',
    example: 'IDTAG123',
  })
  @IsString({ message: 'ID Tag must be a string' })
  idTag!: string

  @ApiProperty({
    description: 'Charger ID',
    example: 'CHARGER123',
  })
  @IsString({ message: 'Charger ID must be a string' })
  chargerId!: string

  @ApiProperty({
    description: 'Plug ID',
    example: 'PLUG123',
  })
  @IsString({ message: 'Plug ID must be a string' })
  plugId!: string

  @ApiProperty({
    description: 'Charger Type',
    example: 'TYPE2',
  })
  @IsString({ message: 'Charger Type must be a string' })
  chargerType!: string

  @ApiProperty({
    description: 'User ID',
    example: 'USER123',
  })
  @IsString({ message: 'User ID must be a string' })
  @IsNotEmpty({ message: 'User ID must not be empty' })
  userId!: string

  @IsOptional()
  clientType?: string

  @IsOptional()
  clientName?: string
}

export class ConnectionStationSessionStartBodyDto extends ConnectionStationSessionBodyDto {
  @ApiProperty({
    description: 'Card PSP Reference',
    example: 'PSP123',
  })
  @IsString({ message: 'Card pspReference must be a string' })
  @IsNotEmpty({ message: 'Card pspReference must not be empty' })
  adyenReference?: string

  @IsOptional()
  paymentMethod?: string

  @IsOptional()
  paymentMethodId?: string

  @IsOptional()
  userIdWillPay?: string

  @IsOptional()
  transactionId?: string

  @IsOptional()
  ceme?: any

  @IsOptional()
  viesVAT?: boolean

  @IsOptional()
  paymentType?: string

  @IsOptional()
  billingPeriod?: string

  @IsOptional()
  userIdToBilling?: string

  @IsOptional()
  tariffId?: string
}

export class ConnectionStationSessionStopBodyDto extends ConnectionStationSessionBodyDto {
  @IsDefined()
  @IsString()
  sessionId!: string
}

export class ConnectionStationSessionResponseDto {
  @ApiProperty({ description: 'Authorization result', example: 'true' })
  auth!: string | boolean

  @ApiProperty({ description: 'Response code', example: 'SUCCESS' })
  code!: string

  @ApiProperty({ description: 'Response message', example: 'Session started' })
  message!: string

  @ApiProperty({ description: 'Session ID', example: 'SESSION123' })
  sessionId!: string

  @ApiPropertyOptional({ description: 'Hardware ID', example: 'HW123' })
  hwId?: string

  @ApiPropertyOptional({ description: 'User ID', example: 'USER123' })
  userId?: string

  @ApiPropertyOptional({
    description: 'Authorization reference',
    example: 'AUTHREF123',
  })
  authorization_reference?: string

  @ApiPropertyOptional({ description: 'User name', example: 'John Doe' })
  name?: string

  @ApiPropertyOptional({
    description: 'Internal log',
    example: 'Log details...',
  })
  internalLog?: string

  @ApiPropertyOptional({ description: 'Status code', example: 200 })
  status?: number

  @ApiPropertyOptional({ description: 'Action performed', example: 'start' })
  action?: string

  @ApiPropertyOptional({ description: 'Current stage', example: 'charging' })
  stage?: string

  @ApiPropertyOptional({
    description: 'Error type',
    example: 'ValidationError',
  })
  errorType?: string

  @ApiPropertyOptional({
    description: 'Log message',
    example: 'Some log message',
  })
  logMessage?: string

  @ApiPropertyOptional({ description: 'Stage prefix', example: 'pre-check' })
  stage_pre_fix?: string

  @ApiPropertyOptional({
    description: 'Retries',
    type: [String],
    example: ['retry1', 'retry2'],
  })
  retries?: string[]

  @ApiPropertyOptional({ description: 'Response already sent', example: false })
  responseAlreadySended?: boolean

  @ApiPropertyOptional({ description: 'Plug ID', example: 'PLUG123' })
  plugId?: string

  @ApiPropertyOptional({ description: 'HTTP status code', example: 201 })
  statusCode?: number
}
