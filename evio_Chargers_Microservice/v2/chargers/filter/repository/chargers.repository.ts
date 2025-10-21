import { aggregatePrivateChargers } from 'evio-library-chargers'
import { GetChargersParamsType, GetChargersParamsFilters } from '../service/getChargersParams.service';
import { InfrastructureMap } from './infrastrutures.respository'

export type ProjectedChargerPlug = {
  plugId: string;
  qrCodeId?: string;
  status: string;
  subStatus: string;
  statusChangeDate?: Date;
}

export type ProjectedCharger = {
  _id: string;
  hwId: string;
  name: string;
  infrastructure?: string;
  active: boolean;
  accessType: string;
  status: string;
  plugs: Array<ProjectedChargerPlug>;
  chargerType?: string;
  operationalStatus: string;
}

const projection = {
  _id: 1,
  hwId: 1,
  name: 1,
  infrastructure: 1,
  active: 1,
  accessType: 1,
  status: 1,
  chargerType: 1,
  operationalStatus: 1,
  plugs: {
    plugId: 1,
    qrCodeId: 1,
    status: 1,
    subStatus: 1,
    statusChangeDate: 1,
  },
}

function buildInputTextStep(userId: string, inputText: string) {
  const regex = RegExp(inputText.trim(), 'i')
  return {
    $match: {
      createUser: userId,
      $or: [
        { hwId: regex },
        { name: regex },
        { 'plugs.qrCodeId': regex },
        { cpe: regex },
      ]
    }
  }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildFiltersMatch(filters: GetChargersParamsFilters) {
  const match: any = {};

  if (filters.infrastructure) {
    match['infrastructure'] = filters.infrastructure;
  }

  if (filters.accessType) {
    match['accessType'] = Array.isArray(filters.accessType)
        ? { $in: filters.accessType }
        : { $regex: `^${escapeRegExp(filters.accessType.trim())}$`, $options: 'i' };
  }

  if (filters.status) {
    match['status'] = Array.isArray(filters.status)
        ? { $in: filters.status }
        : { $regex: `^${escapeRegExp(filters.status.trim())}$`, $options: 'i' };
  }

  if (typeof filters.active === 'boolean') {
    match['active'] = filters.active;
  }

  if (filters['plugs.subStatus']) {
    match['plugs.subStatus'] = Array.isArray(filters['plugs.subStatus'])
        ? { $in: filters['plugs.subStatus'] }
        : { $regex: `^${escapeRegExp(filters['plugs.subStatus'].trim())}$`, $options: 'i' };
  }

  return match;
}

export function buildLocationFilters(locations: string[], infrastructures: InfrastructureMap) {
  const infraIds = Object.entries(infrastructures)
      .filter(([, name]) => locations.includes(name))
      .map(([id]) => id)

  return infraIds.length ? { infrastructure: { $in: infraIds } } : {}
}

function buildFilterStep(userId: string, params: GetChargersParamsType, infrastructures: InfrastructureMap) {
  if (params.inputText) {
    return buildInputTextStep(userId, params.inputText)
  }

  const baseFilters: any = { createUser: userId, ...buildFiltersMatch(params.filters) }

  if (params.locations?.length) {
    Object.assign(baseFilters, buildLocationFilters(params.locations, infrastructures))
  }

  return { $match: baseFilters }
}

export async function getChargersFromDb(userId: string, params: GetChargersParamsType, infrastructures: InfrastructureMap): Promise<Array<ProjectedCharger>> {
  const aggregationPipeline = [
    buildFilterStep(userId, params, infrastructures),
    { $sort: { [params.sort.sort]: params.sort.order, _id: params.sort.order } },
    { $project: projection },
  ];
  return await aggregatePrivateChargers(aggregationPipeline);
}
