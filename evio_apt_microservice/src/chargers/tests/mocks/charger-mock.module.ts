import { Module } from '@nestjs/common'
import { AptChargerMockRepository } from './charger-mock.repository'
import { ChargersService } from '../../services/common/charger.service'
import { AptChargerRepository } from '../../charger.repository'
import { LibrariesMockModule } from '../../../libraries/tests/mocks/libraries-mock.module'
import { ChargerController } from '../../charger.controller'

@Module({
  imports: [LibrariesMockModule],
  controllers: [ChargerController],
  providers: [
    AptChargerMockRepository,
    ChargersService,
    { provide: AptChargerRepository, useClass: AptChargerMockRepository },
  ],
  exports: [
    AptChargerMockRepository,
    ChargersService,
    { provide: AptChargerRepository, useClass: AptChargerMockRepository },
  ],
})
export class AptChargerMockModule {}
