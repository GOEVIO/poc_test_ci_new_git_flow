import { Injectable } from '@nestjs/common'

import { PaginationDto } from '@/shared/pagination/pagination.dto'
import { ClientTypeType } from '@/shared/types/client-type.type'
import { yesNoDashFromLength } from '@/shared/types/yes-no-dash.type'
import { OverviewDataDto } from './overview.dto'
import {
  getBillingProfilesMap,
  ProjectedBillingProfile,
} from './repository/billing-profiles.repository'
import { getClients } from './repository/clients.repository'
import { getEvs, ProjectedEv } from './repository/evs.repository'
import { getUsersMap, ProjectedUser } from './repository/users.repostory'
import { filterDuplicates, get, isNotUndefined } from 'evio-library-commons'

export type OverviewFilters = {
  dateFrom?: Date
  dateThru?: Date
  clientType?: ClientTypeType
  createUser?: string
}

@Injectable()
export class OverviewService {
  private getAssetType(ev: ProjectedEv): string {
    if (ev.evType === 'otherEv') {
      if (ev.brand === 'TYPEUSER') {
        return 'Employee'
      }
      if (ev.brand === 'TYPECARD') {
        return 'Card'
      }
      return 'other'
    }
    return ev.evType
  }

  private buildOverviewDataDto(
    ev: ProjectedEv,
    user: ProjectedUser,
    clients: string[],
    billingProfile?: ProjectedBillingProfile,
  ): OverviewDataDto {
    return {
      createdAt: String(ev.createdAt),
      licensePlate: ev.licensePlate,
      clientName: ev.clientName,
      clientType: user.clientType,
      costumerName: user.name,
      costumerEmail: user.email,
      costumerNif: billingProfile?.nif,
      B2B2C: yesNoDashFromLength(
        clients.filter((client) => client === ev.userId).length,
      ),
      assetType: this.getAssetType(ev),
      active: ev.hasFleet,
    }
  }

  public async get(
    pagination: PaginationDto,
    { dateFrom, dateThru, clientType, createUser }: OverviewFilters,
  ): Promise<Array<OverviewDataDto>> {
    const evs = await getEvs({ pagination, dateFrom, dateThru, createUser })
    const userIds = filterDuplicates(
      evs.map(get('userId')).filter(isNotUndefined),
    )
    const [usersMap, clients, billingProfilesMap] = await Promise.all([
      getUsersMap(userIds, clientType),
      getClients(userIds),
      getBillingProfilesMap(userIds),
    ])
    return evs
      .filter((ev) => usersMap[ev.userId])
      .map((ev) =>
        this.buildOverviewDataDto(
          ev,
          usersMap[ev.userId],
          clients,
          billingProfilesMap[ev.userId],
        ),
      )
  }
}
