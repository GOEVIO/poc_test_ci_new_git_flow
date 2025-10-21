import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository as TypeORMRepository } from 'typeorm'
import { AptChargers } from '../database/entities/apt-chargers.entity'
import { UUID } from 'crypto'

@Injectable()
export class AptChargerRepository {
  constructor(
    @InjectRepository(AptChargers)
    private readonly entity: TypeORMRepository<AptChargers>
  ) {}

  async insert(charger: Partial<AptChargers>): Promise<AptChargers> {
    const aptChargerCreated = this.entity.create(charger)
    const savedAptCharger = await this.entity.save(aptChargerCreated)
    return savedAptCharger
  }

  async insertMany(chargers: Partial<AptChargers>[]): Promise<AptChargers[]> {
    const aptChargersCreated = this.entity.create(chargers)
    const savedAptChargers = await this.entity.save(aptChargersCreated)
    return savedAptChargers
  }

  async findByHwId(hwId: string, aptId: UUID): Promise<AptChargers | null> {
    return this.entity.findOneBy({ hwId, apt: { id: aptId } })
  }

  async findById(id: UUID): Promise<AptChargers | null> {
    return this.entity.findOneBy({ id })
  }

  async findAll(): Promise<AptChargers[]> {
    return this.entity.find()
  }

  async findManyByHwId(hwIds: string[], aptId: UUID): Promise<AptChargers[]> {
    return this.entity.findBy({ hwId: In(hwIds), apt: { id: aptId } })
  }

  async update(
    hwId: string,
    apt: Partial<AptChargers>,
    aptId: UUID
  ): Promise<AptChargers | null> {
    await this.entity.update({ hwId, apt: { id: aptId } }, { ...apt, hwId })
    return this.findByHwId(hwId, aptId)
  }

  async updateMany(
    hwIds: string[],
    aptDataArray: Partial<AptChargers[]>,
    aptId: UUID
  ): Promise<AptChargers[]> {
    if (
      !hwIds ||
      hwIds.length === 0 ||
      !aptDataArray ||
      aptDataArray.length === 0
    ) {
      await this.deleteByAptId(aptId)
      return []
    }
    const existingChargers = await this.entity.find({
      where: { apt: { id: aptId } },
    })

    const toDelete = existingChargers.filter((c) => !hwIds.includes(c.hwId))

    if (toDelete.length > 0) {
      await this.entity.delete({
        hwId: In(toDelete.map((c) => c.hwId)),
        apt: { id: aptId },
      })
    }

    const upserts = aptDataArray.map((c) =>
      this.entity.create({ ...c, apt: { id: aptId } })
    )

    await this.entity.upsert(upserts, {
      conflictPaths: ['hwId', 'apt'],
      upsertType: 'on-conflict-do-update',
    })

    return this.findManyByHwId(hwIds, aptId)
  }

  async delete(hwId: string, aptId: UUID): Promise<void> {
    await this.entity.delete({ hwId, apt: { id: aptId } })
  }

  async deleteManyByHwId(hwIds: string[], aptId: UUID): Promise<void> {
    if (!hwIds || hwIds.length === 0) {
      return
    }
    await this.entity.delete({ hwId: In(hwIds), apt: { id: aptId } })
  }

  async deleteByAptId(aptId: UUID): Promise<void> {
    await this.entity.delete({ apt: { id: aptId } })
  }

  async findByAptSerialNumber(serial_number: string): Promise<AptChargers[]> {
    return this.entity.find({
      where: { apt: { serial_number } },
      relations: ['apt'],
    })
  }

  async findChargerAndPlugByHwIdWith(
    hwId: string,
    plug_id: string,
    serial_number: string
  ) {
    return this.entity.findOne({
      where: { hwId, plugs: { plug_id }, apt: { serial_number } },
      relations: ['plugs'],
    })
  }
}
