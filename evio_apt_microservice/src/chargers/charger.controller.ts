import { Controller, Get, UseInterceptors } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'

import { ControllerResult } from 'src/common/result-wrappers'
import { GetChargerTariffsDto } from './dtos'
import { MockChargerTariffsResult } from './tests/mocks/charger-tariffs-result.example'
import { GetChargerInterceptor } from './charger.interceptor'
import { BusinessChargerService } from './services/business/business-charger.service'
import { DeviceTypes } from 'evio-library-commons'

@Controller('chargers')
@ApiTags('Charger')
export class ChargerController {
  constructor(
    private readonly businessChargerService: BusinessChargerService
  ) {}

  @ApiOperation({ summary: 'Get charger details by apt serial number' })
  @ApiResponse({
    status: 200,
    description: 'Charger details retrieved successfully',
    type: GetChargerTariffsDto,
    headers: {
      strategy: {
        description: 'Device strategy',
        schema: {
          type: 'enum',
          enum: Object.values(DeviceTypes),
          example: DeviceTypes.APT.toLocaleLowerCase(),
        },
        required: true,
      },
    },
    example: {
      success: true,
      message: 'Charger details retrieved successfully',
      data: MockChargerTariffsResult,
    },
  })
  @ApiResponse({ status: 404, description: 'No chargers found for this APT' })
  @UseInterceptors(GetChargerInterceptor)
  @Get()
  // This route need parameter according to the strategy used
  // If strategy is APT, need APTChargerParamsDto params
  // If strategy is QR_CODE, need QRCodeChargerParamsDto params
  async getChargerDetails(): Promise<ControllerResult<GetChargerTariffsDto>> {
    const chargersWithTariffs =
      await this.businessChargerService.getChargersTariffs()

    return {
      message: 'Charger details retrieved successfully',
      success: true,
      data: {
        ...chargersWithTariffs,
      },
    }
  }
}
