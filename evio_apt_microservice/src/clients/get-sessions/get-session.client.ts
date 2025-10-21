import { isPublicCharger } from 'evio-library-commons'
import { GetSessionClientInterface } from './get-sessions.interface'
import { PublicSessionsClient } from './public-sessions.client'
import { PrivateSessionsClient } from './private-sessions.client'
import { Injectable } from '@nestjs/common'

@Injectable()
export class GetSessionClient implements GetSessionClientInterface {
  private getSessionContext!: GetSessionClientInterface
  constructor(
    private readonly publicSessionsClient: PublicSessionsClient,
    private readonly privateSessionsClient: PrivateSessionsClient
  ) {}

  setGetSessionClient(chargerType: string) {
    const isPublicSession = isPublicCharger(chargerType)
    this.getSessionContext = isPublicSession
      ? this.publicSessionsClient
      : this.privateSessionsClient
  }

  async getSession(sessionId: string) {
    return this.getSessionContext.getSession(sessionId)
  }
}
