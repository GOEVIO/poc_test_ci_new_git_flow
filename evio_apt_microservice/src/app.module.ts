import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import config from './core/config'
import { LoggerMiddleware } from './common/middleware/sentry.middleware'
import { AptModule } from './apt/apt.module'
import { MainController } from './main.controller'
import { ChargersModule } from './chargers/chargers.module'
import { DataBaseModule } from './database/database.module'
import { LibrariesModule } from './libraries/libraries.module'
import { ChargingSessionModule } from './charging-session/charging-session.module'
import { PaymentsModule } from './payments/payments.module'
import { TariffsModule } from './tariffs/tariffs.module'
import { BillingModule } from './billing/billing.module'
import { NotificationModule } from './notifications/notification.module'
import { MessageHandlersModule } from './events/messageHandlers/messageHandlers.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [config],
    }),
    AptModule,
    LibrariesModule,
    ChargersModule,
    DataBaseModule,
    ChargingSessionModule,
    PaymentsModule,
    TariffsModule,
    BillingModule,
    NotificationModule,
    MessageHandlersModule,
  ],
  controllers: [MainController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes({ path: '', method: RequestMethod.ALL })
  }
}
