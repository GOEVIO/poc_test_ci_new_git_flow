import { IsDate, IsEnum, IsNumber, ValidateNested, IsString, IsOptional } from 'class-validator'
import { BaseRequestDto, IdentificationDto } from './physical-charging.dto'
import { Expose, Type } from 'class-transformer'
import {
  ChargingNotificationErrorType,
  ChargingNotificationType,
} from '../enums/charging-notification'

export class BaseChargingNotificationDto extends BaseRequestDto {
  @IsEnum(ChargingNotificationType)
  @Expose({ name: 'Type' })
  type: ChargingNotificationType

  @IsString()
  @Expose({ name: 'SessionID' })
  sessionId: string
}

export class ChargingNotificationStartDto extends BaseChargingNotificationDto {
  @ValidateNested()
  @Type(() => IdentificationDto)
  @Expose({ name: 'Identification' })
  identification!: IdentificationDto

  @IsDate()
  @Expose({ name: 'ChargingStart' })
  chargingStart: Date

  @IsNumber()
  @Expose({ name: 'MeterValueStart' })
  meterValueStart: number

  @IsDate()
  @Expose({ name: 'SessionStart' })
  sessionStart: Date
}

export class ChargingNotificationProgressDto extends ChargingNotificationStartDto {
  @IsDate()
  @Expose({ name: 'EventOccurred' })
  eventOccurred: Date

  @IsNumber()
  @Expose({ name: 'ChargingDuration' })
  chargingDuration: number

  @IsNumber()
  @Expose({ name: 'ConsumedEnergyProgress' })
  consumedEnergyProgress: number

  @ValidateNested()
  @Expose({ name: 'MeterValueInBetween' })
  meterValuesInBetween!: { meterValues: Array<number> }
}

export class ChargingNotificationEndDto extends ChargingNotificationStartDto {
  @IsDate()
  @Expose({ name: 'SessionEnd' })
  sessionEnd: Date

  @IsDate()
  @Expose({ name: 'PenaltyTimeStart' })
  penaltyTimeStart: Date

  @IsDate()
  @Expose({ name: 'ChargingEnd' })
  chargingEnd: Date

  @IsNumber()
  @Expose({ name: 'ConsumedEnergy' })
  ConsumedEnergy: number

  @IsNumber()
  @Expose({ name: 'MeterValueEnd' })
  meterValueEnd: number

  @ValidateNested()
  @Expose({ name: 'MeterValueInBetween' })
  meterValues!: { meterValues: Array<number> }
}

export class ChargingNotificationErrorDto extends BaseChargingNotificationDto {
  @IsEnum(ChargingNotificationErrorType)
  @Expose({ name: 'ErrorType' })
  errorType: ChargingNotificationErrorType
}

export class ReadingPointDto {
  @IsNumber()
  @Expose()
  totalPower: number

  @IsOptional()
  @IsNumber()
  @Expose()
  readDate?: Date = new Date()

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  @Expose()
  communicationDate?: Date

  @IsOptional()
  @IsNumber()
  @Expose()
  instantPower?: number = -1

  @IsOptional()
  @IsNumber()
  @Expose()
  instantVoltage?: number = -1

  @IsOptional()
  @IsNumber()
  @Expose()
  batteryCharged?: number = -1

  @IsOptional()
  @IsNumber()
  @Expose()
  instantAmperage?: number = -1
}
