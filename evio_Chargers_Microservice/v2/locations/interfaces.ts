export interface LocationsFilters {
    name?: string[];
    CPE?: string[];
    hwId?: string[];
    chargerName?: string[];
    qrCode?: string[];
}

export interface LocationsFiltersConditions {
    name?: object | string;
    CPE?: object | string;
    'listChargers.hwId'?: object | string;
    'listChargers.name'?: object | string;
    'listChargers.plugs.qrCodeId'?: object | string;
}

export interface LocationsFiltersResponse {
    $and?: LocationsFiltersConditions[];
    $or?: LocationsFiltersConditions[];
}

export interface GetLocationsFiltersConditions {
    $and: (LocationsFiltersResponse | { userId: string; })[];
}

export interface GetLocationsInput extends LocationsFilters {
    page?: number;
    limit?: number;
    sort?: string;
    order?: string;
    userId: string;
    inputText?: string;
}
