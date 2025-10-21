import { Module } from '@nestjs/common'
import { LibrariesModule } from '../libraries/libraries.module'
import { BillingController } from './billing.controller'

@Module({
  imports: [LibrariesModule],
  controllers: [BillingController],
})
export class BillingModule {}
