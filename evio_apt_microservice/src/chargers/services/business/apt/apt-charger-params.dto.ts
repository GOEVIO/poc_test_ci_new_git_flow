import { Injectable } from '@nestjs/common'
import { IsDefined, IsString, MinLength } from 'class-validator'

@Injectable()
export class APTChargerParamsDto {
  @IsString({ message: 'serial_number must be a string' })
  @MinLength(5, { message: 'serial_number must be at least 5 characters long' })
  @IsDefined({ message: 'serial_number is required' })
  serial_number!: string
}
