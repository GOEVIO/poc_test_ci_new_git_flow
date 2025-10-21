import { ChargerMock, ChargingSessionMock } from './chargers.mock'
import { UserMock, BillingProfileMock } from './identity.mock'
import { OverviewDtoType } from '../../../../v2/overview/types/overview-dto.type'

export const BaseOverviewMock: OverviewDtoType = {
  _id: ChargerMock._id,
  hwId: ChargerMock.hwId,
  createUser: ChargerMock.createUser,
  createdAt: ChargerMock.createdAt,
  numberOfPlugs: ChargerMock.plugs.length,
  clientName: ChargerMock.clientName,
  operationalStatus: ChargerMock.operationalStatus,
  lastHeartBeat: ChargerMock.heartBeat,
  status: ChargerMock.status,
  isActive: 'YES',
  B2B2C: 'NO',
  monetization: 'NO',
}

export const UsersOverviewMock: OverviewDtoType = {
  ...BaseOverviewMock,
  customerName: UserMock.name,
  customerEmail: UserMock.email,
}

export const BillingProfileOverviewMock: OverviewDtoType = {
  ...UsersOverviewMock,
  customerNif: BillingProfileMock.nif,
}

export const ClientOverviewMock: OverviewDtoType = {
  ...BillingProfileOverviewMock,
  B2B2C: 'YES',
}

export const ClientsOverviewMock: OverviewDtoType = {
  ...BillingProfileOverviewMock,
  B2B2C: '-',
}

export const TariffsOverviewMock: OverviewDtoType = {
  ...ClientsOverviewMock,
  monetization: 'YES',
}

export const ChargingSessionOverviewMock: OverviewDtoType = {
  ...TariffsOverviewMock,
  lastMonetizationSession: ChargingSessionMock.startDate,
}
