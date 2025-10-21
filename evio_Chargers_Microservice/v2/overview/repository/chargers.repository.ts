import ChargersLib from 'evio-library-chargers'

import { FiltersType } from '../types/filters.type'

export type ProjectedChargerType = {
  _id: string,
  hwId: string,
  createdAt: Date,
  clientName: string,
  status: string,
  operationalStatus: string,
  createUser: string,
  heartBeat: Date,
  plugs: Array<{
    tariff?: Array<{
      tariffId?: string
    }>
  }>,
}

const projection = {
  _id: 1,
  hwId: 1,
  createdAt: 1,
  plugs: {
    tariff: {
      tariffId: 1,
    }
  },
  clientName:1,
  status:1,
  operationalStatus: 1,
  createUser:1,
  heartBeat: 1,
}

function filterSteps({ createUser, dateFrom, dateThru }: FiltersType) {
  if (![createUser, dateFrom, dateThru].some(Boolean)) {
    return []
  }
  const matchCreateUser = createUser ? { createUser } : {}
  const matchDateFrom = dateFrom ? { $gte: dateFrom } : {}
  const matchDateThru = dateThru ? { $lte: dateThru } : {}
  const matchCreatedAt = dateFrom || dateThru
    ? { createdAt: { ...matchDateFrom, ...matchDateThru } }
    : {}

  return [{ $match: { ...matchCreateUser, ...matchCreatedAt } }]
}

export async function getChargers(
  filters: FiltersType
): Promise<Array<ProjectedChargerType>> {
  const aggregationPipeline = [
    ...filterSteps(filters),
    { $sort: { createdAt: -1, _id: -1 } },
    { $project: projection }
  ] as Record<string, any>[]

  return (await ChargersLib.aggregatePrivateChargers(aggregationPipeline)) as ProjectedChargerType[]
}
