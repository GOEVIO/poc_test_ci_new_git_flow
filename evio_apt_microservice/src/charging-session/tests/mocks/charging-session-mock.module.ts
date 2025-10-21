import { Module } from '@nestjs/common'
import { ClientsMockModule } from '../../../clients/tests/mock/clients-mock.module'
import { LibrariesMockModule } from '../../../libraries/tests/mocks/libraries-mock.module'
import { AptMockModule } from '../../../apt/tests/mocks/apt-mock.module'
import { ChargingSessionController } from '../../charging-session.controller'

@Module({
  imports: [ClientsMockModule, LibrariesMockModule, AptMockModule],
  controllers: [ChargingSessionController],
})
export class ChargingSessionMockModule {}
