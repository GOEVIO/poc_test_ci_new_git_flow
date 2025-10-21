import { Injectable, InternalServerErrorException } from '@nestjs/common'
import {
  findByAPT,
  findOneChargerInPublicNetworkOrChargers,
  findSessionById,
} from 'evio-library-chargers'
import {
  isPublicCharger,
  InternalChargerInterface,
  PublicChargerInterface,
} from 'evio-library-commons'
import { formatChargerTariff } from '../core/helpers/format-charger'
import { ChargerItemPlugsDto } from '../chargers/dtos'
import { ConfigsLibraryService } from './configs-library.service'

@Injectable()
export class ChargersLibraryService {
  constructor(readonly configsLibraryService: ConfigsLibraryService) {}
  async findChargersByAPT({
    hwId,
    charger_type,
  }: {
    hwId: string
    charger_type: string
  }): Promise<ChargerItemPlugsDto | null> {
    try {
      const charger = await findByAPT(
        hwId,
        isPublicCharger(charger_type) ? 'MOBIE' : 'EVIO'
      )

      if (!charger) {
        return null
      }

      const preAuthorizationData =
        await this.configsLibraryService.getPreAuthorizationCharger(hwId)

      return formatChargerTariff(
        charger as
          | InternalChargerInterface.Charger
          | PublicChargerInterface.Charger,
        isPublicCharger(charger_type),
        preAuthorizationData
      )
    } catch (error) {
      throw new InternalServerErrorException({
        message: error instanceof Error ? error.message : 'Charger not found',
        code: 'get_charger_error',
      })
    }
  }

  async findChargerPlugs(
    hwId: string,
    charger_type: string
  ): Promise<{ plugId: string }[]> {
    const charger = await findOneChargerInPublicNetworkOrChargers(
      { hwId },
      isPublicCharger(charger_type) ? 'publicNetworkDB' : 'chargersDB',
      { 'plugs.plugId': 1 }
    )

    if (!charger || !charger.plugs || charger.plugs.length === 0) {
      return []
    }

    return charger.plugs.map((plug: any) => ({ plugId: plug.plugId }))
  }

  async getSessionById(
    sessionId: string,
    projection: { [key: string]: 1 }
  ): Promise<any | null> {
    try {
      const session = await findSessionById(sessionId, projection)
      return session
    } catch (error) {
      console.error('Error retrieving session:', error)
      throw new InternalServerErrorException({
        message:
          error instanceof Error ? error.message : 'Failed to retrieve session',
        code: 'get_session_error',
      })
    }
  }

  async findSessionToStop(sessionId: string): Promise<any | null> {
    try {
      const session = await this.getSessionById(sessionId, {
        idTag: 1,
        sessionId: 1,
      })
      return { ...session, id: session?.sessionId }
    } catch (error) {
      console.error('Error finding session to stop:', error)
      return null
    }
  }
}
