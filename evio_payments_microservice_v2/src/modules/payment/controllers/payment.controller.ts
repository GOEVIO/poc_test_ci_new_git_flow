import { BadRequestException, Body, Controller, Delete, Patch, Post, UseInterceptors } from '@nestjs/common'
import PaymentService from '../services/payment.service'
import { PaymentStrategyInterceptor } from '../interceptors/payment-strategy.interceptor'
import { DtoStrategyInterceptor } from '../interceptors/dto-strategy.interceptor'
import { UseCase } from '../decorators/use-case.decorator'
import { PaymentUseCase } from '../enums/payment-use-cases.enum'

@Controller()
@UseInterceptors(PaymentStrategyInterceptor, DtoStrategyInterceptor)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('preauthorisation')
  @UseCase(PaymentUseCase.PreAuthorise)
  async preAuthorise(@Body() body: any): Promise<any> {
    try {
      return await this.paymentService.preAuthorise(body)
    } catch (error) {
      throw new BadRequestException({
        success: false,
        server_status_code: 'preauthorisation_failed',
        error: error.message || 'An error occurred during preauthorisation',
      })
    }
  }

  @Patch('preauthorisation')
  @UseCase(PaymentUseCase.UpdatePreAuthorisation)
  async updatePreAuthorisation(@Body() body: any): Promise<any> {
    try {
      return await this.paymentService.updatePreAuthorisation(body)
    } catch (error) {
      throw new BadRequestException({
        success: false,
        server_status_code: 'update_preauthorisation_failed',
        error: error.message || 'An error occurred during preauthorisation update',
      })
    }
  }

  @Delete('preauthorisation')
  @UseCase(PaymentUseCase.CancelPreAuthorisation)
  async cancelPreAuthorisation(@Body() body: any): Promise<any> {
    try {
      return await this.paymentService.cancelPreAuthorisation(body)
    } catch (error) {
      throw new BadRequestException({
        success: false,
        server_status_code: 'cancel_preauthorisation_failed',
        error: error.message || 'An error occurred during preauthorisation cancellation',
      })
    }
  }

  @Post('capture')
  @UseCase(PaymentUseCase.Capture)
  async capture(@Body() body: any): Promise<any> {
    try {
      return await this.paymentService.capture(body)
    } catch (error) {
      throw new BadRequestException({
        success: false,
        server_status_code: 'capture_failed',
        error: error.message || 'An error occurred during capture',
      })
    }
  }

  @Post('identify')
  @UseCase(PaymentUseCase.Identify)
  async identify(@Body() body: any): Promise<any> {
    try {
      return await this.paymentService.identify(body)
    } catch (error) {
      throw new BadRequestException({
        success: false,
        server_status_code: 'identify_user_failed',
        error: error.message || 'An error occurred during user identification',
      })
    }
  }
}
