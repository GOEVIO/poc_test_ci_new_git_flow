import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query, Res, SetMetadata, UseGuards } from '@nestjs/common'

// libs
import paymentsLibary from 'evio-library-payments'

// Guards
import { FeatureFlagGuard } from 'src/common/guard/feature.flag.guard'
import { Roles } from 'src/common/guard/roles.decorator'
import { FeatureUserGuard } from 'src/common/guard/feature.user.guard'

// Common
import { ErrorHandler, SuccessHandler } from '../../common/response/responses.handler'

// Services
import { PaymentsService } from '../services/service.payments'
import { PreAuthorizationService } from '../services/service.preauthorization'
import { SessionsService } from '../services/service.sessions'

@UseGuards(FeatureFlagGuard)
@Controller()
export class PaymentsController {
  constructor(
    private readonly PaymentsService: PaymentsService,
    private readonly PreAuthorizationService: PreAuthorizationService,
    private readonly SessionsService: SessionsService
  ) {}

  /****************************************************************************************************************/
  /* Routes that other microservice use to make or update reservation */
  /****************************************************************************************************************/

  @Post('/user/:userid/reservation')
  @UseGuards(FeatureUserGuard)
  @Roles(['preauthorization'])
  @HttpCode(200)
  async makeAuthorisedPayment(@Res() res: any, @Body() requestParams: any) {
    const context = 'makeAuthorisedPayment'

    // compose response data
    let paymentInfo = {
      ...requestParams,
    }

    try {
      console.log('requestParams: ', requestParams, ` userId: ${requestParams.userId} ,`)
      // retrive config
      const config = (await paymentsLibary.retrievePaymentsConfigs())[0]
      // retrieve current reservation
      const reservation: any = await this.PreAuthorizationService.retrieveAllReservationBySessionId(requestParams.sessionIdInternal)
      console.log(`[${context}] userId: ${requestParams.userId} , reservation: ${JSON.stringify(reservation)}`)

      let result: any
      if (reservation.length === 0) {
        console.log(`[${context}] create a new reservation`)
        result = await this.PaymentsService.makePaymentAuthorised(requestParams, config.amountToReserve, 'USER_APP')
      }

      paymentInfo = { ...paymentInfo, ...result }
      console.log(`[${context}] Reservation of a amount was successful`)
      return res.send(
        new SuccessHandler().composeWithInfo(200, 'payment_reservation_amount_authorised', 'Reservation of a amount was successful', paymentInfo)
      )
    } catch (error) {
      console.log(`[${context}] error: ${JSON.stringify(error)}`)
      return res.status(500).send(error)
    }
  }

  @Post('/session/:sessionId')
  @Roles(['preauthorization'])
  @HttpCode(200)
  async makeAuthorisedPaymentOrRefunded(@Res() res: any, @Body() requestParams: any) {
    const context = 'makeAuthorisedPaymentOrRefunded'

    // compose response data
    let paymentInfo = {
      ...requestParams,
    }

     try {     
            const amountToProcess = requestParams.reservation.amount?.value - requestParams.amount;
            if(amountToProcess === 0){
               console.log(`[${context}] do nothing`);
               return res.send(new SuccessHandler().composeWithInfo(200, 'payment_reservation_amount_authorised', 'Reservation of a amount was successful', paymentInfo));
            }            
            else if(amountToProcess < 0){
               console.log(`[${context}] do payment de ${Number(Math.abs(amountToProcess).toFixed(2))}`);
               const requestPayment = {
                  "userId": requestParams.userId,
                  "reservedAmount": requestParams.reservation.amount.value,
                  "currency": requestParams.reservation.amount.currency,
                  "sessionId": requestParams.reservation.sessionId,
                  "hwId": requestParams.reservation.hwId,
                  "sessionIdInternal": requestParams.reservation.sessionIdInternal,
                  "capture": true,
                  "chargerType": requestParams.reservation.chargerType,
                  "clientName": requestParams.reservation.clientName,
                  reservation: requestParams.reservation,
                  paymentId: requestParams.paymentId ?? null,
                  transactionId: requestParams.transactionId ?? null
              }              
               const result = await this.PaymentsService.topUpPaymentAuthorised(requestPayment, Number(Math.abs(amountToProcess).toFixed(2)), 'USER_APP');
               paymentInfo = result;
            }else{
               console.log(`[${context}] do refund de ${amountToProcess}`);
               const result = await this.PaymentsService.refundPaymentAuthorized(requestParams, amountToProcess, 'USER_APP');
               paymentInfo = result
            }
            console.log(`[${context}] Reservation of a amount was successful`);
            return res.send(new SuccessHandler().composeWithInfo(200, 'payment_reservation_amount_authorised', 'Reservation of a amount was successful', paymentInfo));
     } catch (error) {
         console.log(`[${context}] error: ${JSON.stringify(error)}`);
         return res.status(500).send(error);    
     }
  }

  @Post('/user/:userid/refund')
  @Roles(['preauthorization'])
  @HttpCode(200)
  async refundAuthorisedPayment(@Res() res: any, @Body() requestParams: any) {
    const context = 'refundAuthorisedPayment'

    // compose response data
    let paymentInfo = {
      ...requestParams,
    }

    try {
      const result = await this.PaymentsService.refund(requestParams)
      paymentInfo = { ...paymentInfo, ...result }
      console.log(`[${context}] Result: ${JSON.stringify(paymentInfo)}`)
      return res.send(
        new SuccessHandler().composeWithInfo(200, 'refund_reservation_amount_authorised', 'Refund of a amount was successful', paymentInfo)
      )
    } catch (error) {
      console.log(`[${context}] error: ${JSON.stringify(error)}`)
      return res.status(500).send(error)
    }
  }

  @Post('/session/v1/releaseSuspendedSessions')
  @Roles(['preauthorization'])
  @HttpCode(200)
  async releaseSuspendedSessions(@Res() res: any, @Body() requestParams: any) {
    const context = 'suspendSession'
    try {
      let arrayChargingSession: Array<{ chargerType: string; sessionId: string }> = []
      if (requestParams) {
        const sessionIdentification: { chargerType: string; sessionId: string } = {
          ...requestParams,
        }
        if (!sessionIdentification.chargerType || !sessionIdentification.sessionId)
          return res.status(400).send(new ErrorHandler().compose({ status: 400, code: 'Missing required information', message: 'Missing required information' }))
        arrayChargingSession.push(sessionIdentification)
      } else {
        arrayChargingSession = await this.SessionsService.getSessionsUnpaidSessionsOver30Days()
      }
      
      if (arrayChargingSession.length === 0) {
        console.log(`[${context}] No sessions to process ...`)
        return res.send(new SuccessHandler().composeWithInfo(200, 'All sessions processed', 'All sessions processed', {}))
      }

      const response = await this.SessionsService.processUnpaidErrorSessions(arrayChargingSession)
      if (response)
        return res.send(new SuccessHandler().composeWithInfo(200, 'all_stuck_sessions_resolved', 'All sessions with problems were handle', {}))

      return res.status(500).send(new ErrorHandler().compose({ status: 500, code: 'Fail to process', message: 'Fail to process' }))
    } catch (error) {
      console.log(`[${context}] error: ${JSON.stringify(error.message)}`)
      return res.status(500).send(error)
    }
  }
}
