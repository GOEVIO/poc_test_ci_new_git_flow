import {
  Body,
  Controller,
  HttpCode,
  Post,
  UseInterceptors,
} from '@nestjs/common'
import { ReceiverInterceptor } from '@/interceptors/receiver.interceptor'
import {
  ApiBadGatewayResponse,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  getSchemaPath,
} from '@nestjs/swagger'
import {
  RemoteResponseDto,
  RemoteResultDto,
  RemoteStartDto,
  RemoteStopDto,
} from './dto/charging.dto'
import { ChargingService } from './charging.service'
import { ChargingNotificationService } from './notification.service'
import { defaultErrorSchema } from '@/shared/schema/default-error'
import {
  PhysicalStartDto,
  PhysicalStartResponseDto,
  PhysicalStopDto,
} from './dto/physical-charging.dto'
import {
  ChargingNotificationEndDto,
  ChargingNotificationErrorDto,
  ChargingNotificationProgressDto,
  ChargingNotificationStartDto,
} from './dto/charging-notification.dto'
import { ChargingNotificationType } from './enums/charging-notification'
import { instanceToPlain, plainToInstance } from 'class-transformer'

@Controller({ version: '2.3' })
export class ChargingController {
  constructor(
    private readonly chargingService: ChargingService,
    private readonly chargingNotificationService: ChargingNotificationService,
  ) {}

  @ApiOperation({
    summary: 'Start a remote session',
  })
  @ApiOkResponse({
    description: 'Remote Start sent successfully',
    type: RemoteResponseDto,
  })
  @ApiBadGatewayResponse({
    description: 'Error sending Remote Start command',
    schema: defaultErrorSchema,
  })
  @ApiBody({
    type: RemoteStartDto,
    required: true,
    description: 'EvseId and ContractId',
  })
  @HttpCode(200)
  @Post('charging/remote/start')
  async remoteStart(
    @Body() parameters: RemoteStartDto,
  ): Promise<RemoteResponseDto> {
    return await this.chargingService.remoteStartSession(parameters)
  }

  @ApiOperation({
    summary: 'Remote stop a session',
  })
  @ApiOkResponse({
    description: 'Remote Stop sent successfully',
    type: RemoteResponseDto,
  })
  @ApiBadGatewayResponse({
    description: 'Error sending Remote Stop command',
    schema: defaultErrorSchema,
  })
  @ApiBody({
    type: RemoteStopDto,
    required: true,
    description: 'EvseId and SessionId',
  })
  @HttpCode(200)
  @Post('charging/remote/stop')
  async remoteStop(
    @Body() parameters: RemoteStopDto,
  ): Promise<RemoteResponseDto> {
    return await this.chargingService.remoteStopSession(parameters)
  }

  @ApiOperation({
    summary: 'Start physical sessions',
  })
  @ApiOkResponse({
    description: 'physical session started successfully',
    type: RemoteResponseDto,
  })
  @ApiBadGatewayResponse({
    description: 'Error handling start command',
    schema: defaultErrorSchema,
  })
  @ApiBody({
    type: PhysicalStartDto,
    required: true,
  })
  @ApiParam({
    name: 'id',
    description: 'Operator ID',
    required: true,
    type: String,
  })
  @HttpCode(200)
  @Post('api/oicp/charging/v21/operators/:id/authorize/start')
  async physicalStart(
    @Body() parameters: PhysicalStartDto,
  ): Promise<PhysicalStartResponseDto> {
    return await this.chargingService.startSession(parameters)
  }

  @ApiOperation({
    summary: 'Handle physical sessions',
  })
  @ApiOkResponse({
    description: 'physical session managed successfully',
    type: RemoteResponseDto,
  })
  @ApiBadGatewayResponse({
    description: 'Error sending Accepting command',
    schema: defaultErrorSchema,
  })
  @ApiBody({
    type: RemoteStopDto,
    required: true,
    description: 'EvseId and SessionId',
  })
  @ApiParam({
    name: 'id',
    description: 'Operator ID',
    required: true,
    type: String,
  })
  @HttpCode(200)
  @UseInterceptors(ReceiverInterceptor)
  @Post('api/oicp/charging/v21/operators/:id/authorize/stop')
  async physicalStop(
    @Body() parameters: PhysicalStopDto,
  ): Promise<PhysicalStartResponseDto> {
    return await this.chargingService.stopSession(parameters)
  }

  @ApiOperation({
    summary: 'Handle charging session notifications',
  })
  @ApiOkResponse({
    description: 'Charging session notification handled successfully',
    type: RemoteResponseDto,
  })
  @ApiBadGatewayResponse({
    description: 'Error handling charging session notification command',
    schema: defaultErrorSchema,
  })
  @ApiBody({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(ChargingNotificationStartDto) },
        { $ref: getSchemaPath(ChargingNotificationProgressDto) },
        { $ref: getSchemaPath(ChargingNotificationEndDto) },
        { $ref: getSchemaPath(ChargingNotificationErrorDto) },
      ],
    },
  })
  @HttpCode(200)
  @UseInterceptors(ReceiverInterceptor)
  @Post('api/oicp/notificationmgmt/v11/charging-notifications')
  async chargingNotification(
    @Body()
    notification:
      | ChargingNotificationStartDto
      | ChargingNotificationProgressDto
      | ChargingNotificationEndDto
      | ChargingNotificationErrorDto,
  ): Promise<RemoteResultDto> {
    console.log(notification);
    const plainNotification = instanceToPlain(notification);

    if (plainNotification.Type === ChargingNotificationType.start) {
      const startNotification = plainToInstance(ChargingNotificationStartDto, notification);
      return await this.chargingNotificationService.start(startNotification)

    } else if (plainNotification.Type === ChargingNotificationType.progress) {
      const progressNotification = plainToInstance(ChargingNotificationProgressDto, notification);
      return await this.chargingNotificationService.progress(progressNotification)

    } else if (plainNotification.Type === ChargingNotificationType.end) {
      const endNotification = plainToInstance(ChargingNotificationEndDto, notification);
      return await this.chargingNotificationService.end(endNotification)

    } else {
      const errorNotification = plainToInstance(ChargingNotificationErrorDto, notification);
      return await this.chargingNotificationService.error(errorNotification)
    }
  }
}
