import { Injectable } from '@nestjs/common'

@Injectable()
export class ConnectionStationMockClient {
  handleSession = jest.fn()
}
