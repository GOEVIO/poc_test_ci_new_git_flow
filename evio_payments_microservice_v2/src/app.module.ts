import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import config from './core/config'
import { LoggerMiddleware } from './common/middleware/sentry.middleware'
import { PaymentAdyenModule } from './paymentsAdyen/module'
import { SentryModule } from '@sentry/nestjs/setup'
import { SentryGlobalFilter } from '@sentry/nestjs/setup'
import { APP_FILTER } from '@nestjs/core'
import { PaymentModule } from './modules/payment/payment.module'
import { WinstonModule } from 'nest-winston'
import { CronjobsModule } from './modules/cronjobs/cronjobs.module'
import winston from 'winston'
@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
  ],
  imports: [
    WinstonModule.forRoot({
      transports: [new winston.transports.Console()],
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [config],
    }),
    PaymentAdyenModule,
    PaymentModule,
    SentryModule.forRoot(),
    CronjobsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes({ path: '/*', method: RequestMethod.ALL })
  }
}
