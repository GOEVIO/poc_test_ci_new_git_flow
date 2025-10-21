import { PaymentsV2Client } from '../../clients/payments-v2.client'
import { Injectable } from '@nestjs/common'
import {
  QrCodePreAuthorizationBodyDto,
  QrCodePreAuthorizationResponseDto,
} from '../dtos/qr-code-pre-authorization.dto'
import { plainToInstance } from 'class-transformer'
import { DeviceTypes, ClientNames } from 'evio-library-commons'
import { findUser } from 'evio-library-identity'

@Injectable()
export class QrCodePaymentService {
  constructor(private readonly paymentsV2Client: PaymentsV2Client) {}

  async makePreAuthorize(
    body: QrCodePreAuthorizationBodyDto
  ): Promise<QrCodePreAuthorizationResponseDto> {
    const {
      amount,
      currency,
      merchantReference,
      returnUrl,
      holderName,
      encryptedExpiryYear,
      encryptedExpiryMonth,
      encryptedSecurityCode,
      encryptedCardNumber,
      billingInfo,
    } = body

    const user = (await findUser(
      {
        email: billingInfo.email,
        active: true,
        clientName: ClientNames.EVIO,
      },
      { _id: 1 }
    )) as any

    const userId = user?._id ?? null

    if (billingInfo?.address && billingInfo?.address?.street.trim() !== '') {
      const [street, number, floor] = billingInfo?.address?.street.split(',')
      billingInfo.address = {
        ...billingInfo.address,
        street: street?.trim(),
        number: number?.trim(),
        floor: floor?.trim(),
      }
    }

    const data = await this.paymentsV2Client.preAuthorize(
      {
        amount,
        encryptedCardNumber,
        encryptedSecurityCode,
        encryptedExpiryMonth,
        encryptedExpiryYear,
        holderName,
        currency,
        merchantReference,
        returnUrl,
        billingInfo,
        userId,
      },
      DeviceTypes.QR_CODE
    )
    return plainToInstance(QrCodePreAuthorizationResponseDto, data, {
      excludeExtraneousValues: true,
    })
  }
}
