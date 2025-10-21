export type ChargerItemPlug = {
  plugId: string
  plugNumber: number
  qrCode?: string
  status: string
  connectorStatus: string
  duration?: string
}

export type ChargerDtoDataType = {
  chargerItem: {
    _id: string,
    chargerId: string
    chargerName: string
    location?: string
    state: string
    accessibility: string
    status: string;
    chargerType?: string;
    operationalStatus?: string;
  }
  plugs: Array<ChargerItemPlug>
}

export type ChargerDtoTotalFiltersLocation = {
  name: string;
  totalChargersPerLocation: number;
}

export type ChargerDtoTotalFiltersValue = {
  value: string; // value of filter applied
  total: number; // total chargers for this filter value
}

export type ChargerDtoTotalFilters = {
  title: string; // name of filter applied
  values: Array<ChargerDtoTotalFiltersValue>
}

export type ChargerDtoType = {
  totalChargers: number; // total filtered chargers before pagination db
  totalChargersPerPage: number; // pageNumber
  totalPlugs: number; // total plugs among all filtered chargers before pagination db
  totalPlugsPerPage: number; // total plugs among all filtered chargers after pagination
  totalFiltersLocation: Array<ChargerDtoTotalFiltersLocation>,
  totalFilters: Array<ChargerDtoTotalFilters>,
  data: Array<ChargerDtoDataType>
};
