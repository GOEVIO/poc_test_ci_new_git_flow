import { Injectable, InternalServerErrorException } from '@nestjs/common'
import { AptChargerDto } from '../../dtos/charger.dto'
import { AptChargerRepository } from '../../charger.repository'
import { UUID } from 'crypto'
import { PlugsService } from '../../../plugs/plugs.service'

@Injectable()
export class ChargersService {
  constructor(
    private readonly chargerRepository: AptChargerRepository,
    private readonly plugsService: PlugsService
  ) {}

  async create(chargerData: AptChargerDto): Promise<AptChargerDto> {
    try {
      const created = await this.chargerRepository.insert(chargerData)
      await this.plugsService.createMany(created)
      return created
    } catch (error) {
      throw new InternalServerErrorException({
        message: error instanceof Error ? error.message : 'Charger not created',
        code: 'charger_not_created',
      })
    }
  }

  async createMany(chargersData: AptChargerDto[]): Promise<AptChargerDto[]> {
    try {
      const created = await this.chargerRepository.insertMany(chargersData)
      await Promise.all(
        created.map((charger) => this.plugsService.createMany(charger))
      )
      return created
    } catch (error) {
      throw new InternalServerErrorException({
        message:
          error instanceof Error ? error.message : 'Chargers not created',
        code: 'chargers_not_created',
      })
    }
  }

  async updateByHwId(
    hwId: string,
    chargerData: Partial<AptChargerDto>,
    aptId: UUID
  ): Promise<AptChargerDto | null> {
    try {
      const chargerUpdated = await this.chargerRepository.update(
        hwId,
        chargerData,
        aptId
      )
      if (chargerUpdated) {
        await this.plugsService.updateMany(chargerUpdated)
      }
      return chargerUpdated
    } catch (error) {
      throw new InternalServerErrorException({
        message: error instanceof Error ? error.message : 'Charger not found',
        code: 'charger_not_found',
      })
    }
  }

  async updateManyByHwId(
    hwIds: string[],
    chargerData: Partial<AptChargerDto[]>,
    aptId: UUID
  ): Promise<AptChargerDto[]> {
    try {
      const chargersUpdated = await this.chargerRepository.updateMany(
        hwIds,
        chargerData,
        aptId
      )
      if (chargersUpdated) {
        await Promise.all(
          chargersUpdated.map((charger) =>
            this.plugsService.updateMany(charger)
          )
        )
      }
      return chargersUpdated
    } catch (error) {
      throw new InternalServerErrorException({
        message:
          error instanceof Error ? error.message : 'Chargers not updated',
        code: 'chargers_not_updated',
      })
    }
  }

  async deleteByHwId(hwId: string, aptId: UUID): Promise<void> {
    try {
      await this.chargerRepository.delete(hwId, aptId)
    } catch (error) {
      throw new InternalServerErrorException({
        message: error instanceof Error ? error.message : 'Charger not deleted',
        code: 'charger_not_deleted',
      })
    }
  }

  async deleteByAptId(aptId: UUID): Promise<void> {
    try {
      await this.chargerRepository.deleteByAptId(aptId)
    } catch (error) {
      throw new InternalServerErrorException({
        message:
          error instanceof Error ? error.message : 'Chargers not deleted',
        code: 'chargers_not_deleted',
      })
    }
  }

  async findChargerAndPlugByHwIdWithRelations(
    hwId: string,
    plug_id: string,
    serial_number: string
  ) {
    try {
      return await this.chargerRepository.findChargerAndPlugByHwIdWith(
        hwId,
        plug_id,
        serial_number
      )
    } catch (error) {
      throw new InternalServerErrorException({
        message: error instanceof Error ? error.message : 'Charger not found',
        code: 'charger_not_found',
      })
    }
  }
}
