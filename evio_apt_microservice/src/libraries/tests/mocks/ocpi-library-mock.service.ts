import { Injectable } from '@nestjs/common'

@Injectable()
export class OcpiLibraryMockService {
  createAdHocContract = jest.fn()
  getSessionById = jest.fn()
}
