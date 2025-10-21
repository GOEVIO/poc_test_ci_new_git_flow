import { Module } from '@nestjs/common'
import { IdentityLibraryMockService } from './identity-library-mock.service'
import { IdentityLibraryService } from '../../identity-library.service'
import { ChargersLibraryService } from '../../chargers-library.service'
import { ChargersLibraryMockService } from './chargers-library-mock.service'
import { OcpiLibraryMockService } from './ocpi-library-mock.service'
import { OcpiLibraryService } from '../../ocpi-library.service'
import { PaymentsLibraryMockRepository } from '../../payments/tests/mocks/payments-library-mock.repository'
import { PaymentsLibraryRepository } from 'src/libraries/payments/payments-library.repository'
import { PaymentsLibraryService } from 'src/libraries/payments/payments-library.service'

@Module({
  providers: [
    IdentityLibraryMockService,
    IdentityLibraryService,
    ChargersLibraryService,
    PaymentsLibraryMockRepository,
    PaymentsLibraryService,
    { provide: IdentityLibraryService, useClass: IdentityLibraryMockService },
    { provide: ChargersLibraryService, useClass: ChargersLibraryMockService },
    { provide: OcpiLibraryService, useClass: OcpiLibraryMockService },
    {
      provide: PaymentsLibraryRepository,
      useClass: PaymentsLibraryMockRepository,
    },
  ],
  exports: [
    IdentityLibraryMockService,
    IdentityLibraryService,
    ChargersLibraryService,
    PaymentsLibraryMockRepository,
    PaymentsLibraryService,
    { provide: IdentityLibraryService, useClass: IdentityLibraryMockService },
    { provide: ChargersLibraryService, useClass: ChargersLibraryMockService },
    { provide: OcpiLibraryService, useClass: OcpiLibraryMockService },
    {
      provide: PaymentsLibraryRepository,
      useClass: PaymentsLibraryMockRepository,
    },
  ],
})
export class LibrariesMockModule {}
