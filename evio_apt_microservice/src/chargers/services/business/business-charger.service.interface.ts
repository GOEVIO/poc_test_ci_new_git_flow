import { GetChargerTariffsDto } from '../../dtos'

export abstract class BusinessChargersServiceInterface {
  abstract getChargersTariffs(): Promise<GetChargerTariffsDto>
}
