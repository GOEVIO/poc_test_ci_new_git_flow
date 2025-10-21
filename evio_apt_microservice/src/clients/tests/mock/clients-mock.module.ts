import { Module } from '@nestjs/common'
import { ConnectionStationClient } from '../../connection-station.client'
import { ConnectionStationMockClient } from './connection-station-mock.client'
import { ConfigModule } from '@nestjs/config'
import configModule from '../../../core/config'

const clients = [ConnectionStationClient, ConnectionStationMockClient]

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configModule],
    }),
  ],
  providers: [
    ...clients,
    { provide: ConnectionStationClient, useClass: ConnectionStationMockClient },
  ],
  exports: [
    ...clients,
    { provide: ConnectionStationClient, useClass: ConnectionStationMockClient },
  ],
})
export class ClientsMockModule {}
