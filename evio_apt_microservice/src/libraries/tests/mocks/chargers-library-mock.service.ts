import { Injectable } from '@nestjs/common'

@Injectable()
export class ChargersLibraryMockService {
  findChargersByAPT = jest.fn()
}
