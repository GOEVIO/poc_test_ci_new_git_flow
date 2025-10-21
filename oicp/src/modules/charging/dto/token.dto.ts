import { Expose } from "class-transformer"
import { IsString } from "class-validator"
import { TokenTypes } from "evio-library-commons"

export class TokenDto {
  @IsString()
  uid: string

  @IsString()
  type: TokenTypes

  @IsString()
  userId: string

  @IsString()
  evId: string

  @IsString()
  @Expose({ name: 'contract_id' })
  contractId: string
}
