import { Module } from '@nestjs/common'
import { LibrariesMockModule } from '../../libraries/tests/mocks/libraries-mock.module'
import { BillingController } from '../billing.controller'

@Module({
  imports: [LibrariesMockModule],
  controllers: [BillingController],
})
export class BillingMockModule {}
