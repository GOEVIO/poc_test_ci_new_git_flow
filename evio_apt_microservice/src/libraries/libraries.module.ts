import { Module } from '@nestjs/common'
import { IdentityLibraryService } from './identity-library.service'
import { ChargersLibraryService } from './chargers-library.service'
import { OcpiLibraryService } from './ocpi-library.service'
import { ConfigsLibraryService } from './configs-library.service'
import { PaymentsLibraryService } from './payments/payments-library.service'
import { PaymentsLibraryRepository } from './payments/payments-library.repository'

const services = [
  IdentityLibraryService,
  ChargersLibraryService,
  OcpiLibraryService,
  ConfigsLibraryService,
  PaymentsLibraryService,
]

const repositories = [PaymentsLibraryRepository]
@Module({
  providers: [...services, ...repositories],
  exports: [...services, ...repositories],
})
export class LibrariesModule {}
