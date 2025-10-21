import { Injectable, InternalServerErrorException } from '@nestjs/common'
import {
  ConnectionStationSessionResponseDto,
  ConnectionStationSessionStartBodyDto,
  ConnectionStationSessionStopBodyDto,
} from './dtos/connection-station.dto'
import axios from 'axios'
import { ConfigService } from '@nestjs/config'
import { normalizeURL } from '../core/helpers'
import { DeviceTypes } from 'evio-library-commons'

@Injectable()
export class ConnectionStationClient {
  constructor(private readonly configService: ConfigService) {}

  async handleSession<
    T extends
      | ConnectionStationSessionStartBodyDto
      | ConnectionStationSessionStopBodyDto,
  >(body: T): Promise<ConnectionStationSessionResponseDto> {
    try {
      const baseURL = this.configService.get('client.connectionStation.host')
      if (!baseURL) {
        throw new InternalServerErrorException(
          'CONNECTION_STATION_SERVICE_HOST environment variable is not set'
        )
      }
      const path = this.configService.get(
        'client.connectionStation.sessionPath'
      )
      if (!path) {
        throw new InternalServerErrorException(
          'sessionPath environment variable is not set in configs'
        )
      }
      const response = await axios.post(normalizeURL(baseURL, path), body, {
        headers: {
          'Content-Type': 'application/json',
          usertype: body.clientType ? body.clientType : DeviceTypes.APT,
          clientname: body.clientName ? body.clientName : 'EVIO',
          userid: body.userId,
        },
      })
      return response.data
    } catch (error) {
      console.error(
        'Error occurred while handling connection station session',
        error
      )
      throw error
    }
  }
}
