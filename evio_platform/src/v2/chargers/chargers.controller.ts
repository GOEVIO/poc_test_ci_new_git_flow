import { Body, Controller, Get, HttpCode, NotFoundException, Param, ParseIntPipe, Post } from '@nestjs/common'
import {
  ApiBadGatewayResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger'

import { ResetService } from './services/reset.service'
import { ResetParameters } from './enum/reset-parameters'
import { defaultErrorSchema } from '@/shared/schema/default-error'
import { AvailabilityParameter } from "@/v2/chargers/enum/availability-parameters";
import { ChangeAvailabilityResponseDto } from "@/v2/chargers/dto/change-Availability.dto";
import { ChangeAvailabilityService } from "@/v2/chargers/services/charger-availability.service";
import { AvailabilityPipe } from './pipes/availability.pipe'
import { UnlockConnectorService } from "@/v2/chargers/services/unlock-connector.service";
import { UnlockConnectorResponseDto } from "@/v2/chargers/dto/unlock-connector.dto";
import { ClearCacheResponseDto } from "@/v2/chargers/dto/clear-cache.dto";
import { ClearCacheService } from "@/v2/chargers/services/clear-cache.service";
import { ResetResponseDto } from "@/v2/chargers/dto/reset.dto";
import { ResetPipe } from "@/v2/chargers/pipes/reset.pipe";
import { ChangeAvailabilityChargerService } from './services/change-availability-charger.service';
import { UpdateFirmwareDto, UpdateFirmwareResponseDto } from "@/v2/chargers/dto/update-firmware.dto";
import { UpdateFirmwareService } from "@/v2/chargers/services/update-firmware.service";
import { FirmwareStatusService } from "@/v2/chargers/services/firmware-status-notification.service";
import {RunDiagnosticsService} from "@/v2/chargers/services/run-diagnostics.service";
import {DiagnosticStatusService} from "@/v2/chargers/services/diagnostic-status.service";
import {RunDiagnosticsDto, RunDiagnosticsResponseDto} from "@/v2/chargers/dto/run-diagnostics.dto";

@Controller({ path: 'charger', version: '2' })
export class ChargersController {
  constructor(
      private readonly chargersService: ResetService,
      private readonly changeAvailabilityService: ChangeAvailabilityService,
      private readonly unlockConnectorService: UnlockConnectorService,
      private readonly clearCacheService: ClearCacheService,
      private readonly changeAvailabilityChargerService: ChangeAvailabilityChargerService,
      private readonly updateFirmwareService: UpdateFirmwareService,
      private readonly firmwareStatusService: FirmwareStatusService,
      private readonly runDiagnosticsService: RunDiagnosticsService,
      private readonly diagnosticStatusService: DiagnosticStatusService,
  ) {}

  @ApiOperation({
    summary: 'Unlock connector of a charger',
  })
  @ApiOkResponse({
    description: 'Unlock connector command sent successfully',
  })
  @ApiBadGatewayResponse({
    description: 'Error sending unlock connector command',
    schema: defaultErrorSchema,
  })
  @ApiParam({ name: 'hwId', type: 'string' })
  @ApiParam({ name: 'connectorId', type: 'number' })
  @HttpCode(200)
  @Post('/command/:hwId/unlock-connector/:connectorId')
  async unlockConnector(
      @Param('hwId') hwId: string,
      @Param('connectorId', ParseIntPipe) connectorId: number,
  ): Promise<UnlockConnectorResponseDto> {
    return await this.unlockConnectorService.executeUnlockCommand({
      hwId,
      connectorId,
    });
  }

  @ApiOperation({
    summary: 'Change availability of a charger connector',
  })
  @ApiOkResponse({
    description: 'Change availability command sent successfully',
  })
  @ApiBadGatewayResponse({
    description: 'Error sending change availability command',
    schema: defaultErrorSchema,
  })
  @ApiParam({ name: 'hwId', type: 'string' })
  @ApiParam({ name: 'connectorId', type: 'number' })
  @ApiParam({
    name: 'availability',
    type: 'string',
    enum: ['Operative', 'Inoperative'],
  })
  @HttpCode(200)
  @Post('/command/:hwId/change-availability/:connectorId/:availability')
  async changeAvailability(
      @Param('hwId') hwId: string,
      @Param('connectorId', ParseIntPipe) connectorId: number,
      @Param('availability', AvailabilityPipe) availability: AvailabilityParameter,
  ): Promise<ChangeAvailabilityResponseDto> {
    return await this.changeAvailabilityService.executeAvailabilityCommand({
      hwId,
      connectorId,
      availability,
    })
  }

  @ApiOperation({
    summary: 'Clear cache of a charger',
  })
  @ApiOkResponse({
    description: 'Clear cache command sent successfully',
  })
  @ApiBadGatewayResponse({
    description: 'Error sending clear cache command',
    schema: defaultErrorSchema,
  })
  @ApiParam({ name: 'hwId', type: 'string' })
  @HttpCode(200)
  @Post('/command/:hwId/clear-cache')
  async clearCache(
      @Param('hwId') hwId: string,
  ): Promise<ClearCacheResponseDto> {
    return await this.clearCacheService.executeClearCache({
      hwId,
    });
  }

  @ApiOperation({
    summary: 'Send a reset command to charger',
  })
  @ApiOkResponse({
    description: 'Reset command sent successfully',
  })
  @ApiBadGatewayResponse({
    description: 'Error sending reset command',
    schema: defaultErrorSchema,
  })
  @ApiParam({ name: 'hwId', type: 'string' })
  @ApiParam({
    name: 'resetParameter',
    type: 'string',
    enum: ['Soft', 'Hard'],
  })
  @HttpCode(200)
  @Post('/command/:hwId/reset/:resetParameter')
  async reset(
      @Param('hwId') hwId: string,
      @Param('resetParameter', ResetPipe) resetParameter: ResetParameters,
  ): Promise<ResetResponseDto> {
    console.log(`Received reset request for ${hwId} with type ${resetParameter}`);
    return await this.chargersService.executeCommand({
      hwId,
      resetParameter,
    })
  }


  @ApiOperation({ summary: 'Change availability of the entire charger (connector 0)' })
  @ApiOkResponse({ description: 'Command sent successfully' })
  @ApiBadGatewayResponse({ description: 'Error sending command', schema: defaultErrorSchema })
  @ApiParam({ name: 'hwId', type: 'string' })
  @ApiParam({
    name: 'availability',
    type: 'string',
    enum: ['Operative', 'Inoperative'],
  })
  @HttpCode(200)
  @Post('/command/:hwId/change-availability-charger/:availability')
  async changeAvailabilityCharger(
      @Param('hwId') hwId: string,
      @Param('availability', AvailabilityPipe) availability: AvailabilityParameter,
  ): Promise<ChangeAvailabilityResponseDto> {
    return await this.changeAvailabilityChargerService.executeChargerAvailabilityCommand(hwId, availability);
  }

  @ApiOperation({
    summary: 'Send firmware update command to charger',
  })
  @ApiOkResponse({
    description: 'Firmware update command sent successfully',
  })
  @ApiBadGatewayResponse({
    description: 'Error sending firmware update command',
    schema: defaultErrorSchema,
  })
  @ApiParam({ name: 'hwId', type: 'string' })
  @HttpCode(200)
  @Post('/command/:hwId/update-firmware')
  async updateFirmware(
      @Param('hwId') hwId: string,
      @Body() body: UpdateFirmwareDto,
  ): Promise<UpdateFirmwareResponseDto> {
    return await this.updateFirmwareService.executeUpdateFirmwareCommand({
      hwId,
      location: body.location,
      retrieveDate: body.retrieveDate,
    });
  }

  @ApiOperation({
    summary: 'Get firmware update status of a charger',
  })
  @ApiOkResponse({
    description: 'Returns current firmware update status',
  })
  @ApiParam({ name: 'hwId', type: 'string' })
  @HttpCode(200)
  @Get('/status/:hwId/firmware-update')
  async getFirmwareStatus(@Param('hwId') hwId: string): Promise<UpdateFirmwareResponseDto> {
    return await this.updateFirmwareService.getStatus(hwId);
  }


  @ApiOperation({summary: ' Get diagnostics status of a charger'})
  @ApiOkResponse( {description: 'Returns current diagnostics status'})
  @ApiParam({name: 'hwId', type: 'string'})
  @HttpCode(200)
  @Get('/status/:hwId/diagnostics')
  async getDiagnosticsStatus(@Param('hwId') hwId: string): Promise<{ status: string; timestamp: string }> {
    const redisData = await this.diagnosticStatusService.getStatus(hwId);

    if (redisData) {
      return {
        status: redisData.status,
        timestamp: redisData.timestamp,
      };
    }

    throw new NotFoundException('No diagnostics status found');
  }

  @ApiOperation({
    summary: 'Send diagnostics command to charger',
  })
  @ApiOkResponse({
    description: 'Diagnostics command sent successfully',
  })
  @ApiBadGatewayResponse({
    description: 'Error sending diagnostics command',
    schema: defaultErrorSchema,
  })
  @ApiParam({ name: 'hwId', type: 'string' })
  @HttpCode(200)
  @Post('/command/:hwId/run-diagnostics')
  async runDiagnostics(
      @Param('hwId') hwId: string,
      @Body() body: RunDiagnosticsDto,
  ): Promise<RunDiagnosticsResponseDto> {
    return await this.runDiagnosticsService.executeRunDiagnosticsCommand(hwId, body);
  }
}
