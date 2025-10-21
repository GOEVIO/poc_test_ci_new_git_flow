import 'reflect-metadata';
import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { securityMiddleware } from './middlewares/security';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { exceptionsMap } from './helpers/exception-map';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: '*',
  })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (validationErrors: Array<ValidationError> = []) => {
        const errors = exceptionsMap(validationErrors)
        console.log('BadRequest exception:', errors)
        return new BadRequestException(errors)
      },
    }),
  )
  
  app.use(securityMiddleware);

  const configService = app.get(ConfigService)
  const config = new DocumentBuilder()
    .setTitle(configService.get('app.title') as string)
    .setDescription(configService.get('app.description') as string)
    .setVersion(configService.get('app.version') as string)
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
  
  app.use('/soap', bodyParser.text({ type: ['text/*', 'application/xml', 'text/xml', 'application/soap+xml'] }));

  await app.listen(configService.get('app.port') as number)
}
bootstrap();
