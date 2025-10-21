import { GetChargersParamsType } from './getChargersParams.service'
import { buildChargerDtoData, buildTotalFiltersLocation } from './chargerDto.service'
import { ChargerDtoType } from '../types/chargerDto'
import { getChargersFromDb } from '../repository/chargers.repository'
import { getInfrastructures } from '../repository/infrastrutures.respository'
import { countChargersByLocations, countFilteredChargersByLocations } from '../repository/totalFiltersLocations.repository'
import { countChargersByFilters, countChargersAndPlugsByUserId, countChargersAndPlugsWithFilters } from '../repository/totals.repository'

function buildTotals(chargers: any[]) {
  return {
    totalChargersPerPage: chargers.length,
    totalPlugsPerPage: chargers.reduce((sum, charger) => sum + charger.plugs.length, 0),
  }
}

async function getChargersCountByLocation(
    userId: string,
    params: GetChargersParamsType,
    infrastructures: Record<string, string>
) {
  if (params.isOnlyFiltersFiltered) {
    return await countFilteredChargersByLocations(userId, params.filters, params.locations, infrastructures)
  } else {
    return await countChargersByLocations(userId)
  }
}

export async function getChargers(userId: string, params: GetChargersParamsType): Promise<ChargerDtoType> {
  const infrastructures = await getInfrastructures(userId);

  const hasAnyFilter =
      params.inputText ||
      params.locations?.length ||
      Object.values(params.filters).some((v) => v !== undefined);

  const countTotalsPromise = hasAnyFilter
      ? countChargersAndPlugsWithFilters(userId, params, infrastructures)
      : countChargersAndPlugsByUserId(userId);

  const [
    chargers,
    chargersCountByLocation,
    filteredTotals,
    fullTotals,
    { totalChargers, totalPlugs },
  ] = await Promise.all([
    getChargersFromDb(userId, params, infrastructures),
    getChargersCountByLocation(userId, params, infrastructures),
    countChargersByFilters(userId, params, infrastructures),
    countChargersByFilters(userId, { ...params, filters: {}, inputText: undefined }, infrastructures),
    countTotalsPromise,
  ]);

  const sortedChargers = chargers.sort((a, b) => {
    if (params.rawSort === 'location') {
      const normalize = (val: string) => val.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
      const locA = normalize(infrastructures[a.infrastructure || ''] || '');
      const locB = normalize(infrastructures[b.infrastructure || ''] || '');
      return params.sort.order === 1 ? locA.localeCompare(locB) : locB.localeCompare(locA);
    } else {
      const valA = (a as any)[params.sort.sort];
      const valB = (b as any)[params.sort.sort];

      if (typeof valA === 'string' && typeof valB === 'string') {
        return params.sort.order === 1
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
      } else {
        return params.sort.order === 1
            ? (valA ?? '').toString().localeCompare((valB ?? '').toString())
            : (valB ?? '').toString().localeCompare((valA ?? '').toString());
      }
    }
  });


  const paginatedChargers = sortedChargers.slice(
      params.pagination.skip,
      params.pagination.skip + params.pagination.limit
  );
  const data = buildChargerDtoData(paginatedChargers, infrastructures);

  const { totalChargersPerPage, totalPlugsPerPage } = buildTotals(paginatedChargers);

  let totalFilters = fullTotals;
  let totalFiltersLocation = buildTotalFiltersLocation(chargersCountByLocation, infrastructures);

  if (params.inputText) {
    totalFilters = fullTotals;
  } else if (params.isOnlyLocationFiltered) {
    totalFilters = await countChargersByFilters(userId, {
      ...params,
      filters: {},
      inputText: undefined,
    }, infrastructures);
  } else if (params.isOnlyFiltersFiltered) {
    totalFilters = fullTotals;
    const filteredLocations = await countFilteredChargersByLocations(
        userId,
        params.filters,
        params.locations,
        infrastructures
    );
    totalFiltersLocation = buildTotalFiltersLocation(filteredLocations, infrastructures);
  } else if (totalFilters && totalFiltersLocation) {
    totalFilters = await countChargersByFilters(userId, {
      ...params,
      filters: {},
      inputText: undefined,
    }, infrastructures);
    totalFiltersLocation = buildTotalFiltersLocation(chargersCountByLocation, infrastructures);
  } else {
    totalFilters = fullTotals;
  }

  return {
    totalChargers,
    totalChargersPerPage,
    totalPlugs,
    totalPlugsPerPage,
    totalFiltersLocation,
    totalFilters,
    data,
  };
}

