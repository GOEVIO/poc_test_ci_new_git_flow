import { IOCPISession, IChargingSession } from 'evio-library-commons'

export class GetSessionClientResponseFoundDto {
  chargingSession!: Partial<IOCPISession | IChargingSession>[]
}

export class GetSessionClientResponseNotFoundDto {
  auth!: boolean
  code!: string
  message!: string
}
