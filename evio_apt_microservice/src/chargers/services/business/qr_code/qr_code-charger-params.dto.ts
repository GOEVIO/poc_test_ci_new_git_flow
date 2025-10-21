import { Injectable } from '@nestjs/common'
import { IsDefined, IsString, Length } from 'class-validator'

@Injectable()
export class QRCodeChargerParamsDto {
  @IsString({ message: 'charger_type must be a string' })
  @Length(3, 3, { message: 'charger_type must be exactly 3 characters long' })
  @IsDefined({ message: 'charger_type is required' })
  charger_type!: string

  @IsString({ message: 'hwId must be a string' })
  @IsDefined({ message: 'hwId is required' })
  hwId!: string
}
