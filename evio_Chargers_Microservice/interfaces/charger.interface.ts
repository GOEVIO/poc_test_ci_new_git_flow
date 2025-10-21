interface IDiagnostic {
    type?: string;
    result?: string;
    date?: Date;
}

interface IFile {
    fileName?: string;
    fileType?: string;
    fileUrl?: string;
}

interface INetwork {
    name?: string;
    code?: string;
    url?: string;
}
interface IPurchaseTariff {
    energyFee?: number;
    timeFee?: number;
    transactionFee?: number;
    currency?: string;
}

export interface IPlugTariffs {
  currency?: string;
  type?: "REGULAR" | "AD_HOC_PAYMENT";
  elements?: {
    _id?: string;
    price_components?: {
      _id?: string;
      type?: string;
      price?: number;
      step_size?: number;
      vat?: number;
    }[];
    restrictions?: {
      day_of_week?: string[];
      min_duration?: number;
      start_time?: string;
      end_time?: string
      start_date?: string
      end_date?: string
      min_kwh?: number
      max_kwh?: number
      min_current?: number
      max_current?: number
      min_power?: number
      max_power?: number
      max_duration?: number
      reservation?: "RESERVATION" | "RESERVATION_EXPIRES";
    };
  }[];
}

export interface IPlug {
  plugId: string;
  uid: string;
  evse_id: string;
  connectorFormat?: string;
  connectorPowerType?: string;
  connectorType?: string;
  voltage: number;
  amperage?: number;
  power: number;
  status: string;
  subStatus: string;
  hasRemoteCapabilities?: boolean;
  capabilities?: string[];
  statusSchedule?: any[];
  directions?: any[];
  parkingRestrictions?: any[];
  images?: any[];
  co2Emissions?: any | null;
  termsAndConditions?: any | null;
  lastUpdated?: string;
  statusChangeDate?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  tariffId?: string[];
  serviceCost?: {
    currency?: string;
    initialCost?: number;
    costByPower?: {
      cost?: number;
      uom?: string;
    };
    costByTime?: {
      _id?: string;
      minTime?: number;
      cost?: number;
      uom?: string;
    }[];
    elements?: {
      _id?: string;
      price_components?: {
        _id?: string;
        type?: string;
        price?: number;
        step_size?: number;
        vat?: number;
      }[];
    }[];
    tariffs: IPlugTariffs[];
  };
}
interface IAvailability {
    monday?: string[];
    tuesday?: string[];
    wednesday?: string[];
    thursday?: string[];
    friday?: string[];
    saturday?: string[];
    sunday?: string[];
}
interface IAddress {
    country: string;
    countryCode: string;
    city: string;
    state: string;
    street: string;
    number: string;
    zipcode: string;
    reference: string;
}


export interface ICharger {
    id: string;
    hwId: string;
    serialNumber?: string;
    endpoint?: string;
    meterValueSampleInterval?: string;
    chargePointSerialNumber?: string;
    firmwareVersion?: string;
    iccid?: string;
    imsi?: string;
    meterSerialNumber?: string;
    meterType?: string;
    vendor?: string;
    model?: string;
    name?: string;
    parkingType?: string;
    vehiclesType?: { vehicle?: string }[];
    timeZone?: string;
    address: IAddress;
    facilitiesTypes?: any[];
    geometry: {
        type: string;
        coordinates: number[];
    };
    instantBooking?: boolean;
    availability?: IAvailability;
    plugs?: IPlug[];
    accessType?: string;
    listOfGroups?: {
        groupName?: string;
        groupId?: string;
    }[];
    active?: boolean;
    rating?: number;
    numberOfSessions?: number;
    chargerType?: string;
    status?: string;
    substatus?: string;
    operationalStatus?: string;
    netStatus?: boolean;
    infrastructure?: string;
    hasInfrastructure?: boolean;
    chargingDistance?: string;
    imageContent?: string[];
    defaultImage?: string;
    createUser?: string;
    createdBy?: string;
    operatorId?: string;
    modifyUser?: string;
    infoPoints?: string;
    heartBeat?: Date;
    heartBeatInterval?: number;
    bookings?: any[];
    requireConfirmation?: boolean;
    allowRFID?: boolean;
    wifiPairingName?: string;
    parkingSessionAfterChargingSession?: boolean;
    network?: string;
    partyId?: string;
    operator?: string;
    stationIdentifier?: string;
    manufacturer?: string;
    listOfFleets?: {
        fleetName?: string;
        fleetId?: string;
    }[];
    offlineNotification?: boolean;
    offlineEmailNotification?: string;
    mapVisibility?: boolean;
    wrongBehaviorStation?: boolean;
    purchaseTariff?: IPurchaseTariff;
    internalInfo?: string;
    CPE?: string;
    clientName?: string;
    networks?: INetwork[];
    voltageLevel?: string;
    locationType?: string;
    energyOwner?: string;
    CSE?: string;
    energyNotes?: string;
    supplyDate?: string;
    installationDate?: string;
    goLiveDate?: string;
    warranty?: string;
    expiration?: string;
    preCheck?: string;
    generateAction?: string;
    acquisitionNotes?: string;
    expectedLife?: string;
    MTBF?: string;
    workedHours?: string;
    lifeCycleStatus?: string;
    notify?: string;
    lifeCycleNotes?: string;
    siteLicense?: string;
    legalLicenseDate?: string;
    legalLicenseExpiry?: string;
    legalSiteReminder?: string;
    legalSiteNotes?: string;
    inspection?: string;
    lastInspection?: string;
    nextInspection?: string;
    legalInspectionReminder?: string;
    legalInspectionNotes?: string;
    connectionType?: string;
    connectionOperator?: string;
    connectionAPN?: string;
    connectionLastLocationUpdate?: string;
    connectionIpAddress?: string;
    connectionDeviceId?: string;
    connectionIMEILock?: string;
    connectionIMEINumber?: string;
    connectionDataComunicationChart?: string;
    connectionStatus?: string;
    connectionBlockedOperators?: string;
    connectionConnectedNetwork?: string;
    connectionTAGs?: string;
    connectionIMSI?: string;
    connectionMSISDN?: string;
    connectionICCID?: string;
    connectionStats?: string;
    connectionDataTotal?: string;
    connectivity?: string;
    files?: File[];
    diagnostics?: IDiagnostic[];
    energyManagementEnable?: boolean;
    energyManagementInterface?: string;
    switchBoardId?: string;
    controllerId?: string;
    originalCoordinates?: {
        type?: string;
        coordinates?: number[];
    };
    updatedCoordinates?: {
        date?: Date;
        source?: 'algorithm' | 'user' | 'evio';
    };
    createdAt: Date;
    updatedAt: Date;
}
