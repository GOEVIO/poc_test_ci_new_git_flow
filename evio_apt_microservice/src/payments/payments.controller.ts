import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { AptCancelPreAuthorizationBody } from './dtos/apt-pre-authorization.dto'
import { ControllerResult } from '../common/result-wrappers'
import { TimeoutInterceptor } from '../core/interceptors/timeout.interceptor'
import {
  GetSessionClientResponseFoundDto,
  GetSessionClientResponseNotFoundDto,
} from '../clients/get-sessions/get-sessions.dto'
import { CancelPreAuthorizationResponse } from '../clients/dtos/pre-authorization.dto'
import { GetAptGuard } from '../common/guard/get-apt.guard'
import { Apt } from '../database/entities/apt.entity'
import PaymentService from './services/payment.service'
import { PaymentStrategyInterceptor } from './interceptors/payment-strategy.interceptor'
import { DtoStrategyInterceptor } from './interceptors/dto-strategy.interceptor'
import { UseCase } from './decorators/use-case.decorator'
import { QrCodePreAuthoriseInterceptor } from './interceptors/qr-code-pre-authorise.interceptor'
import { AptPreAuthorizeInterceptor } from './interceptors/apt-pre-authorise.interceptor'

@Controller('')
@UseInterceptors(PaymentStrategyInterceptor, DtoStrategyInterceptor)
@ApiTags('Payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentService) {}
  @ApiOperation({ summary: 'Preauthorize a payment' })
  @ApiResponse({
    status: 200,
    description: 'Payment pre authorized successfully',
  })
  @Post('payments/preauthorization')
  @UseGuards(GetAptGuard)
  @UseInterceptors(
    new TimeoutInterceptor(150_000),
    QrCodePreAuthoriseInterceptor,
    AptPreAuthorizeInterceptor
  )
  @UseCase('preAuthorise')
  async preAuthorize(@Body() body: any): Promise<ControllerResult<any>> {
    const data = await this.paymentsService.makePreAuthorize(body)
    return {
      success: true,
      message: `Payment pre authorized successfully`,
      data,
    }
  }

  @ApiOperation({ summary: 'Identify a payment, get current session by card' })
  @ApiResponse({
    status: 200,
    description: 'Identify by card successfully',
    type: GetSessionClientResponseFoundDto,
  })
  @UseInterceptors(new TimeoutInterceptor(150_000))
  @UseGuards(GetAptGuard)
  @Get(':serial_number/payments/identify')
  async identify(
    @Param('serial_number') serial_number: string,
    @Req() request: Request
  ): Promise<
    ControllerResult<
      GetSessionClientResponseNotFoundDto | GetSessionClientResponseFoundDto
    >
  > {
    const apt = (request as Request & { apt?: Apt }).apt
    const formattedSessions = await this.paymentsService.identifyCard(
      serial_number,
      apt as Apt
    )

    return {
      success: true,
      message: `Identify by card successfully`,
      data: formattedSessions,
    }
  }

  @ApiOperation({ summary: 'Cancel a pre-authorization' })
  @ApiResponse({
    status: 200,
    description: 'Pre-authorization canceled successfully',
    type: CancelPreAuthorizationResponse,
    example: {
      success: true,
      message: 'Pre-authorization canceled successfully',
      data: {
        pspReference: 'R3GWM322JLF4QM65',
        status: '[cancel-received]',
      },
    },
  })
  @UseCase('cancelPreAuthorization')
  @Delete('payments/preauthorization')
  async cancelPreAuthorization(
    @Body() body: AptCancelPreAuthorizationBody
  ): Promise<ControllerResult<CancelPreAuthorizationResponse>> {
    const cancelPreAuthorization =
      await this.paymentsService.cancelPreAuthorization(body)

    return {
      success: true,
      message: `Pre-authorization canceled successfully`,
      data: cancelPreAuthorization,
    }
  }
}
