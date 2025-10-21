import { Injectable, InternalServerErrorException } from '@nestjs/common'
import {
  createToken,
  ChargingSessionReadRepository,
  SessionsService,
  SessionsRepository,
} from 'evio-library-ocpi'
import {
  getRandomInt,
  ChargerTypesMap,
  isPublicCharger,
  DBNames,
} from 'evio-library-commons'

@Injectable()
export class OcpiLibraryService {
  async createAdHocContract(
    userId: string,
    chargerType: string
  ): Promise<string | null> {
    try {
      const appUserUid = String(getRandomInt(100000000000, 999999999999))
      if (!isPublicCharger(chargerType)) return appUserUid
      const network =
        ChargerTypesMap[chargerType as keyof typeof ChargerTypesMap] ===
        'INTERNATIONAL NETWORK'
          ? 'Gireve'
          : 'MobiE'
      const token = await createToken(
        userId,
        '-1',
        network,
        appUserUid,
        'AD_HOC_USER',
        true
      )

      return token ? appUserUid : null
    } catch (error) {
      console.error('Error creating ad-hoc contract:', error)
      throw new InternalServerErrorException({
        message:
          error instanceof Error
            ? error.message
            : 'Failed to create ad-hoc contract',
        code: 'create_contract_error',
      })
    }
  }

  async getSessionById(
    sessionId: string,
    projection: { [key: string]: 1 }
  ): Promise<any | null> {
    try {
      const session = await ChargingSessionReadRepository.findOneFullById(
        sessionId,
        projection
      )
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

  async validateSessionTime(
    sessionId: string,
    chargerType: string
  ): Promise<void> {
    try {
      const protocol = isPublicCharger(chargerType) ? 'OCPI' : 'OCPP'
      await SessionsService.validationSessionTime(sessionId, protocol)
    } catch (error: any) {
      console.error('Error validating session time:', error)
    }
  }

  async findSessionByIdAndDb(
    sessionId: string,
    projection: { [key: string]: 1 },
    chargerType: string
  ): Promise<any | null> {
    try {
      const db = isPublicCharger(chargerType) ? DBNames.OCPI : DBNames.Chargers
      const session = await SessionsRepository.findSessionById(
        sessionId,
        projection,
        db
      )
      return session
    } catch (error) {
      console.error('Error finding session by query:', error)
      return {}
    }
  }

  async findSessionToStop(sessionId: string): Promise<any | null> {
    try {
      return await this.getSessionById(sessionId, {
        'cdr_token.uid': 1,
        id: 1,
      })
    } catch (error) {
      console.error('Error finding session to stop:', error)
      return null
    }
  }
}
