import { IsString, IsNotEmpty, IsEnum } from 'class-validator'
import { PreAuthorizationStatusReason } from 'evio-library-commons'

export class CancelPreAuthorisationDto {
  @IsNotEmpty()
  @IsString()
  originalReference: string

  @IsNotEmpty()
  @IsString()
  merchantReference: string

  @IsNotEmpty()
  @IsEnum(PreAuthorizationStatusReason)
  statusReason: PreAuthorizationStatusReason
}
