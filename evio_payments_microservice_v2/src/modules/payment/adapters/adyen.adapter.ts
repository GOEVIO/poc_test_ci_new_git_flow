import { Injectable, Logger } from '@nestjs/common'
import { IAptPreAuthoriseRequest } from '../interfaces/apt-pre-authorise-request.interface'
import { AptPreAuthorisationDto } from '../dto/apt-pre-authorisation.dto'
import { AdyenPreAuthoriseRequestBuilder } from '../builders/adyen-apt-pre-authorise-request.builder'
import { ConfigService } from '@nestjs/config'
import { AdjustPreAuthorisationDto } from '../dto/ajust-pre-authorisation.dto'
import { AdyenAptAdjustPreAuthoriseRequestBuilder } from '../builders/adyen-apt-adjust-pre-authorise-request.builder'
import { IAdjustPreAuthoriseRequest } from '../interfaces/adjust-pre-authorise-request.interface'
import { Client, Config, TerminalCloudAPI, PaymentAPI, CheckoutAPI } from '@adyen/api-library'
import { ICaptureRequest } from '../interfaces/capture-request.interface'
import { AdyenCaptureRequestBuilder } from '../builders/adyen-apt-capture-request.builder'
import { IAptIdentifyUserRequest } from '../interfaces/apt-identify-user-request.interface'
import { AdyenIdentifyRequestBuilder } from '../builders/adyen-apt-identify-user-request.builder'
import { CaptureDto } from '../dto/capture.dto'
import { AptIdentifyUserDto } from '../dto/apt-identify-user.dto'
import { CancelPreAuthorisationDto } from '../dto/cancel-pre-authorisation.dto'
import { AdyenCancelPreAuthoriseBuilder } from '../builders/adyen-apt-cancel-pre-authorise-request.builder'
import { ICancelAuthoriseRequest } from '../interfaces/cancel-authorise-request'

@Injectable()
export class AdyenAdapter {
  private readonly logger = new Logger(AdyenAdapter.name)
  private readonly terminalCloudAPI
  private readonly paymentAPI
  private readonly checkoutAPI
  private readonly adyenConfig
  private readonly aptConfig

  constructor(private readonly configService: ConfigService) {
    this.adyenConfig = this.configService.get('AdyenEVIO')
    this.aptConfig = this.configService.get('payment.apt')
    if (!this.adyenConfig) {
      this.logger.error('Adyen configuration is not set in the environment variables.')
      throw new Error('Adyen configuration is missing')
    }
    const config = new Config()
    config.apiKey = this.adyenConfig.AdyenAPIKEY
    config.environment = this.adyenConfig.Environment as Environment
    config.connectionTimeoutMillis = this.aptConfig.connectionTimeoutMillis

    const liveEndpointUrlPrefix = this.adyenConfig.Environment === 'LIVE' ? this.adyenConfig.AdyenLiveEndpointUrlPrefix : null

    const client = new Client({ config, liveEndpointUrlPrefix })
    this.terminalCloudAPI = new TerminalCloudAPI(client)
    this.paymentAPI = new PaymentAPI(client)
    this.checkoutAPI = new CheckoutAPI(client)
  }

  async preAuthoriseApt(body: AptPreAuthorisationDto): Promise<any> {
    const request: IAptPreAuthoriseRequest = new AdyenPreAuthoriseRequestBuilder(body).build()
    this.logger.log('Sending to Adyen Terminal API', JSON.stringify(request, null, 2))
    try {
      const response = await this.terminalCloudAPI.sync(request)
      this.logger.log('Response from Adyen Terminal API received:', JSON.stringify(response, null, 2))
      return response
    } catch (error) {
      this.logger.error('Error while communicating with Adyen Terminal API:', JSON.stringify(error, null, 2))
      throw error
    }
  }

  async updatePreAuthorisationApt(body: AdjustPreAuthorisationDto): Promise<any> {
    const request: IAdjustPreAuthoriseRequest = new AdyenAptAdjustPreAuthoriseRequestBuilder(body, this.configService).build()

    this.logger.log('Sending to Adyen Payment API', JSON.stringify(request, null, 2))

    try {
      const response = await this.paymentAPI.ModificationsApi.adjustAuthorisation(request)
      this.logger.log('Update response from Adyen Payment API received:', JSON.stringify(response, null, 2))
      return response
    } catch (error) {
      this.logger.error('Error while updating pre-authorization in Adyen Payment API:', JSON.stringify(error, null, 2))
      throw error
    }
  }

  async cancelPreAuthorisation(body: CancelPreAuthorisationDto): Promise<any> {
    const request: ICancelAuthoriseRequest = new AdyenCancelPreAuthoriseBuilder(body, this.configService).build()
    this.logger.log('Sending cancel request to Adyen Payment API', JSON.stringify(request, null, 2))
    try {
      const response = await this.paymentAPI.ModificationsApi.cancel(request)
      this.logger.log('Cancel response from Adyen Payment API received:', JSON.stringify(response, null, 2))
      return response
    } catch (error) {
      this.logger.error('Error while cancelling pre-authorization in Adyen Payment API:', JSON.stringify(error, null, 2))
      throw error
    }
  }

  async capture(body: CaptureDto): Promise<any> {
    const request: ICaptureRequest = new AdyenCaptureRequestBuilder(body, this.configService).build()
    try {
      const response = await this.paymentAPI.ModificationsApi.capture(request)
      this.logger.log('Capture response from Adyen Terminal API received:', JSON.stringify(response, null, 2))
      return response
    } catch (error) {
      this.logger.error('Error while capturing payment in Adyen Terminal API:', JSON.stringify(error, null, 2))
      throw error
    }
  }

  async identifyUserApt(body: AptIdentifyUserDto): Promise<any> {
    const identifyRequest: IAptIdentifyUserRequest = new AdyenIdentifyRequestBuilder(body).buildIdentifyRequest()
    const abortRequest: IAptIdentifyUserRequest = new AdyenIdentifyRequestBuilder(body).buildAbortRequest()
    try {
      const response = await this.terminalCloudAPI.sync(identifyRequest)
      await this.terminalCloudAPI.sync(abortRequest)
      this.logger.log('Identify response from Adyen Terminal API received:', JSON.stringify(response, null, 2))
      return response
    } catch (error) {
      this.logger.error('Error while identifying user in Adyen Terminal API:', JSON.stringify(error, null, 2))
      throw error
    }
  }
}
