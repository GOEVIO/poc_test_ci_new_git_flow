import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common'
import { ChargersLibraryService } from '../libraries/chargers-library.service'
import { ConnectionStationClient } from '../clients/connection-station.client'
import { OcpiLibraryService } from '../libraries/ocpi-library.service'
import { PaymentsLibraryService } from '../libraries/payments/payments-library.service'
import {
  ChargingSessionDto,
  StopChargingSessionDto,
} from './chargin-session.dto'
import {
  ConnectionStationSessionResponseDto,
  ConnectionStationSessionStartBodyDto,
  ConnectionStationSessionStopBodyDto,
} from '../clients/dtos/connection-station.dto'
import { validatePaymentCondition } from '../core/helpers'
import {
  PaymentsMethods,
  PaymentType,
  BillingPeriods,
  isPublicCharger,
} from 'evio-library-commons'
import { ControllerResult } from '../common/result-wrappers'

@Injectable()
export class ChargersSessionService {
  constructor(
    private readonly connectionStationClient: ConnectionStationClient,
    private readonly ocpiLibraryService: OcpiLibraryService,
    private readonly chargerLibraryService: ChargersLibraryService,
    private readonly paymentsLibraryService: PaymentsLibraryService
  ) {}

  async startSession(
    body: ChargingSessionDto
  ): Promise<ControllerResult<ConnectionStationSessionResponseDto | null>> {
    const preAuthorization =
      await this.paymentsLibraryService.getPreAuthorizationByPSPReference(
        body.pspReference
      )
    if (!preAuthorization) {
      throw new BadRequestException({
        success: false,
        message: 'Invalid PSP Reference',
        code: 'invalid_psp_reference',
      })
    }

    const isValidPaymentCondition = validatePaymentCondition(preAuthorization)

    if (!isValidPaymentCondition.valid) {
      throw new BadRequestException({
        success: isValidPaymentCondition.valid,
        message: isValidPaymentCondition.message,
        code: isValidPaymentCondition.code,
      })
    }

    const adHocContract = await this.ocpiLibraryService.createAdHocContract(
      body.userId,
      body.chargerType
    )

    if (!adHocContract) {
      throw new InternalServerErrorException({
        success: false,
        message: 'Failed to create ad-hoc contract',
        code: 'ad_hoc_contract_creation_failed',
      })
    }
    try {
      const data =
        await this.connectionStationClient.handleSession<ConnectionStationSessionStartBodyDto>(
          {
            ...body,
            idTag: adHocContract,
            action: 'start',
            evId: body?.evId || '-1',
            adyenReference: body.pspReference,
            paymentMethod: PaymentsMethods.Card,
            paymentMethodId: preAuthorization.paymentMethodId,
            userIdWillPay: preAuthorization._id,
            clientType: body.clientType,
            ceme: {},
            viesVAT: false,
            paymentType: PaymentType.AdHoc,
            billingPeriod: BillingPeriods.Adhoc,
            userIdToBilling: preAuthorization._id,
            tariffId: body.tariffId || '-1',
            clientName: body.client_name || 'EVIO',
          }
        )

      if (!data || !data.auth || data.auth === 'false') {
        return {
          success: false,
          message: 'Failed to start charging session',
          code: data?.code || 'start_session_error',
          data,
        }
      }

      await this.paymentsLibraryService.updatePreAuthorizationByPSPReference(
        body.pspReference,
        {
          hwId: body.chargerId,
          sessionIdInternal: data.sessionId,
          chargerType: body.chargerType,
        }
      )

      return {
        success: true,
        message: 'Charging session started successfully',
        data,
      }
    } catch (error: any) {
      console.error(error)
      if (error?.auth === false) {
        throw new BadRequestException({
          ...error,
        })
      } else if (error.response?.data) {
        throw new BadRequestException({
          ...error.response.data,
        })
      } else {
        throw new InternalServerErrorException({
          ...error,
        })
      }
    }
  }

  async stopSession(
    body: StopChargingSessionDto
  ): Promise<ControllerResult<ConnectionStationSessionResponseDto | null>> {
    const isPublicSession = isPublicCharger(body.chargerType)

    const serverToGetSession = isPublicSession
      ? this.ocpiLibraryService
      : this.chargerLibraryService

    const sessionData = await serverToGetSession.findSessionToStop(
      body.sessionId
    )

    if (!sessionData) {
      throw new InternalServerErrorException({
        success: false,
        message: 'Failed to retrieve session data',
        code: 'session_data_retrieval_failed',
      })
    }

    const idTag = isPublicSession
      ? sessionData?.cdr_token?.uid || null
      : sessionData?.idTag || null

    if (!idTag) {
      throw new InternalServerErrorException({
        success: false,
        message: 'Failed to retrieve ID tag',
        code: 'id_tag_retrieval_failed',
      })
    }

    const sessionId = sessionData?.id || body.sessionId

    try {
      const data =
        await this.connectionStationClient.handleSession<ConnectionStationSessionStopBodyDto>(
          {
            ...body,
            idTag: idTag,
            action: 'stop',
            evId: body?.evId || '-1',
            sessionId,
          }
        )

      if (!data || !data.auth || data.auth === 'false') {
        return {
          success: false,
          message: 'Failed to stop charging session',
          code: data?.code || 'stop_session_error',
          data,
        }
      }

      return {
        success: true,
        message: 'Charging session stopped successfully',
        data,
      }
    } catch (error: any) {
      console.error(error)
      if (error?.auth === false) {
        throw new BadRequestException({
          ...error,
        })
      } else if (error.response?.data) {
        throw new BadRequestException({
          ...error.response.data,
        })
      } else {
        throw new InternalServerErrorException({
          ...error,
        })
      }
    }
  }
}
