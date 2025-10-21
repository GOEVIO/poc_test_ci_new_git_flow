import { BadRequestException, Injectable } from '@nestjs/common'
import { LogsService } from '../../logs/logs.service'
import { RemoteResultDto } from './dto/charging.dto'
import { ChargingSessionReadRepository as ChargingSessionRepository } from 'evio-library-ocpi'
import {
  ChargingNotificationEndDto,
  ChargingNotificationErrorDto,
  ChargingNotificationProgressDto,
  ChargingNotificationStartDto,
  ReadingPointDto,
} from './dto/charging-notification.dto'
import { instanceToPlain, plainToInstance } from 'class-transformer'
import { EVSEStatuses, OcpiSessionStatus } from 'evio-library-commons'

@Injectable()
export class ChargingNotificationService {
  constructor(private readonly logger: LogsService) {
    this.logger.setContext(ChargingNotificationService.name)
  }

  private parseReadingPoints = (totalPower: number, readDate?: Date, communicationDate?: Date): ReadingPointDto  => plainToInstance(ReadingPointDto, { totalPower, readDate: readDate ?? new Date(), communicationDate: communicationDate ?? new Date() })


  async start(
    { sessionId, meterValueStart, chargingStart }: ChargingNotificationStartDto,
  ): Promise<RemoteResultDto> {
    try {
      const communicationDate = new Date();
      const readDate = new Date(chargingStart);

      // Check if session is already completed and return success without change anything
      const completed = await this.sessionIsCompleted(sessionId);
      if (completed) return completed;

      await ChargingSessionRepository.updateSessionByExternalId(sessionId, {
          status: OcpiSessionStatus.SessionStatusRunning,
          start_date_time: chargingStart,
          kwh: 0,
      }, {
        readingPoints: this.parseReadingPoints(meterValueStart*1000, readDate, communicationDate)
      })

      return this.notificationResponse('000','Charging started successfully', sessionId)
    } catch (error: any) {
      this.logger.error(error?.response?.data ?? error)
      throw new BadRequestException(error?.response?.data ?? error)
    }
  }

  async progress(
     { sessionId, consumedEnergyProgress, chargingDuration, eventOccurred }: ChargingNotificationProgressDto,
  ): Promise<RemoteResultDto> {
    try {
      if(!consumedEnergyProgress){
        return this.notificationResponse('022','Missing ConsumedEnergyProgress', sessionId)
      }

      // Check if session is already completed and return success without change anything
      const completed = await this.sessionIsCompleted(sessionId);
      if (completed) return completed;

      const communicationDate = new Date();
      const meterDate = new Date(eventOccurred);
      await ChargingSessionRepository.updateSessionByExternalId(sessionId, {
          status: OcpiSessionStatus.SessionStatusRunning,
          timeCharged: chargingDuration / 1000,
          kwh: Number(consumedEnergyProgress.toFixed(2)),
          totalPower: consumedEnergyProgress * 1000,
      }, {
          readingPoints: this.parseReadingPoints(consumedEnergyProgress*1000, meterDate, communicationDate)
      })
      return this.notificationResponse('000','Charging progress updated successfully', sessionId)
    } catch (error: any) {
      this.logger.error(error?.response?.data ?? error)
      throw new BadRequestException(error?.response?.data ?? error)
    }
  }

  async end(
     { sessionId, ConsumedEnergy, chargingStart, chargingEnd, meterValueEnd }: ChargingNotificationEndDto,
  ): Promise<RemoteResultDto> {
    try {
      if(!ConsumedEnergy){
        return this.notificationResponse('022','Missing ConsumedEnergy', sessionId)
      }

      // Check if session is already completed and return success without change anything
      const completed = await this.sessionIsCompleted(sessionId, false);
      if (completed) return completed;

      const communicationDate = new Date();
      const meterStartDate = new Date(chargingStart);
      const meterEndDate = new Date(chargingEnd);
      const timeCharged = (meterEndDate.getTime() - meterStartDate.getTime()) / 1000
      await ChargingSessionRepository.updateSessionByExternalId(sessionId, {
          status: OcpiSessionStatus.SessionStatusStopped,
          timeCharged,
          kwh: Number(meterValueEnd.toFixed(2)),
          totalPower: meterValueEnd * 1000,
      }, {
        readingPoints: this.parseReadingPoints(ConsumedEnergy*1000, meterEndDate, communicationDate)
      })
      return this.notificationResponse('000','Charging ended successfully', sessionId)
    } catch (error: any) {
      this.logger.error(error?.response?.data ?? error)
      throw new BadRequestException(error?.response?.data ?? error)
    }
  }

  async error(
    notification: ChargingNotificationErrorDto,
  ): Promise<RemoteResultDto> {
    try {
      this.logger.error('Charging Error!', notification)
      return this.notificationResponse('000','Charging error handled successfully', notification.sessionId)
    } catch (error: any) {
      this.logger.error(error?.response?.data ?? error)
      throw new BadRequestException(error?.response?.data ?? error)
    }
  }

  private notificationResponse(
    code: string,
    description?: string,
    sessionId?: string,
  ): RemoteResultDto {
    const response = new RemoteResultDto()
    response.result = code === '000'
    response.statusCode = { code, description }
    if (sessionId) {
      response.sessionId = sessionId
    }
    return instanceToPlain(response) as RemoteResultDto
  }

  /* Check if session is already completed and return success without change anything */
  public async sessionIsCompleted(sessionId: string, checkStatus: boolean = false): Promise<RemoteResultDto | false> {
    const session = await ChargingSessionRepository.findSessionByExternalId(sessionId) as any;
      if((checkStatus && session?.status === OcpiSessionStatus.SessionStatusStopped) || (session?.cdrId && session?.cdrId !== "-1")){
        return this.notificationResponse('000','Charging session is already completed', sessionId)
      }
      return false;
  }
}
