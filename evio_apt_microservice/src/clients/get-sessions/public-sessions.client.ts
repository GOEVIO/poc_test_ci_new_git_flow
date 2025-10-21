import { Injectable, InternalServerErrorException } from '@nestjs/common'
import axios from 'axios'
import { ConfigService } from '@nestjs/config'
import { normalizeURL } from '../../core/helpers'
import {
  GetSessionClientResponseFoundDto,
  GetSessionClientResponseNotFoundDto,
} from './get-sessions.dto'
import { GetSessionClientInterface } from './get-sessions.interface'

@Injectable()
export class PublicSessionsClient implements GetSessionClientInterface {
  constructor(private readonly configService: ConfigService) {}

  async getSession(
    sessionId: string
  ): Promise<
    GetSessionClientResponseNotFoundDto | GetSessionClientResponseFoundDto
  > {
    try {
      const baseURL = this.configService.get('client.ocpi.host')
      if (!baseURL) {
        throw new InternalServerErrorException(
          'OCPI_SERVICE_HOST environment variable is not set'
        )
      }
      const path = this.configService.get('client.ocpi.getSessionPath')
      if (!path) {
        throw new InternalServerErrorException(
          'getSessionPath environment variable is not set in configs'
        )
      }
      const params = {
        _id: sessionId,
      }

      const response = await axios.get(normalizeURL(baseURL, path), { params })
      return response.data
    } catch (error: any) {
      console.error(
        `Error fetching session with ID ${sessionId}: ${error.message}`
      )
      return { chargingSession: [] }
    }
  }
}
