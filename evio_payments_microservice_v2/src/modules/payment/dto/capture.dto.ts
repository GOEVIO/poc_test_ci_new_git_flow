import { IsString, IsNumber, IsNotEmpty } from 'class-validator'

export class CaptureDto {
  @IsNotEmpty()
  @IsString()
  currency: string

  @IsNotEmpty()
  @IsNumber()
  amount: number

  @IsNotEmpty()
  @IsString()
  originalReference: string

  @IsNotEmpty()
  @IsString()
  merchantReference: string
}
