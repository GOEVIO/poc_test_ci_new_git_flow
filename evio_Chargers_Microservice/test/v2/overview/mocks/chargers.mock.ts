import { jest } from '@jest/globals'

import { ProjectedChargerType } from '../../../../v2/overview/repository/chargers.repository'
import { ProjectedChargingSessionType } from '../../../../v2/overview/repository/charging-sessions.repository'
import { MockQueryProjectAsyncFunction } from './mock-functions.t'

const PlugMock = {
  tariff: [{
    tariffId: 'tariffid'
  }]
}

export const ChargerMock: ProjectedChargerType = {
  _id: 'chargerid',
  hwId: 'hwid',
  createdAt: new Date(),
  plugs: [PlugMock],
  clientName: 'clientname',
  status: String(process.env.ChargePointStatusEVIO),
  operationalStatus: String(process.env.OperationalStatusApproved),
  createUser: 'createuserid',
  heartBeat: new Date(),
}

export const ChargingSessionMock: ProjectedChargingSessionType = {
  hwId: ChargerMock.hwId,
  startDate: new Date(),
}

export default {
  aggregatePrivateChargers: <MockQueryProjectAsyncFunction>jest.fn(),
  aggregateChargingSessions: <MockQueryProjectAsyncFunction>jest.fn(),
}
