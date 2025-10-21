import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common'
import axios, { AxiosResponse } from 'axios'
import { ConfigService } from '@nestjs/config'
import {
  IPreAuthorizationPaymentResponse,
  CancelPreAuthorization,
  CancelPreAuthorizationResponse,
} from './dtos/pre-authorization.dto'
import { normalizeURL } from '../core/helpers'
import { DeviceTypes } from 'evio-library-commons'

@Injectable()
export class PaymentsV2Client {
  private baseURL: string
  constructor(private readonly configService: ConfigService) {
    const baseURL = this.configService.get('client.paymentsV2.host')
    if (!baseURL) {
      throw new InternalServerErrorException(
        'PAYMENTS_SERVICE_HOST environment variable is not set'
      )
    }
    this.baseURL = baseURL
  }

  async preAuthorize(
    body: any,
    strategy: DeviceTypes = DeviceTypes.APT
  ): Promise<any> {
    try {
      const path = this.configService.get(
        'client.paymentsV2.preAuthorizationUrl'
      )
      if (!path) {
        throw new InternalServerErrorException({
          message: 'Pre authorization URL environment is not set in configs',
          code: 'pre_authorization_environment_not_set',
        })
      }
      const { data }: AxiosResponse<IPreAuthorizationPaymentResponse> =
        await axios.post(normalizeURL(this.baseURL, path), body, {
          headers: { strategy: strategy.toLocaleLowerCase() },
        })

      return data
    } catch (error: any) {
      if (error?.response?.data && error.response.status !== 500) {
        throw new BadRequestException({
          message: error.response.data.error,
          code:
            error.response.data?.server_status_code ||
            'payment_pre_authorization_error',
        })
      }
      throw new InternalServerErrorException({
        message: error.message,
        code: 'payment_pre_authorization_error',
      })
    }
  }

  async identify(serial: string): Promise<{ userCardHash: string }> {
    try {
      const path = this.configService.get('client.paymentsV2.identify')
      if (!path) {
        throw new InternalServerErrorException({
          message: 'identify URL environment is not set in configs',
          code: 'identify_environment_not_set',
        })
      }
      const { data }: AxiosResponse<{ userCardHash: string }> =
        await axios.post(
          normalizeURL(this.baseURL, path),
          { serial },
          {
            headers: { strategy: DeviceTypes.APT.toLocaleLowerCase() },
          }
        )
      return { userCardHash: data.userCardHash }
    } catch (error: any) {
      if (error?.response?.data && error.response.status !== 500) {
        throw new BadRequestException({
          message: error.response.data.error,
          code:
            error.response.data?.server_status_code ||
            'payments_identify_error',
        })
      }
      throw new InternalServerErrorException({
        message: error.message,
        code: 'payments_identify_error',
      })
    }
  }

  async cancelPreAuthorization(
    body: CancelPreAuthorization
  ): Promise<CancelPreAuthorizationResponse> {
    try {
      const path = this.configService.get(
        'client.paymentsV2.cancelPreAuthorization'
      )
      if (!path) {
        throw new InternalServerErrorException({
          message:
            'cancelPreAuthorization environment variable is not set in configs',
          code: 'cancel_pre_authorization_environment_not_set',
        })
      }
      const { data }: AxiosResponse<CancelPreAuthorizationResponse> =
        await axios.delete(normalizeURL(this.baseURL, path), {
          data: body,
          headers: { strategy: DeviceTypes.APT.toLocaleLowerCase() },
        })
      return data
    } catch (error: any) {
      if (error?.response?.data && error.response.status !== 500) {
        throw new BadRequestException({
          message: error.response.data.error,
          code:
            error.response.data?.server_status_code ||
            'cancel_pre_authorization_error',
        })
      }
      throw new InternalServerErrorException({
        message: error.message,
        code: 'cancel_pre_authorization_error',
      })
    }
  }
}
