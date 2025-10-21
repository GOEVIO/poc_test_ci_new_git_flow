import { aggregatePrivateChargers } from 'evio-library-chargers'

import { GetChargersParamsFilters } from '../service/getChargersParams.service'
import { buildFiltersMatch, buildLocationFilters } from './chargers.repository'
import {InfrastructureMap} from "./infrastrutures.respository";

export type ChargersByLocationsCountType = {
  _id: string,
  count: number,
}

export async function countChargersByLocations(userId: string): Promise<Array<ChargersByLocationsCountType>> {
  const pipeline = [
    { $match: { createUser: userId } },
    { $group: { _id: '$infrastructure', count: { $sum: 1 } } }
  ]

  return await aggregatePrivateChargers(pipeline)
}

export async function countFilteredChargersByLocations(
    userId: string,
    filters: GetChargersParamsFilters,
    locations: string[] | undefined,
    infrastructures: InfrastructureMap
): Promise<Array<ChargersByLocationsCountType>> {
  const baseMatch = {
    createUser: userId,
    ...buildFiltersMatch(filters),
  }

  if (locations?.length) {
    Object.assign(baseMatch, buildLocationFilters(locations, infrastructures));
  }

  const pipeline = [
    { $match: baseMatch },
    { $group: { _id: '$infrastructure', count: { $sum: 1 } } }
  ]

  return await aggregatePrivateChargers(pipeline)
}
