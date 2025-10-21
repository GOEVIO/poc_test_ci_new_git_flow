import { IsNotEmpty, IsString } from 'class-validator'
import { v7 as uuidv7 } from 'uuid'
export class AptIdentifyUserDto {
  @IsNotEmpty()
  @IsString()
  serial: string //ADYEN_POS_POI_ID

  @IsNotEmpty()
  @IsString()
  transactionId: string //POS_SALE_ID

  constructor() {
    this.transactionId = uuidv7()
  }
}
