import { Injectable, InternalServerErrorException } from '@nestjs/common'
import { BusinessChargersServiceInterface } from '../business-charger.service.interface'
import { ChargersLibraryService } from '../../../../libraries/chargers-library.service'
import { ChargerItemPlugsDto, GetChargerTariffsDto } from '../../../dtos'
import { QRCodeChargerParamsDto } from './qr_code-charger-params.dto'

@Injectable()
export class QRCodeChargerService implements BusinessChargersServiceInterface {
  private hwId: string
  private charger_type: string

  constructor(
    { hwId, charger_type }: QRCodeChargerParamsDto,
    private readonly chargersLibraryService: ChargersLibraryService
  ) {
    this.hwId = hwId
    this.charger_type = charger_type
  }

  async getChargersTariffs(): Promise<GetChargerTariffsDto> {
    try {
      const chargerWithTariff =
        await this.chargersLibraryService.findChargersByAPT({
          charger_type: this.charger_type,
          hwId: this.hwId,
        })

      return {
        chargers: [chargerWithTariff] as ChargerItemPlugsDto[],
        totalChargers: 1,
      }
    } catch (error) {
      throw new InternalServerErrorException({
        message: error instanceof Error ? error.message : 'Chargers not found',
        code: 'chargers_not_found',
      })
    }
  }
}
