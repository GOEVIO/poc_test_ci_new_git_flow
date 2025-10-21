export interface ChargersFilters {
    locations?: string[];
    chargers?: string[];
    state?: string[];
    accessibility?: string[];
    chargerStatus?: string[];
    connectorStatus?: string[];
}

export interface ChargersFiltersConditions {
    location?: object | string;
    chargerId?: object | string;
    state?: object | string;
    accessType?: object | string;
    status?: object | string;
    'plugs.status'?: object | string;
    hwId?: object | string;
    name?: object | string;
    'plugs.qrCodeId'?: object | string;
    cpe?: object | string;
    active?: boolean;
}

export interface ChargersFiltersResponse {
    $and?: ChargersFiltersConditions[];
    $or?: ChargersFiltersConditions[];
}

export interface GetChargersFiltersConditions {
    $and: (ChargersFiltersResponse | { createUser: string;})[];
}

export interface GetChargersInput extends ChargersFilters {
    page?: number;
    limit?: number;
    sort?: string;
    order?: string;
    userId: string;
    inputText?: string;
}

export interface CustomizationData {
    icons?: {
        qrcodeIcon?: string[];
    };
}
export interface ConnectorUpdate {
    connectorId: string;
    evseId?: string;
    internalReference?: string;
    connectorType?: string;
    connectorFormat?: string;
    powerType?: string;
    power?: number;
    voltage?: number;
    current?: number;
    qrCodeId?: string;
    connectorStatus?: string;
    statusTime?: Date | string;
}
