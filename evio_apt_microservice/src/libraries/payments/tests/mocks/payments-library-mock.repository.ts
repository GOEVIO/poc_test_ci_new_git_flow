import { Injectable } from '@nestjs/common'

@Injectable()
export class PaymentsLibraryMockRepository {
  findPreAuthorizationByPSPReference = jest.fn()
  updatePreAuthorizationById = jest.fn()
  findPreAuthorizationById = jest.fn()
}
