import { Module } from '@nestjs/common'
import { ClientsModule } from '../clients/clients.module'
import { LibrariesModule } from '../libraries/libraries.module'
import { AptModule } from '../apt/apt.module'
import { ChargingSessionController } from './charging-session.controller'
import { ChargersSessionService } from './charger-session.service'

@Module({
  imports: [ClientsModule, LibrariesModule, AptModule],
  providers: [ChargersSessionService],
  exports: [ChargersSessionService],
  controllers: [ChargingSessionController],
})
export class ChargingSessionModule {}
