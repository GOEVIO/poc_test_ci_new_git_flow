import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common'
import {
  defaultTin,
  emails,
  PreAuthorizationStatusReason,
  TinType,
} from 'evio-library-commons'
import {
  PreAuthorizationBillingAction,
  PreAuthorizationBillingStatus,
} from './enums/payments-library.enum'
import { PaymentsLibraryRepository } from './payments-library.repository'

@Injectable()
export class PaymentsLibraryService {
  constructor(
    private readonly paymentsLibraryRepository: PaymentsLibraryRepository
  ) {}
  async getPreAuthorizationByPSPReference(pspReference: string): Promise<any> {
    try {
      const preAuthorizationData =
        await this.paymentsLibraryRepository.findPreAuthorizationByPSPReference(
          pspReference
        )

      return preAuthorizationData
    } catch (error) {
      throw new InternalServerErrorException({
        message:
          error instanceof Error ? error.message : 'Invalid PSP Reference',
        code: 'invalid_psp_reference',
      })
    }
  }

  async updatePreAuthorizationById(
    preAuthorizationId: string,
    updateData: any
  ): Promise<any> {
    try {
      const preAuthorization =
        await this.paymentsLibraryRepository.findPreAuthorizationById(
          preAuthorizationId
        )

      if (!preAuthorization) {
        throw new NotFoundException({
          message: 'Not found',
          code: 'pre_authorization_not_found',
        })
      }

      if (preAuthorization.billingInfo) {
        throw new ConflictException({
          message: 'Billing information already exists',
          code: 'billing_info_already_exists',
        })
      }

      return this.paymentsLibraryRepository.updatePreAuthorizationById(
        preAuthorizationId,
        updateData
      )
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error
      } else {
        throw new InternalServerErrorException({
          message: error instanceof Error ? error.message : 'Update failed',
          code: 'update_failed',
        })
      }
    }
  }

  async performPreAuthorizationBillingAction(
    preAuthorizationId: string,
    action: PreAuthorizationBillingAction
  ): Promise<void> {
    try {
      const preAuthorization =
        await this.paymentsLibraryRepository.findPreAuthorizationById(
          preAuthorizationId
        )

      if (!preAuthorization) {
        throw new NotFoundException({
          message: 'Not found',
          code: 'pre_authorization_not_found',
        })
      }

      if (preAuthorization.billingInfo) {
        throw new ConflictException({
          message: 'Billing information already exists',
          code: 'billing_info_already_exists',
        })
      }

      const actions: Record<PreAuthorizationBillingAction, any> = {
        [PreAuthorizationBillingAction.CANCEL]: {
          status_reason: PreAuthorizationStatusReason.USER_CANCELLED,
          active: false,
        },
        [PreAuthorizationBillingAction.SKIP]: {
          billingInfo: {
            name: 'Final Consumer',
            email: emails.SupportEvio,
            tin: defaultTin,
            viesVat: false,
            clientType: TinType.PRIVATE,
          },
        },
      }

      const data = actions[action]
      if (!data) {
        throw new InternalServerErrorException({
          message: 'Invalid action',
          code: 'invalid_action',
        })
      }

      return this.paymentsLibraryRepository.updatePreAuthorizationById(
        preAuthorizationId,
        data
      )
    } catch (error) {
      throw new InternalServerErrorException({
        message: error instanceof Error ? error.message : 'Action failed',
        code: 'action_failed',
      })
    }
  }

  async getPreAuthorizationBillingStatusById(
    id: string
  ): Promise<PreAuthorizationBillingStatus> {
    try {
      const preAuthorization =
        await this.paymentsLibraryRepository.findPreAuthorizationById(id)

      if (!preAuthorization) {
        throw new NotFoundException({
          message: 'Pre-authorization not found',
          code: 'pre_authorization_not_found',
        })
      }

      const statusReason: Record<string, PreAuthorizationBillingStatus> = {
        [PreAuthorizationStatusReason.USER_CANCELLED]:
          PreAuthorizationBillingStatus.CANCELLED,
      }

      if (!preAuthorization.active) {
        return (
          statusReason[preAuthorization.status_reason] ||
          PreAuthorizationBillingStatus.CANCELLED
        )
      }

      return preAuthorization.billingInfo
        ? PreAuthorizationBillingStatus.COMPLETED
        : PreAuthorizationBillingStatus.PENDING
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error
      } else {
        throw new InternalServerErrorException({
          message:
            error instanceof Error
              ? error.message
              : 'Failed to retrieve billing status',
          code: 'get_billing_status_failed',
        })
      }
    }
  }

  async getActivePreAuthorizationSessionIdByCardHash(
    cardHash: string
  ): Promise<{ listOfIds: string[]; hwIds: string[] }> {
    try {
      const preAuthorizationData =
        await this.paymentsLibraryRepository.retrievePreAuthorizationByQuery(
          {
            active: true,
            userCardHash: cardHash,
            expireDate: { $gt: new Date() },
            sessionIdInternal: { $ne: null, $exists: true },
          },
          { sessionIdInternal: 1, chargerType: 1, hwId: 1 }
        )

      return {
        listOfIds: preAuthorizationData
          .filter((s: any) => s?.sessionIdInternal)
          .map((s: any) => s.sessionIdInternal),
        hwIds:
          preAuthorizationData
            .filter((s: any) => s?.hwId)
            .map((s: any) => s.hwId) || [],
      }
    } catch (error) {
      throw new InternalServerErrorException({
        message: error instanceof Error ? error.message : 'Invalid Card Hash',
        code: 'invalid_card_hash',
      })
    }
  }

  async updatePreAuthorizationByPSPReference(
    pspReference: string,
    setData: any
  ): Promise<any> {
    try {
      const result =
        await this.paymentsLibraryRepository.updatePreAuthorizationByPSPReference(
          { adyenReference: pspReference },
          setData
        )
      return result
    } catch (error) {
      throw new InternalServerErrorException({
        message:
          error instanceof Error ? error.message : 'Invalid PSP Reference',
        code: 'invalid_psp_reference',
      })
    }
  }

  async getUserIdFromPreAuthorization(pspReference: string): Promise<string> {
    try {
      const preAuthorization =
        await this.paymentsLibraryRepository.findPreAuthorizationByPSPReference(
          pspReference,
          { userId: 1 }
        )
      if (!preAuthorization) {
        throw new NotFoundException({
          message: 'Not found pre-authorization',
          code: 'pre_authorization_not_found',
        })
      }

      return preAuthorization?.userId || ''
    } catch (error) {
      throw new InternalServerErrorException({
        message:
          error instanceof Error ? error.message : 'Failed to retrieve user ID',
        code: 'get_user_id_failed',
      })
    }
  }
}
