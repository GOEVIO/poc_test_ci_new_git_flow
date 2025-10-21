import {
  AptCancelPreAuthorizationBody,
  AptPreAuthorizationResponseDto,
} from '../dtos/apt-pre-authorization.dto'
import { PaymentsV2Client } from '../../clients/payments-v2.client'
import { GetSessionClient } from '../../clients/get-sessions/get-session.client'
import { PaymentsLibraryService } from '../../libraries/payments/payments-library.service'
import {
  GetSessionClientResponseFoundDto,
  GetSessionClientResponseNotFoundDto,
} from '../../clients/get-sessions/get-sessions.dto'
import { formatSessions } from '../../core/helpers'
import { CancelPreAuthorizationResponse } from '../../clients/dtos/pre-authorization.dto'
import { Apt } from '../../database/entities/apt.entity'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { AptPreAuthorizationBodyDto } from '../dtos/apt-pre-authorization.dto'
import { DeviceTypes } from 'evio-library-commons'

@Injectable()
export class AptPaymentService {
  constructor(
    private readonly paymentsV2Client: PaymentsV2Client,
    private readonly getSessionClient: GetSessionClient,
    private readonly paymentsLibraryService: PaymentsLibraryService
  ) {}

  async makePreAuthorize(
    body: AptPreAuthorizationBodyDto
  ): Promise<AptPreAuthorizationResponseDto> {
    const data = await this.paymentsV2Client.preAuthorize(
      {
        amount: body.amount,
        serial: `${body.model}-${body.serialNumber}`,
        currency: body.currency,
      },
      DeviceTypes.APT
    )
    return {
      pspReference:
        data?.SaleToPOIResponse?.PaymentResponse?.PaymentResult
          ?.PaymentAcquirerData?.AcquirerTransactionID?.TransactionID || '',
      userCardHash: data.userCardHash,
      preAuthorisationId: data.preAuthorisationId,
    }
  }

  async identifyCard(
    serial_number: string,
    apt: Apt
  ): Promise<
    GetSessionClientResponseNotFoundDto | GetSessionClientResponseFoundDto
  > {
    const { userCardHash = '' } = await this.paymentsV2Client.identify(
      `${apt?.model}-${serial_number}`
    )

    if (!userCardHash) {
      throw new NotFoundException({
        success: false,
        message: 'User card not found',
        code: 'user_card_not_found',
      })
    }

    const { hwIds = [], listOfIds = [] } =
      await this.paymentsLibraryService.getActivePreAuthorizationSessionIdByCardHash(
        userCardHash
      )
    if (!listOfIds || listOfIds.length === 0) {
      throw new NotFoundException({
        success: false,
        message: 'No active pre-authorization found',
        code: 'no_active_pre_authorization_found',
      })
    }
    const chargerType =
      hwIds
        .map(
          (hwId) => apt?.chargers?.find((c) => c.hwId === hwId)?.charger_type
        )
        .find((type) => !!type) || '004'

    this.getSessionClient.setGetSessionClient(chargerType)

    const sessions = await Promise.all(
      listOfIds.map((sessionIdInternal) =>
        this.getSessionClient.getSession(sessionIdInternal)
      )
    )

    if (!sessions || sessions.length === 0) {
      throw new NotFoundException({
        success: false,
        message: 'No active sessions found',
        code: 'no_active_sessions_found',
      })
    }

    const formattedSessions = formatSessions(sessions)

    if (
      (Array.isArray((formattedSessions as any).chargingSession) &&
        !(formattedSessions as any).chargingSession.length) ||
      !(
        formattedSessions &&
        typeof formattedSessions === 'object' &&
        'chargingSession' in formattedSessions &&
        formattedSessions.chargingSession
      )
    ) {
      throw new NotFoundException({
        success: false,
        message: 'No active sessions found',
        code: 'no_active_sessions_found',
      })
    }

    return formattedSessions
  }

  async cancelPreAuthorization(
    body: AptCancelPreAuthorizationBody
  ): Promise<CancelPreAuthorizationResponse> {
    const preAuthorization: any =
      await this.paymentsLibraryService.getPreAuthorizationByPSPReference(
        body.pspReference
      )

    if (!preAuthorization?.active || !preAuthorization?.transactionId) {
      throw new BadRequestException({
        success: false,
        message: 'No active pre-authorization found',
        code: 'no_active_pre_authorization_found',
      })
    }

    const { pspReference, response } =
      await this.paymentsV2Client.cancelPreAuthorization({
        merchantReference: preAuthorization.transactionId,
        originalReference: body.pspReference,
        statusReason: body.statusReason || '',
      })

    return { pspReference, response }
  }
}
