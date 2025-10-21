
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { FeatureFlagGuard } from 'src/common/guard/feature.flag.guard';
import { ErrorHandler, SuccessHandler } from '../../common/response/responses.handler';
import { PreAuthorizationService } from '../services/service.preauthorization';
import { Roles } from 'src/common/guard/roles.decorator';
import { FeatureUserGuard } from 'src/common/guard/feature.user.guard';
import configsLibrary from "evio-library-configs";
import { PaymentsService } from '../services/service.payments';
import { ErrorHandlerCommon } from 'src/common/error.handler.common';

@UseGuards(FeatureFlagGuard)
@Controller('preauthorization')
export class PreAuthorizationController {
  constructor(private readonly PreAuthorizationService: PreAuthorizationService, private readonly PaymentsService: PaymentsService) {}

   /****************************************************************************************************************/
  /* Routes that are used for retrieve preauthorizations information */
  /****************************************************************************************************************/
  @Get('')
  @Roles(['preauthorization'])
  @HttpCode(200)
  async retrieveAllPreAuthorization(@Res() res) {
     try {
        const result = await this.PreAuthorizationService.retrieveAllPreAuthorization();
        return res.send(new SuccessHandler().composeWithInfo(200, 'payment_PreAuthorization', 'PreAuthorizations was retrieved successful', result));
     } catch (error) {
         if(error.status === 200) {
            return res.send(new SuccessHandler().composeWithInfo(200, 'payment_PreAuthorization', 'PreAuthorizations was retrieved successful', []));
         }
        console.error(error);
        const errorResponse = new ErrorHandler().compose(error);
        return res.status(error.status ?? error.statusCode).send(errorResponse);
     }
  }

  @Get('/user/:userid')
  @UseGuards(FeatureUserGuard)
  @Roles(['preauthorization'])
  @HttpCode(200)
  async retrievePreAuthorizationByUser(@Res() res, @Param('userid') userid: string) {
     try {
        const result = await this.PreAuthorizationService.retrievePreAuthorizationByUser(userid);
        return res.send(new SuccessHandler().composeWithInfo(200, 'payment_PreAuthorization', 'PreAuthorization was retrieved successful', result));
     } catch (error) {
        console.error(error);
        const errorResponse = new ErrorHandler().compose(error);
        return res.status(error.status ?? error.statusCode).send(errorResponse);
     }
  }

  @Get('/session/:sessionId')
  @Roles(['preauthorization'])
  @HttpCode(200)
  async retrievePreAuthorizationBySessionId(@Res() res, @Param('sessionId') sessionId: string) {
     try {
        const result = await this.PreAuthorizationService.retrieveReservationBySessionId(sessionId);
        if(!result) throw ErrorHandlerCommon.notfound('server_preauthorization_required', 'No preauthorization found', 'Not found');
        return res.send(new SuccessHandler().composeWithInfo(200, 'payment_PreAuthorization', 'PreAuthorization was retrieved successful', result));
     } catch (error) {
        console.error(error);
        const errorResponse = new ErrorHandler().compose(error);
        return res.status(error.status ?? error.statusCode).send(errorResponse);
     }
  }

  /****************************************************************************************************************/
  /* Routes that other microservice use to make or update reservation */
  /****************************************************************************************************************/

  @Post('/user/:userid')
  @UseGuards(FeatureUserGuard)
  @Roles(['preauthorization'])
  @HttpCode(200)
  async makeOrAdjustReservationPaymentAdyen(@Res() res, @Body() requestParams: any) {
      const context = 'makeOrAdjustReservationPaymentAdyen';

      // compose response data
      let paymentInfo = {
         ...requestParams
      }

     try {
         console.log('requestParams: ',requestParams)
            // retrive config
            const config = await configsLibrary.retrieveCongigsPreAuthorization();

            //TEMPORARY CODE THAT IS REMOVED ---- tag @sBaptistaEvio
            //######################################################################################################################################
            if(requestParams.userId === '67587b0c48d4f000133612b2') {
               requestParams.reservedAmount = 1;
            } 
            //######################################################################################################################################

           
            // retrieve current reservation
            const reservation: any = await this.PreAuthorizationService.retrieveReservationBySessionId(requestParams.sessionIdInternal);
            console.log(`[${context}] reservation: ${JSON.stringify(reservation)}`);

            // calculate reserved amount
            const reservedAmount = this.PreAuthorizationService.formulaToCalculateAmountToPreAuth(requestParams.totalCostInclVat, requestParams.reservedAmount, reservation?.amount?.value ?? 0, config.timeElapsed, config.maxAmountToReserve);
            console.log(`[${context}] reservedAmount: ${reservedAmount}`);

            let result: any;
            if(!reservation) {
               console.log(`[${context}] create a new preauthorization`);
               result = await this.PreAuthorizationService.createPreAuthorization(requestParams, reservedAmount, 'USER_APP');
            }else{
               console.log(`[${context}] update preauthorization, ${JSON.stringify(reservation)}`);
               console.log(`[${context}] reservedAmount > reservation?.amount?.value = ${reservedAmount > reservation?.amount?.value}`)
               console.log(`[${context}] config.maxAmountToReserve !== reservation?.amount?.value = ${config.maxAmountToReserve !== reservation?.amount?.value}`)
               console.log(`[${context}] isPossibleToUpdate: ${reservedAmount > reservation?.amount?.value && config.maxAmountToReserve !== reservation?.amount?.value}`);
               if(reservedAmount > reservation?.amount?.value && config.maxAmountToReserve !== reservation?.amount?.value) {
                  result = await this.PreAuthorizationService.updatePreAuthorization(reservation, requestParams, reservedAmount, 'USER_APP');
               }
            }          

            // compose response data
            paymentInfo.adyenReferenceOriginal = reservation?.adyenReference ?? result?.pspReference ?? null;
            paymentInfo.adyenReferenceLastPreAuthorization = reservation?.adyenPspReferenceUpdated[reservation?.adyenPspReferenceUpdated.length-1] ?? null
            paymentInfo.adyenTransactionId = reservation?.transactionId ?? result?.transactionId ?? null;
            
            console.log(`[${context}] Pre Authorization was successful. Result: ${JSON.stringify(paymentInfo)}`);
            return res.send(new SuccessHandler().composeWithInfo(200, 'payment_PreAuthorization', 'PreAuthorization was successful', paymentInfo));
     } catch (error) {
         console.log(`[${context}] error: ${JSON.stringify(error)}`);
         if (error?.code === 'server_paymentMethod_refused') {
            return res.status(400).send(error);
         }else{
            return res.status(200).send(paymentInfo);
         }        
     }
  }


  /****************************************************************************************************************/
  /* Routes that other microservice use to pay reservation */
  /****************************************************************************************************************/

  @Post('/payment/session/:sessionId')
  //@UseGuards(FeatureUserGuard)
  @Roles(['preauthorization'])
  @HttpCode(200)
  async makePaymentPreAuthorization(@Res() res, @Body() requestParams: any,  @Param('sessionId') sessionId: string) {
   const context = "[Route makePaymentPreAuthorization]";
     try {
        // make payment preauthorization
        const result = await this.PreAuthorizationService.makePaymentPreAuthorization(sessionId, requestParams);
        console.log(`${context}, result: ${JSON.stringify(result)}`);
        // compose response data
        return res.send(new SuccessHandler().composeWithInfo(200, 'payment_PreAuthorization_payment', 'PreAuthorization was payded with successful', result));
     } catch (error) {
         console.log(`${context}, error: ${JSON.stringify(error)}`);
         const errorResponse = new ErrorHandler().compose(error);
         return res.status(error.status ?? error.statusCode).send(errorResponse);
     }
  } 



/****************************************************************************************************************/
/* Route to release reservation */
/****************************************************************************************************************/
  @Post('/release')
  @Roles(['preauthorization'])
  @HttpCode(200)
  async cancelReservationPaymentAdyen(@Res() res: any, @Query('sessionId') sessionId: string, @Query('userId') userId: string, @Body() body: any) {
     const context = "[Route cancelReservationPaymentAdyen]";
     try {
         console.log(`${context} sessionId: ${sessionId}, userId: ${userId}, body: ${JSON.stringify(body)}`);
         if(sessionId) await this.PreAuthorizationService.cancelPreAuthorizationBySession(sessionId);
         else if(userId) await this.PreAuthorizationService.cancelPreAuthorizationByUserID(userId);
         else await this.PreAuthorizationService.cancelListReservationPaymentAdyen(body);

         return res.send(new SuccessHandler().composeWithInfo(200, 'payment_PreAuthorization_cancel', 'PreAuthorization cancel was successful', null));
     } catch (error) {
         console.error(`${context} error: ${JSON.stringify(error)}`);
         const errorResponse = new ErrorHandler().compose(error);
         return res.status(error.status ?? error.statusCode).send(errorResponse);
     }
  } 


  @Post('/update/status/session/:sessionId')
  @Roles(['preauthorization'])
  @HttpCode(200)
  async updateReservationInternalToCompletedFAILD(@Res() res: any, @Param() parans: any, @Body() body: any ) {
      const context = "[Route updateReservationInternalToCompletedFAILD]";
      try {
         console.log(`${context} sessionId: ${JSON.stringify(parans.sessionId)}, body: ${body}`);
         await this.PreAuthorizationService.updateInternalPreAuthorizationToCompleted(parans.sessionId, body);
         return res.send(new SuccessHandler().composeWithInfo(200, 'payment_PreAuthorization_cancel', 'PreAuthorization update to completed and FAILD was successful', null));
      } catch (error) {
         console.error(`${context} error: ${JSON.stringify(error)}`);
         const errorResponse = new ErrorHandler().compose(error);
         return res.status(error.status ?? error.statusCode).send(errorResponse);
      }
  } 

}