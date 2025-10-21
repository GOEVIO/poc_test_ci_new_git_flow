import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator'
export class AdjustPreAuthorisationDto {
  @IsNotEmpty()
  @IsString()
  originalReference: string

  @IsNotEmpty()
  @IsNumber()
  amount: number

  @IsNotEmpty()
  @IsString()
  currency: string

  @IsNotEmpty()
  @IsString()
  merchantReference: string

  @IsNotEmpty()
  @IsString()
  adjustAuthorisationData: string

  @IsOptional()
  @IsNumber()
  refusalTestCode?: number
}
