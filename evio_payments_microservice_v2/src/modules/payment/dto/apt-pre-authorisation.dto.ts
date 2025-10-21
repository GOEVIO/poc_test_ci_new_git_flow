import { IsNotEmpty, IsNumber, IsString } from 'class-validator'
import { v7 as uuidv7 } from 'uuid'
export class AptPreAuthorisationDto {
  @IsNotEmpty()
  @IsNumber()
  amount: number

  @IsNotEmpty()
  @IsString()
  currency: string

  @IsNotEmpty()
  @IsString()
  serial: string //ADYEN_POS_POI_ID

  @IsNotEmpty()
  @IsString()
  merchantReference: string

  constructor() {
    this.merchantReference = uuidv7()
  }
}
