import {
  IsDefined,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator'

export class PaymentsPreAuthorisationBodyDto {
  @IsNotEmpty()
  @IsNumber()
  amount!: number

  @IsNotEmpty()
  @IsString()
  currency!: string

  @IsNotEmpty()
  @IsString()
  serial!: string

  @IsNotEmpty()
  @IsString()
  clientName!: string
}

export class IPreAuthorizationPaymentResponse {
  SaleToPOIResponse!: {
    PaymentResponse: {
      PaymentResult: {
        PaymentAcquirerData: {
          AcquirerTransactionID: {
            TransactionID: string
          }
        }
      }
    }
  }
  preAuthorisationId!: string
  userCardHash!: string
}

export class IPreAuthorizationResponse {
  userCardHash!: string
  pspReference!: string
  preAuthorisationId!: string
}

export class CancelPreAuthorization {
  @IsString()
  @IsDefined()
  merchantReference!: string

  @IsString()
  @IsDefined()
  originalReference!: string

  @IsString()
  @IsOptional()
  statusReason?: string
}

export class CancelPreAuthorizationResponse {
  pspReference!: string
  response!: string
}
