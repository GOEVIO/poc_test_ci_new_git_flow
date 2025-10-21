import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'

// Libs
import { ChargingSessionReadRepository } from 'evio-library-ocpi'
import chargingSessions from 'evio-library-chargers'

// Services
import { PaymentsService } from '../services/service.payments'

@Injectable()
export class SessionsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly PaymentsService: PaymentsService
  ) {}

  async getSessionById(sessionId: string, chargerType: string): Promise<any> {
    const context = 'getSessionById'
    //const config = app.get(ConfigService).get<config['root']>('root');
    try {
      let session = null

      const chargersTypesOCPI = this.configService.get<string[]>('chargersTypesOCPI')

      if (chargersTypesOCPI.includes(chargerType)) {
        session = await ChargingSessionReadRepository.findBySessionId(sessionId)
      } else {
        session = await chargingSessions.findBySessionId(sessionId)
      }
      return session
    } catch (error) {
      console.log(`[${context}] error: ${JSON.stringify(error)}`)
      throw error
    }
  }

  async handleReleasePreAuthorizations(session: any): Promise<boolean> {
    const context = 'handleReleasePreAuthorizations'
    try {
      const chargingSessionsConsts = this.configService.get<any>('ChargingSession')
      if (session.paymentStatus === 'PAID') {
        console.log(`${context} Session ${session._id} will not be processed because it is already paid or not completed`)
        return true
      }

      await this.PaymentsService.releasePreAuthorizationSession(session.id ?? session.sessionId, session._id, session.chargerType, session.status)

      // update the charging session data
      const updateSessionObject = {
        paymentSubStatus: 'Pre Authorization Refunded',
      }
      await this.updateChargingSession(session.id ?? session.sessionId, session.chargerType, updateSessionObject)

      return true
    } catch (error) {
      console.log(`[${context}] error: ${JSON.stringify(error)}`)
      return false
    }
  }

  async processUnpaidErrorSessions(arraySessionsIdentification: Array<{ chargerType: string; sessionId: string }>): Promise<boolean> {
    const context = 'processUnpaidErrorSessions'
    try {
      for (const sessionIdentification of arraySessionsIdentification) {
        let session = null
        try {
          console.log(`[${context}] Processing session ${JSON.stringify(sessionIdentification)}`)
          session = await this.getSessionById(sessionIdentification.sessionId, sessionIdentification.chargerType)
        } catch (error) {
          console.error(`${context} Error - Charging session with missing parameters ${sessionIdentification.sessionId}`)
          // TODO: Send to sentry
          continue
        }

        let response = false
        if (!session) {
          console.error(`${context} Error - Session not found ${sessionIdentification.sessionId}`)
          // TODO: Send to sentry
          continue
        }

        switch (session.paymentMethod) {
          case 'Card':
            if (session.paymentStatus === 'PAID') {
              console.log(`${context} Session ${session._id} will not be processed because it is already paid`)
              continue
            }
            response = await this.handleReleasePreAuthorizations(session)
            break
          default:
            continue
        }
        if (!response) {
          throw new Error(`Error processing session ${session._id}`)
        }
      }
      return true
    } catch (error) {
      console.error(`${context} Error - `, error.message)
      return false
    }
  }

  async updateChargingSession(sessionId: string, chargerType: string, updateObject: any): Promise<boolean> {
    const context = 'updateSession'
    try {
      const chargersTypesOCPI = this.configService.get<string[]>('chargersTypesOCPI')

      if (chargersTypesOCPI.includes(chargerType)) {
        return this.updateSessionOCPI(sessionId, updateObject)
      }
      return this.updateSessionCharger(sessionId, updateObject)
    } catch (error) {
      console.error(`${context} Error - `, error.message)
      return false
    }
  }

  async updateSessionOCPI(sessionID: string, updateObject: any): Promise<boolean> {
    const context = 'updateSessionOCPI'
    try {
      const ocpiConfig = this.configService.get<any>('OCPI')
      const host = `${ocpiConfig.ocpiHost}${ocpiConfig.sessions}`

      const response = await axios.patch(host, { sessionID, updateObject })
      return response?.data ? true : false
    } catch (error) {
      console.error(`${context} Error - `, error.message)
      return false
    }
  }

  async updateSessionCharger(sessionID: string, updateObject: any): Promise<boolean> {
    const context = 'updateSessionCharger'
    try {
      const ocpiConfig = this.configService.get<any>('CHARGERS')
      const host = `${ocpiConfig.ocpiHost}${ocpiConfig.sessions}${sessionID}`

      const response = await axios.patch(host, updateObject)
      return response?.data ? true : false
    } catch (error) {
      console.error(`${context} Error - `, error.message)
      return false
    }
  }

  async getSessionsUnpaidSessionsOver30Days(): Promise<Array<{ chargerType: string; sessionId: string }>> {
    const context = 'getSessionsUnpaidSessionsOver30Days'
    try {
      return ChargingSessionReadRepository.findSessionsToReleasePreAuthorization()
    } catch (error) {
      console.error(`${context} Error - `, error.message)
      throw error
    }
  }
}
