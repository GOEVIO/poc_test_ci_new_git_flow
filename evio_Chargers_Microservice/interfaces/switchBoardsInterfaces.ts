import { Document, Model } from 'mongoose';
// Enums
import { CHARGING_MODES, SHARING_MODES } from '../utils/enums/switchboardsEnums';

export interface ISwitchBoardsDocument extends Document {
    name: string;
    controllerId: string;
    arrayChargersId: string[];
    setSharingMode?: SHARING_MODES;
    setChargingMode?: CHARGING_MODES;
    setALimit?: number;
    setMinSolarCurrent?: number;
    chargingMode?: CHARGING_MODES;
    currentLimit?: number;
    operationalMargin?: number;
    powerSetPointByEV?: number;
    voltage?: number;
    v1?: number;
    v2?: number;
    v3?: number;
    i1?: number;
    i2?: number;
    i3?: number;
    powerActive?: number;
    importPower?: number;
    exportPower?: number;
    exportPowerLim?: number;
    importPowerLim?: number;
    importEnergy?: number;
    exportEnergy?: number;
    communicationFail?: boolean;
    circuitBreaker?: boolean;
    activeSessions?: number;
    electricalGroup?: number;
    maxAllowedCurrent?: number;
    locationId: string;
    createUserId: string;
    allowChargingModes: CHARGING_MODES[];
    meterType: string;
    meterDescription: string;
    dpc?: string; // DPC (CPE) of the switchboard
    parentSwitchBoard: string;
    switchBoardGroupId?: string;
    minSolarCurrent?: number;
    sharingMode?: SHARING_MODES;
    allowSharingModes: SHARING_MODES[];
    deviceId: string;
}

export interface ISwitchBoardModel extends Model<ISwitchBoardsDocument> {
    unsetLocationIds(arrayOfSwitchToRemove: string[]): Promise<{ status: boolean }>;
    getByGroupId(switchBoardGroupId: string, controllerId: string): Promise<ISwitchBoardsDocument | null>;
    updateSwitchBoardById(id: string, updateObject: Partial<ISwitchBoardsDocument>): Promise<ISwitchBoardsDocument>;
}
