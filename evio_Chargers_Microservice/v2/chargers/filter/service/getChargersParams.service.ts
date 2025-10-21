import { Request } from 'express'
import { GetChargersParamsSortSortType, GetChargersParamsSortOrderType } from '../middlewares/getChargersParamsSort.middleware'
import { isActive } from '../types/activeInactive.type'

export type GetChargersParamsPaginationType = {
  skip: number,
  limit: number,
}

export type GetChargersParamsSortType = {
  sort: GetChargersParamsSortSortType,
  order: GetChargersParamsSortOrderType,
}

export type GetChargersParamsFilters = {
  infrastructure?: string,
  accessType?: string,
  status?: string,
  active?: boolean,
  'plugs.subStatus'?: string,
}

export type GetChargersParamsType = {
  pagination: GetChargersParamsPaginationType,
  sort: GetChargersParamsSortType,
  filters: GetChargersParamsFilters,
  inputText?: string,
  locations?: string[],
  isOnlyLocationFiltered: boolean,
  isOnlyFiltersFiltered: boolean,
  rawSort?: string;
}

const isValueNotUndefined = (filters: GetChargersParamsFilters) => (key: string) => {
  const value = filters[key]
  return typeof value !== 'undefined'
}

export function getChargersParamsFromQuery(params: Request['query']): GetChargersParamsType {
  const pagination = {
    skip: parseInt(params['_skip'] as string),
    limit: parseInt(params['_limit'] as string),
  }

  const sort = {
    sort: params['_sort'] as GetChargersParamsSortSortType,
    order: parseInt(String(params['_order'])) as GetChargersParamsSortOrderType,
  }

  const filters: GetChargersParamsFilters = {
    infrastructure: params['location'] as string | undefined,
    accessType: params['accessibility'] as string | undefined,
    status: params['chargerStatus'] as string | undefined,
    active: isActive(params['state'] as string | undefined),
    'plugs.subStatus': params['connectorStatus'] as string | undefined,
  }

  const inputText = params['inputText'] as string | undefined

  const locations = (Array.isArray(params['locations']) ? params['locations'] : [params['locations']])
      .filter((v): v is string => typeof v === 'string')

  const isOnlyLocationFiltered = locations.length > 0 && !Object.keys(filters).filter(isValueNotUndefined(filters)).length
  const isOnlyFiltersFiltered = locations.length === 0 && !inputText && Object.keys(filters).filter(isValueNotUndefined(filters)).length > 0

  return {
    pagination,
    sort,
    filters,
    inputText,
    locations,
    isOnlyLocationFiltered,
    isOnlyFiltersFiltered,
    rawSort: Array.isArray(params['sort']) ? String(params['sort'][0]) : String(params['sort'] || '')
  }
}
