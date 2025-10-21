import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { ConfigModuleType } from './core/config'
import * as Sentry from '@sentry/node'
import { AppModule } from './app.module'
import { ConfigService } from '@nestjs/config'
import appData from '../package.json'
import LoggerService from './core/services/logger'
import { LoggingInterceptor } from '../src/core/interceptors/logging.interceptor'
import { LoggerFactory } from './common/factories/logger.factory'

const customOutput =
  (err = false) =>
  (...args) => {
    const formattedArgs = args.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : arg)).join(' ')
    if (err) {
      process.stderr.write(`${formattedArgs}\n`)
      return
    }
    process.stdout.write(`${formattedArgs}\n`)
  }
console.log = customOutput()
console.info = customOutput()
console.warn = customOutput()
console.error = customOutput(true)

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ maxParamLength: 200 }), {
    logger: LoggerFactory('PaymentsV2'),
  })

  const config = app.get(ConfigService).get<ConfigModuleType['root']>('root')

  Sentry.init({
    dsn: config?.providers.sentry.dsn,
    release: `${appData.name}@${appData.version}`,
    environment: config?.environment,
    //integrations: [new Sentry.Integrations.Http({ tracing: true })],
    tracesSampleRate: config?.providers.sentry.traceSampleRate,
    profilesSampleRate: config?.providers.sentry.profilesSampleRate,
  })

  app.useGlobalInterceptors(new LoggingInterceptor(new LoggerService()))
  app.useGlobalPipes(new ValidationPipe())
  app.setGlobalPrefix('api/private/payments/v2/')

  await app.listen(config.APP_PORT ?? 6002, '0.0.0.0')
  console.log(`Application is running on: ${await app.getUrl()}`)
}
bootstrap()
