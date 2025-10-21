import { Injectable, InternalServerErrorException } from '@nestjs/common'
import { AptPlugsRepository } from './plugs.repository'
import { AptChargers } from '../database/entities/apt-chargers.entity'
import { ChargersLibraryService } from '../libraries/chargers-library.service'
import { AptPlugs } from '../database/entities/apt-charger-plugs.entity'
import { UUID } from 'crypto'
import { AptTariffsDetails } from '../database/entities'

@Injectable()
export class PlugsService {
  constructor(
    private readonly plugRepository: AptPlugsRepository,
    private readonly chargersLibraryService: ChargersLibraryService
  ) {}

  async createMany(charger: AptChargers): Promise<AptPlugs[]> {
    try {
      const plugs = await this.chargersLibraryService.findChargerPlugs(
        charger.hwId,
        charger.charger_type
      )

      const plugsToCreate = plugs.map((plug) => ({
        plug_id: plug.plugId,
        charger,
      }))

      const plugsCreate = await this.plugRepository.insertMany(plugsToCreate)

      return plugsCreate
    } catch (error) {
      throw new InternalServerErrorException({
        message: error instanceof Error ? error.message : 'Plugs not created',
        code: 'plugs_not_created',
      })
    }
  }

  async updateMany(charger: AptChargers): Promise<AptPlugs[]> {
    try {
      const plugs = await this.chargersLibraryService.findChargerPlugs(
        charger.hwId,
        charger.charger_type
      )

      const plugsIds = plugs.map((plug) => plug.plugId)

      const plugsData = plugs.map((plug) => ({
        plug_id: plug.plugId,
        charger,
      }))

      return await this.plugRepository.updateMany(
        charger.id as UUID,
        plugsIds,
        plugsData
      )
    } catch (error) {
      throw new InternalServerErrorException({
        message: error instanceof Error ? error.message : 'Plugs not updated',
        code: 'plugs_not_updated',
      })
    }
  }

  async updatePlugWithTariffs(
    id: UUID,
    tariffs: AptTariffsDetails
  ): Promise<void> {
    try {
      await this.plugRepository.updatePlugWithTariffs(id, tariffs)
    } catch (error) {
      throw new InternalServerErrorException({
        message: error instanceof Error ? error.message : 'Tariffs not updated',
        code: 'tariffs_not_updated',
      })
    }
  }

  async findPlugByPlugIdAndChargerHwId(
    plug_id: string,
    charger_hwId: string
  ): Promise<AptPlugs | null> {
    return this.plugRepository.findPlugByPlugIdAndChargerHwId(
      plug_id,
      charger_hwId
    )
  }
}
