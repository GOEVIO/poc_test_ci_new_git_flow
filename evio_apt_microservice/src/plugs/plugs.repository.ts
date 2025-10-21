import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository as TypeORMRepository } from 'typeorm'
import { AptPlugs } from '../database/entities/apt-charger-plugs.entity'
import { UUID } from 'crypto'
import { AptTariffsDetails } from '../database/entities'

@Injectable()
export class AptPlugsRepository {
  constructor(
    @InjectRepository(AptPlugs)
    private readonly entity: TypeORMRepository<AptPlugs>
  ) {}

  async insert(plug: Partial<AptPlugs>): Promise<AptPlugs> {
    const aptPlugCreated = this.entity.create(plug)
    const savedAptPlug = await this.entity.save(aptPlugCreated)
    return savedAptPlug
  }

  async insertMany(plug: Partial<AptPlugs>[]): Promise<AptPlugs[]> {
    const aptPlugCreated = this.entity.create(plug)
    const savedAptPlug = await this.entity.save(aptPlugCreated)
    return savedAptPlug
  }

  async findById(id: UUID): Promise<AptPlugs | null> {
    return this.entity.findOneBy({ id })
  }

  async findAll(): Promise<AptPlugs[]> {
    return this.entity.find()
  }

  async findByPlugId(plug_id: UUID): Promise<AptPlugs | null> {
    return this.entity.findOneBy({ plug_id })
  }

  async findManyByChargerId(charger_id: UUID): Promise<AptPlugs[]> {
    return this.entity.find({ where: { charger: { id: charger_id } } })
  }

  async update(
    plug: Partial<AptPlugs>,
    plug_id: UUID
  ): Promise<AptPlugs | null> {
    await this.entity.update({ plug_id }, { ...plug })
    return this.findByPlugId(plug_id)
  }

  async updateMany(
    charger_id: UUID,
    plugIds: string[],
    plugsData: Partial<AptPlugs[]>
  ): Promise<AptPlugs[]> {
    if (
      !plugIds ||
      plugIds.length === 0 ||
      !plugsData ||
      plugsData.length === 0
    ) {
      await this.deleteByChargerId(charger_id)
      return []
    }
    const existingPlugs = await this.entity.find({
      where: { charger: { id: charger_id } },
    })

    const toDelete = existingPlugs.filter((c) => !plugIds.includes(c.plug_id))

    if (toDelete.length > 0) {
      await this.entity.delete({
        plug_id: In(toDelete.map((c) => c.plug_id)),
        charger: { id: charger_id },
      })
    }

    const upserts = plugsData.map((c) =>
      this.entity.create({ ...c, charger: { id: charger_id } })
    )

    await this.entity.upsert(upserts, {
      conflictPaths: ['plug_id', 'chargerId'],
      upsertType: 'on-conflict-do-update',
    })

    return this.findManyByChargerId(charger_id)
  }

  async delete(plug_id: string, charger_id: UUID): Promise<void> {
    await this.entity.delete({ plug_id, charger: { id: charger_id } })
  }

  async deleteManyByPlugId(
    plug_ids: string[],
    charger_id: UUID
  ): Promise<void> {
    if (!plug_ids || plug_ids.length === 0) {
      return
    }
    await this.entity.delete({
      plug_id: In(plug_ids),
      charger: { id: charger_id },
    })
  }

  async deleteByPlugId(plugId: UUID): Promise<void> {
    await this.entity.delete({ id: plugId })
  }

  async deleteByPlugIds(plugIds: UUID[]): Promise<void> {
    if (!plugIds || plugIds.length === 0) {
      return
    }
    await this.entity.delete({ id: In(plugIds) })
  }

  async deleteByChargerId(charger_id: UUID): Promise<void> {
    await this.entity.delete({ charger: { id: charger_id } })
  }

  async updatePlugWithTariffs(
    id: UUID,
    tariffs: AptTariffsDetails
  ): Promise<void> {
    await this.entity.update({ id }, { tariffs_detail: tariffs })
  }

  async findPlugByPlugIdAndChargerHwId(
    plug_id: string,
    hwId: string
  ): Promise<AptPlugs | null> {
    return this.entity.findOneBy({ plug_id, charger: { hwId } })
  }
}
