import { Module } from '@nestjs/common'
import { ConnectionStationClient } from './connection-station.client'
import { ConfigModule } from '@nestjs/config'
import configModule from '../core/config'
import { PrivateSessionsClient } from './get-sessions/private-sessions.client'
import { PublicSessionsClient } from './get-sessions/public-sessions.client'
import { GetSessionClient } from './get-sessions/get-session.client'
import { PaymentsV2Client } from './payments-v2.client'

const clients = [
  ConnectionStationClient,
  PublicSessionsClient,
  PrivateSessionsClient,
  GetSessionClient,
  PaymentsV2Client,
]

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configModule],
    }),
  ],
  providers: clients,
  exports: clients,
})
export class ClientsModule {}
