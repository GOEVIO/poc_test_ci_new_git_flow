import { Injectable } from '@nestjs/common'
import { BusinessChargersServiceInterface } from './business-charger.service.interface'
import { AptChargerService } from './apt/apt-charger.service'
import { QRCodeChargerService } from './qr_code/qr_code-charger.service'

@Injectable()
export class BusinessChargerService
  implements BusinessChargersServiceInterface
{
  private chargerService!: AptChargerService | QRCodeChargerService

  setBusinessContext(chargerService: AptChargerService | QRCodeChargerService) {
    this.chargerService = chargerService
  }

  async getChargersTariffs() {
    return await this.chargerService.getChargersTariffs()
  }
}
