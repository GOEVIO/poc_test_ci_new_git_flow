import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { ConfigService } from '@nestjs/config'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import * as bodyParser from 'body-parser'
import { json } from 'express'
import { useContainer, ValidationError } from 'class-validator'
import { AppModule } from './app.module'
import { exceptionsMap } from './helpers/exception-map'
import { validateEnvs } from './validation/env.schema'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  validateEnvs()

  app.use(json({ limit: '128mb' }))
  app.use(bodyParser.json({ limit: '10mb' }))
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }))
  useContainer(app.select(AppModule), { fallbackOnErrors: true })

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

  const configService = app.get(ConfigService)
  const options = new DocumentBuilder()
    .setTitle(configService.get('app.title') as string)
    .setDescription(configService.get('app.description') as string)
    .setVersion(configService.get('app.version') as string)
    .addBearerAuth()
    .build()

  const document = SwaggerModule.createDocument(app, options)
  SwaggerModule.setup('api', app, document)

  await app.listen(configService.get('app.port') as number)
}

void bootstrap()
