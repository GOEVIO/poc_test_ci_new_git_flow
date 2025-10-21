import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common'
import { BusinessChargersServiceInterface } from '../business-charger.service.interface'
import { ChargersLibraryService } from '../../../../libraries/chargers-library.service'
import { AptChargerRepository } from '../../../charger.repository'
import {
  AptChargerDto,
  ChargerItemPlugsDto,
  GetChargerTariffsDto,
} from '../../../dtos'
import { APTChargerParamsDto } from './apt-charger-params.dto'

@Injectable()
export class AptChargerService implements BusinessChargersServiceInterface {
  private serial_number: string

  constructor(
    { serial_number }: APTChargerParamsDto,
    private readonly chargersLibraryService: ChargersLibraryService,
    private readonly chargerRepository: AptChargerRepository
  ) {
    this.serial_number = serial_number
  }

  async getChargersByAptSerialNumber(): Promise<AptChargerDto[]> {
    try {
      return await this.chargerRepository.findByAptSerialNumber(
        this.serial_number
      )
    } catch (error) {
      throw new InternalServerErrorException({
        message: error instanceof Error ? error.message : 'Chargers not found',
        code: 'chargers_not_found',
      })
    }
  }

  async getChargersTariffs(): Promise<GetChargerTariffsDto> {
    const chargers = await this.getChargersByAptSerialNumber()
    if (!chargers || chargers.length === 0) {
      throw new NotFoundException({
        message: 'No chargers found for this APT',
        code: 'chargers_not_found',
      })
    }

    try {
      const chargersWithTariffs = await Promise.all(
        chargers
          .map((charger) =>
            this.chargersLibraryService.findChargersByAPT(charger)
          )
          .filter((c) => c !== null)
      )

      return {
        chargers: chargersWithTariffs as ChargerItemPlugsDto[],
        totalChargers: chargersWithTariffs.length,
      }
    } catch (error) {
      throw new InternalServerErrorException({
        message: error instanceof Error ? error.message : 'Chargers not found',
        code: 'chargers_not_found',
      })
    }
  }
}
