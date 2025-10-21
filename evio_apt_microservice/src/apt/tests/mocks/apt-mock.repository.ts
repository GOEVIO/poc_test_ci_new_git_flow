import { Injectable } from '@nestjs/common'

@Injectable()
export class AptMockRepository {
  insert = jest.fn()
  findBySerialNumber = jest.fn()
  findById = jest.fn()
  findAll = jest.fn()
  update = jest.fn()
  delete = jest.fn()
}
