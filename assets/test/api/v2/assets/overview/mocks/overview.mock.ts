import {
  OverviewDataDto,
  OverviewDto,
} from '@/api/v2/assets/overview/overview.dto'
import { paginationMock } from './pagination.mock'
import { objectToQueryString } from './object-to-query-params'
import { PaginationDto } from '@/shared/pagination/pagination.dto'
import { evMock } from './evs.mock'
import { b2b2cMock, billingProfileMock, userMock } from './identity.mock'

export const overviewMock: OverviewDataDto = {
  createdAt: String(evMock.createdAt),
  licensePlate: evMock.licensePlate,
  clientName: evMock.clientName,
  costumerName: userMock.name,
  costumerEmail: userMock.email,
  costumerNif: billingProfileMock.nif,
  clientType: userMock.clientType,
  B2B2C: b2b2cMock,
  assetType: evMock.evType,
  active: evMock.hasFleet,
}

export const overviewDtoMock = new OverviewDto(
  [overviewMock],
  new PaginationDto(),
  {},
)

export const paramsOverviewDtoMock = new OverviewDto(
  [overviewMock],
  paginationMock,
  {},
)

export const paramsQueryString = `?${objectToQueryString(paginationMock)}`
