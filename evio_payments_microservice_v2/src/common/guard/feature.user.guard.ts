import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SuccessHandler } from '../response/responses.handler';

@Injectable()
export class FeatureUserGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest() // Fastify request
    const response = context.switchToHttp().getResponse() // Fastify response
    try {   
      const config = JSON.parse(request.params.flagValues);
      console.log('!config.USERS_PROD: ', !config.USERS_PROD)
      // Check if the user need to make reservation
      const userAccept = config & config.USERS_PROD ? config.USERS_PROD.split(',') : undefined;
      const clientNameAccept = config ? config.clientName.split(',') : undefined;

      console.log('userAccept: ',userAccept, ' request.params.userid: ', request.params.userid, ' clientNameAccept: ', clientNameAccept)
      const rule = userAccept && !userAccept.includes(request.params.userid) ? true : false;
      console.log('role: ', rule)
      if(rule) {
         console.log('This user don\'t need to make reservation.', request.params.userid);
         throw 'This user don\'t need to make reservation.';
      }

      const rule2 = clientNameAccept && !clientNameAccept.includes(request.body.clientName) ? true : false;
      console.log('role2: ', rule2)
      if(rule2) {
         console.log('This user don\'t need to make reservation.', request.params.userid);
         throw 'This user don\'t need to make reservation.';
      }

      // Check if the feature is enabled
      return true;
    } catch (error) {
      response.status(200).send(new SuccessHandler().composeWithInfo(200, 'payment_PreAuthorization', 'This user don\'t need to make reservation.'));
    }
  }
}