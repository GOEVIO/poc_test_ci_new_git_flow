import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { PaymentController } from './controllers/payment.controller'
import { AdyenAdapter } from './adapters/adyen.adapter'
import PaymentContext from './classes/payment-context.class'
import AptStrategy from './classes/apt-strategy.class'
import AdyenAptService from './services/adyen-apt.service'
import { PreAuthorizationRepository } from 'src/paymentsAdyen/repositories/preauthorization.repository'
import PaymentService from './services/payment.service'
import { PaymentsRepository } from 'src/paymentsAdyen/repositories/payment.repository'
import { TransactionsRepository } from 'src/paymentsAdyen/repositories/transations.repository '
import { DtoRegistry } from './registry/dto.registry'
import { DtoFactory } from './factories/dto.factory'

@Module({
  imports: [ConfigModule],
  controllers: [PaymentController],
  providers: [
    AdyenAdapter,
    PaymentContext,
    AptStrategy,
    AdyenAptService,
    PreAuthorizationRepository,
    PaymentsRepository,
    TransactionsRepository,
    PaymentService,
    {
      provide: DtoRegistry,
      useFactory: DtoFactory.create,
    },
  ],
})
export class PaymentModule {}
