import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository as TypeORMRepository } from 'typeorm'
import { Apt } from '../database/entities/apt.entity'
import { UUID } from 'crypto'

@Injectable()
export class AptRepository {
  constructor(
    @InjectRepository(Apt)
    private readonly entity: TypeORMRepository<Apt>
  ) {}

  async insert(apt: Partial<Apt>): Promise<Apt> {
    const aptCreated = this.entity.create(apt)
    const savedApt = await this.entity.save(aptCreated)
    return savedApt
  }

  async findBySerialNumber(
    serial_number: string,
    withRelations: boolean
  ): Promise<Apt | null> {
    return this.entity.findOne({
      where: { serial_number },
      relations: withRelations ? { chargers: { plugs: true } } : [],
    })
  }

  async findById(id: UUID, withRelations: boolean): Promise<Apt | null> {
    return this.entity.findOne({
      where: { id },
      relations: withRelations ? { chargers: { plugs: true } } : [],
    })
  }

  async findAll(withRelations: boolean): Promise<Apt[]> {
    return this.entity.find({
      relations: withRelations ? { chargers: { plugs: true } } : [],
    })
  }

  async update(serial_number: string, apt: Partial<Apt>): Promise<Apt | null> {
    await this.entity.update({ serial_number }, { ...apt, serial_number })
    return this.findBySerialNumber(serial_number, false)
  }

  async delete(serial_number: string): Promise<void> {
    await this.entity.delete({ serial_number })
  }
}
