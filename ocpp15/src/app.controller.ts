import { Response } from 'express';
import { Controller, Post, Body, Res } from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('OCPP')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}
  @Post('soap')
  @ApiBody({ description: 'Envelope SOAP OCPP 1.5', type: String })
  async handleSoapMessage(@Body() soap: any, @Res() res: Response) {
    try {
      res.setHeader('Content-Type', 'application/soap+xml');
      return res.status(200).send(await this.appService.convertAndSend(soap));
    } catch (error) {
      console.error('Error processing SOAP message:', soap, error);
      return res.status(500).send({ error: 'Error processing SOAP message' });
    }
  }
}