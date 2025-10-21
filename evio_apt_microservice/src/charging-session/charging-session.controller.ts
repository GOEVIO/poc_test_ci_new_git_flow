import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { ControllerResult } from '../common/result-wrappers'
import {
  ChargingSessionDto,
  StopChargingSessionDto,
} from './chargin-session.dto'
import { ConnectionStationSessionResponseDto } from '../clients/dtos/connection-station.dto'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { GetSessionInterceptor } from '../core/interceptors/get-session.interceptor'
import {
  GetSessionClientResponseFoundDto,
  GetSessionClientResponseNotFoundDto,
} from '../clients/get-sessions/get-sessions.dto'
import { GetSessionClient } from '../clients/get-sessions/get-session.client'
import { GetAptGuard } from '../common/guard/get-apt.guard'
import { ChargersSessionService } from './charger-session.service'
import { ChargerSessionInterceptor } from './charger-session.interceptor'

@Controller('charging-session')
@ApiTags('Charging Session')
export class ChargingSessionController {
  constructor(
    private readonly getSessionClient: GetSessionClient,
    private readonly chargersSessionService: ChargersSessionService
  ) {}

  @ApiOperation({ summary: 'Start a charging session' })
  @ApiResponse({
    status: 200,
    description: 'Charging session started successfully',
    example: {
      success: true,
      message: 'Charging session started successfully',
      data: {
        auth: 'true',
        code: '',
        message:
          'Session created successfully, attempting to start command start',
        sessionId: '689a1c9c189b880013bfe374',
        hwId: 'CBC-00011',
        userId: '6895e74ccc69504e24bb6540',
        authorization_reference: '2cZJX41W7OyFwIUeztcWdhR0',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'APT not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @UseGuards(GetAptGuard)
  @UseInterceptors(ChargerSessionInterceptor)
  @Post('/start')
  async start(
    @Body() body: ChargingSessionDto
  ): Promise<ControllerResult<ConnectionStationSessionResponseDto | null>> {
    return this.chargersSessionService.startSession(body)
  }

  @ApiOperation({ summary: 'Stop a charging session' })
  @ApiResponse({
    status: 200,
    description: 'Charging session stopped successfully',
    example: {
      success: true,
      message: 'Charging session stopped successfully',
      data: {
        auth: 'true',
        code: '',
        message: 'Remote Stop accepted',
        sessionId: '689a1c9c189b880013bfe374',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'APT not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @UseGuards(GetAptGuard)
  @UseInterceptors(ChargerSessionInterceptor)
  @Post('/stop')
  async stop(
    @Body() body: StopChargingSessionDto
  ): Promise<ControllerResult<ConnectionStationSessionResponseDto | null>> {
    return this.chargersSessionService.stopSession(body)
  }

  @UseInterceptors(GetSessionInterceptor)
  @Get(':id')
  async getChargingSession(
    @Param('id') id: string
  ): Promise<
    ControllerResult<
      GetSessionClientResponseNotFoundDto | GetSessionClientResponseFoundDto
    >
  > {
    const data = await this.getSessionClient.getSession(id)
    return {
      success: true,
      message: 'Charging session retrieved successfully',
      data,
    }
  }
}
