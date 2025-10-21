import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common'
import { TariffsRepository } from './tariffs.repository'
import {
  CreateTariffDto,
  TariffDetailsDto,
  UpdateTariffDto,
} from './tariffs.dto'
import { AptTariffsDetails } from '../database/entities'
import { UUID } from 'crypto'
import { PlugsService } from '../plugs/plugs.service'
import { DeviceTypes, isEmptyObject } from 'evio-library-commons'
import { plainToCleanInstance } from '../core/helpers'

@Injectable()
export class TariffsService {
  constructor(
    private readonly tariffsRepository: TariffsRepository,
    private readonly plugsService: PlugsService
  ) {}

  async createTariff(
    hwId: string,
    plug_id: string,
    { details }: CreateTariffDto
  ): Promise<AptTariffsDetails | null> {
    const plug = await this.plugsService.findPlugByPlugIdAndChargerHwId(
      plug_id,
      hwId
    )
    if (!plug?.id) {
      throw new NotFoundException({
        message: 'Plug not found',
        code: 'plug_not_found',
        success: false,
      })
    }
    details.plug = plug

    const tariffs = await this.tariffsRepository.insertTariffs({ details })

    if (!tariffs || isEmptyObject(tariffs) || !tariffs.id) {
      throw new NotFoundException({
        message: 'Tariffs not created',
        code: 'tariffs_not_created',
        success: false,
      })
    }

    try {
      await this.plugsService.updatePlugWithTariffs(plug.id, tariffs)
    } catch (error) {
      await this.tariffsRepository.deleteTariffs(tariffs.id)
      throw new InternalServerErrorException({
        message: 'Error updating plug with tariffs',
        code: 'error_updating_plug_with_tariffs',
        success: false,
      })
    }
    return plainToCleanInstance(TariffDetailsDto, tariffs)
  }

  async updateTariff(
    hwId: string,
    plug_id: string,
    id: string,
    updateTariffDto: UpdateTariffDto
  ): Promise<AptTariffsDetails | null> {
    const plug = await this.plugsService.findPlugByPlugIdAndChargerHwId(
      plug_id,
      hwId
    )
    if (!plug?.id) {
      throw new NotFoundException({
        message: 'Plug not found',
        code: 'plug_not_found',
        success: false,
      })
    }

    const tariffs = await this.findTariffById(id)
    if (!tariffs) {
      throw new NotFoundException({
        message: 'Tariff not found',
        code: 'tariff_not_found',
        success: false,
      })
    }

    const updated = await this.tariffsRepository.updateTariffs(
      id,
      updateTariffDto
    )
    if (!updated) {
      throw new InternalServerErrorException({
        message: 'Error updating tariff',
        code: 'error_updating_tariff',
        success: false,
      })
    }
    return plainToCleanInstance(TariffDetailsDto, updated)
  }

  async deleteTariff(
    hwId: string,
    plug_id: string,
    id: string
  ): Promise<boolean> {
    const plug = await this.plugsService.findPlugByPlugIdAndChargerHwId(
      plug_id,
      hwId
    )
    if (!plug?.id) {
      throw new NotFoundException({
        message: 'Plug not found',
        code: 'plug_not_found',
        success: false,
      })
    }

    const tariffs = await this.findTariffById(id)
    if (!tariffs) {
      throw new NotFoundException({
        message: 'Tariff not found',
        code: 'tariff_not_found',
        success: false,
      })
    }

    const deleted = this.tariffsRepository.deleteTariffs(tariffs.id as UUID)

    if (!deleted) {
      throw new InternalServerErrorException({
        message: 'Error deleting tariff',
        code: 'error_deleting_tariff',
        success: false,
      })
    }

    return true
  }

  async findTariffById(id: string): Promise<AptTariffsDetails | null> {
    return this.tariffsRepository.findTariffById(id)
  }

  async findTariffByPlugId(
    plug_id: string,
    device: DeviceTypes
  ): Promise<AptTariffsDetails[] | null> {
    return this.tariffsRepository.findTariffByPlugId(plug_id, device)
  }

  async findTariffsDetails(
    hwId: string,
    plug_id: string,
    device: DeviceTypes
  ): Promise<TariffDetailsDto[] | null> {
    const plug = await this.plugsService.findPlugByPlugIdAndChargerHwId(
      plug_id,
      hwId
    )
    if (!plug?.id) {
      throw new NotFoundException({
        message: 'Plug not found',
        code: 'plug_not_found',
        success: false,
      })
    }

    const tariffs = await this.findTariffByPlugId(plug.id, device)
    if (!tariffs) {
      throw new NotFoundException({
        message: 'Tariff not found',
        code: 'tariff_not_found',
        success: false,
      })
    }

    return tariffs.map((t) => plainToCleanInstance(TariffDetailsDto, t))
  }
}
