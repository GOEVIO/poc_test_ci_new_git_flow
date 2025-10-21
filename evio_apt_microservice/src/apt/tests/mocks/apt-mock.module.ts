import { Module } from '@nestjs/common'
import { AptMockRepository } from './apt-mock.repository'
import { AptService } from '../../apt.service'
import { AptRepository } from '../../apt.repository'
import { LibrariesMockModule } from '../../../libraries/tests/mocks/libraries-mock.module'
import { AptController } from '../../apt.controller'
import { AptChargerMockModule } from '../../../chargers/tests/mocks/charger-mock.module'

@Module({
  imports: [LibrariesMockModule, AptChargerMockModule],
  controllers: [AptController],
  providers: [
    AptMockRepository,
    AptService,
    { provide: AptRepository, useClass: AptMockRepository },
  ],
  exports: [
    AptMockRepository,
    AptService,
    { provide: AptRepository, useClass: AptMockRepository },
  ],
})
export class AptMockModule {}
