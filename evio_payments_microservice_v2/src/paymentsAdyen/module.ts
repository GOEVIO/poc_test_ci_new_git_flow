import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ConfigService } from '@nestjs/config'

// Controllers
import { PreAuthorizationController } from './controllers/preauthorization.controller'
import { PaymentsController } from './controllers/payments.controller'

// Services
import { PreAuthorizationService } from './services/service.preauthorization'
import { PaymentsService } from './services/service.payments'
import { PaymentsMethodService } from './services/service.payment.method'
import { SessionsService } from './services/service.sessions'

// Repositories
import { PreAuthorizationRepository } from './repositories/preauthorization.repository'
import { PaymentsRepository } from './repositories/payment.repository'
import { TransactionsRepository } from './repositories/transations.repository '

@Module({
  imports: [ConfigModule],
  controllers: [PreAuthorizationController, PaymentsController],
  providers: [
    PreAuthorizationService,
    PaymentsService,
    PaymentsMethodService,
    SessionsService,
    PreAuthorizationRepository,
    PaymentsRepository,
    TransactionsRepository,
    ConfigService,
  ],
})
export class PaymentAdyenModule {}
