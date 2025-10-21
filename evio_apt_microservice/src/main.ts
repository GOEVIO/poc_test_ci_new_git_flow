import * as dotenv from 'dotenv'
dotenv.config()

import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify'
import { LoggingInterceptor } from '../src/core/interceptors/logging.interceptor'
import { ErrorFilter } from '../src/core/filters/http-exception.filter'
import { ConfigModuleType } from './core/config'
import * as Sentry from '@sentry/node'
import { AppModule } from './app.module'
import { ConfigService } from '@nestjs/config'
import LoggerService from './core/services/logger'
import { configSwagger } from './swagger/config'
import { startConsumer } from './events/consumer'

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ maxParamLength: 200 })
  )

  configSwagger(app)

  const config = app.get(ConfigService).get<ConfigModuleType['root']>('root')

  Sentry.init({
    dsn: config?.providers.sentry.dsn,
    release: `evio_apt_microservice@0.0.4`,
    integrations: [Sentry.captureConsoleIntegration],
    tracesSampleRate: config?.providers.sentry.traceSampleRate,
    profilesSampleRate: config?.providers.sentry.profilesSampleRate,
  })

  app.useGlobalInterceptors(new LoggingInterceptor(new LoggerService()))
  app.useGlobalFilters(new ErrorFilter(new LoggerService()))
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    })
  )
  app.setGlobalPrefix('api/private/apt/')

  await app.listen(config?.APP_PORT ?? '6001', '0.0.0.0')
  console.log(`Application is running on: ${await app.getUrl()}`)

  await startConsumer(app)
}
bootstrap()
