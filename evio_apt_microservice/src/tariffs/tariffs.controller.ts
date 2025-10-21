import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common'
import { TariffsService } from './tariffs.service'
import {
  CreateTariffDto,
  GetTariffsQueryDto,
  TariffDetailsDto,
  UpdateTariffDto,
} from './tariffs.dto'
import { ControllerResult } from '../common/result-wrappers'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { tariffsDetailsToUpdate } from './tests/mocks/tariffs-mock'

@Controller('tariffs-plugs/:hwId/:plug_id')
@ApiTags('Plugs-Tariffs')
export class TariffsController {
  constructor(private readonly tariffsService: TariffsService) {}

  @ApiOperation({ summary: 'Get tariff for a specific plug of a charger' })
  @ApiResponse({
    status: 200,
    description: 'Tariff retrieved successfully',
    type: [TariffDetailsDto],
  })
  @ApiResponse({ status: 404, description: 'Charger or plug not found' })
  @Get()
  async getTariff(
    @Param('hwId') hwId: string,
    @Param('plug_id') plug_id: string,
    @Query() query: GetTariffsQueryDto
  ): Promise<ControllerResult<TariffDetailsDto[] | null>> {
    const tariffs = await this.tariffsService.findTariffsDetails(
      hwId,
      plug_id,
      query.device
    )

    return {
      success: true,
      data: tariffs,
      message: 'Tariff retrieved successfully',
      code: 'tariff_retrieved',
    }
  }

  @ApiOperation({ summary: 'Create tariff for a specific plug of a charger' })
  @ApiResponse({
    status: 201,
    description: 'Tariff created successfully',
    type: TariffDetailsDto,
    example: {
      success: true,
      message: 'Tariff created successfully',
      data: tariffsDetailsToUpdate,
    },
  })
  @ApiResponse({ status: 404, description: 'Charger or plug not found' })
  @Post()
  async createTariff(
    @Param('hwId') hwId: string,
    @Param('plug_id') plug_id: string,
    @Body() body: CreateTariffDto
  ): Promise<ControllerResult<TariffDetailsDto | null>> {
    const tariffCreated = await this.tariffsService.createTariff(
      hwId,
      plug_id,
      body
    )

    return {
      success: true,
      data: tariffCreated,
      message: 'Tariffs created successfully',
      code: 'tariffs_created',
    }
  }

  @ApiOperation({ summary: 'Update tariff for a specific plug of a charger' })
  @ApiResponse({
    status: 200,
    description: 'Tariff updated successfully',
    type: TariffDetailsDto,
    example: {
      success: true,
      message: 'Tariff updated successfully',
      data: tariffsDetailsToUpdate,
    },
  })
  @ApiResponse({ status: 404, description: 'Charger or plug not found' })
  @Put(':id')
  async updateTariff(
    @Param('hwId') hwId: string,
    @Param('plug_id') plug_id: string,
    @Param('id') id: string,
    @Body() updateTariffDto: UpdateTariffDto
  ): Promise<ControllerResult<TariffDetailsDto | null>> {
    const updatedTariffs = await this.tariffsService.updateTariff(
      hwId,
      plug_id,
      id,
      updateTariffDto
    )

    return {
      success: true,
      data: updatedTariffs,
      message: 'Tariff updated successfully',
      code: 'tariff_updated',
    }
  }

  @ApiOperation({ summary: 'Delete tariff for a specific plug of a charger' })
  @ApiResponse({ status: 204, description: 'Tariff deleted successfully' })
  @ApiResponse({ status: 404, description: 'Charger or plug not found' })
  @Delete(':id')
  async deleteTariff(
    @Param('hwId') hwId: string,
    @Param('plug_id') plug_id: string,
    @Param('id') id: string
  ): Promise<ControllerResult<null>> {
    const deletedTariff = await this.tariffsService.deleteTariff(
      hwId,
      plug_id,
      id
    )

    return {
      success: deletedTariff,
      data: null,
      message: 'Tariff deleted successfully',
      code: 'tariff_deleted',
    }
  }
}
