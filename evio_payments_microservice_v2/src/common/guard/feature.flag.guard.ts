import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles } from './roles.decorator';
import { SuccessHandler } from '../response/responses.handler';
import toggle from 'evio-toggle'

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    let roleName: string = (this.reflector.get(Roles, context.getHandler()))[0];
    const request = context.switchToHttp().getRequest() // Fastify request
    const response = context.switchToHttp().getResponse() // Fastify response
    try {   

      // Check for a feature  
      const isEnabled = await toggle.isEnable(roleName);

      console.log(`[${roleName}] isEnabled: ${isEnabled}`);

      // Get the feature value
      const values = await toggle.getValue(roleName);
      request.params = { ...request.params, flagValues: values }

      // Check if the feature is enabled
      if (isEnabled) return values ?? true;  
      
      response.status(200).send(new SuccessHandler().composeWithInfo(200, (roleName === 'preauthorization' ? 'payment_reservation' : 'payments_feature') , (roleName === 'preauthorization' ? 'Reservation is not active.' : 'Feature is not active.')));
    } catch (error) {
      response.status(200).send(new SuccessHandler().composeWithInfo(200, (roleName === 'preauthorization' ? 'payment_reservation' : 'payments_feature'), (roleName === 'preauthorization' ? 'Reservation is not active.' : 'Feature is not active.')));
    }
  }
}