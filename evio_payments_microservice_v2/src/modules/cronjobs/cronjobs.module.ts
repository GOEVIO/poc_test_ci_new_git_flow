import { Module } from '@nestjs/common'
import { CronjobsController } from './cronjobs.controller'
import { CronService } from './cronjobs.service'
import { PreAuthorizationRepository } from 'src/paymentsAdyen/repositories/preauthorization.repository'
import AdyenAptService from '../payment/services/adyen-apt.service'
import { AdyenAdapter } from '../payment/adapters/adyen.adapter'
import { PaymentsRepository } from 'src/paymentsAdyen/repositories/payment.repository'
import { TransactionsRepository } from 'src/paymentsAdyen/repositories/transations.repository '

@Module({
  controllers: [CronjobsController],
  providers: [CronService, PreAuthorizationRepository, AdyenAptService, AdyenAdapter, PaymentsRepository, TransactionsRepository],
})
export class CronjobsModule {}
