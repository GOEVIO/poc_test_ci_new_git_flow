import { Module } from '@nestjs/common'
import { AptModule } from '../apt/apt.module'
import { ClientsModule } from '../clients/clients.module'
import { PaymentsController } from './payments.controller'
import { LibrariesModule } from '../libraries/libraries.module'
import PaymentContext from './classes/payment-context.class'
import AptStrategy from './classes/apt-strategy.class'
import QrCodeStrategy from './classes/qr-code-strategy.class'
import { DtoRegistry } from './registry/dto.registry'
import { DtoFactory } from './factories/dto.factory'
import PaymentService from './services/payment.service'
import { AptPaymentService } from './services/apt-payment.service'
import { QrCodePaymentService } from './services/qr-code-payment.service'
import { PaymentStrategyInterceptor } from './interceptors/payment-strategy.interceptor'

@Module({
  imports: [AptModule, ClientsModule, LibrariesModule],
  providers: [
    PaymentService,
    PaymentContext,
    AptStrategy,
    QrCodeStrategy,
    AptPaymentService,
    QrCodePaymentService,
    PaymentStrategyInterceptor,
    {
      provide: DtoRegistry,
      useFactory: DtoFactory.create,
    },
  ],
  exports: [
    PaymentService,
    PaymentContext,
    AptStrategy,
    QrCodeStrategy,
    AptPaymentService,
    QrCodePaymentService,
    PaymentStrategyInterceptor,
    {
      provide: DtoRegistry,
      useFactory: DtoFactory.create,
    },
  ],
  controllers: [PaymentsController],
})
export class PaymentsModule {}
