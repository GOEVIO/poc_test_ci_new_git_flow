import { Injectable } from '@nestjs/common'

@Injectable()
export class AptChargerMockRepository {
  insert = jest.fn()
  insertMany = jest.fn()
  findByHwId = jest.fn()
  findById = jest.fn()
  findAll = jest.fn()
  findManyByHwId = jest.fn()
  update = jest.fn()
  updateMany = jest.fn()
  delete = jest.fn()
  deleteManyByHwId = jest.fn()
  deleteByAptId = jest.fn()
}
