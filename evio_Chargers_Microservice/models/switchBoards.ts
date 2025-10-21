import { Schema, model } from 'mongoose';
// Interfaces
import { ISwitchBoardsDocument, ISwitchBoardModel } from '../interfaces/switchBoardsInterfaces';
// Enums
import { CHARGING_MODES, SHARING_MODES } from '../utils/enums/switchboardsEnums';

const switchBoardsSchema = new Schema<ISwitchBoardsDocument>(
    {
        name: { type: String }, // Name user gave to the SwitchBoard
        controllerId: { type: String }, // Id of controller
        arrayChargersId: { type: [String] }, // Array of chargerIds that are associated to this Switchboard
        setSharingMode: { type: String }, // Value set by backend for sharing Mode - FIFO, Evenly Split
        setChargingMode: { type: String }, // Value set by backend for ChargingMode  - Solar Mode, Schedule Mode, Base Mode
        setALimit: { type: Number }, // Value set by backend for Limit Current in switchBoard
        setMinSolarCurrent: { type: Number }, // Minimum power available to the SWB when solar mode is activated
        sharingMode: { type: SHARING_MODES }, // Sharing Mode active in the switchboard - FIFO, Evenly Split
        chargingMode: { type: CHARGING_MODES }, // ChargingMode active in the switchboard -Solar Mode, Schedule Mode, Base Mode
        currentLimit: { type: Number }, // Current Limit active limit on the switchBoard
        operationalMargin: { type: Number }, // Operational margin in the group (Imax group- Imax actual) (A)
        powerSetPointByEV: { type: Number }, // Current setpoint to be divided by the EV chargers available (Kw)
        voltage: { type: Number }, // average Tension    (V)
        v1: { type: Number }, // Tension on phase 1 (V)
        v2: { type: Number }, // Tension on phase 2 (V)
        v3: { type: Number }, // Tension on phase 3 (V)
        i1: { type: Number }, // Current on phase 1 (A)
        i2: { type: Number }, // Current on phase 2 (A)
        i3: { type: Number }, // Current on phase 3 (A)
        powerActive: { type: Number }, // Power Active on switchBoard (w)
        importPower: { type: Number }, // Import Power on switchBoard (W)
        exportPower: { type: Number }, // Export Power on switchBoard (W)
        exportPowerLim: { type: Number }, // Export Power Limit on switchBoard (W)
        importPowerLim: { type: Number }, // Import Power Limit on switchBoard (W)
        importEnergy: { type: Number }, // Energy being imported to the switchboard (wh)
        exportEnergy: { type: Number }, // Energy being exported to the switchboard (wh)
        communicationFail: { type: Boolean }, // flag for fail Comms with switchboard
        circuitBreaker: { type: Boolean }, // flag for circuit Fail
        activeSessions: { type: Number }, // Number of active charging sessions on this electrical group
        electricalGroup: { type: Number },
        maxAllowedCurrent: { type: Number }, // Maximum power for the CB to trip
        locationId: { type: String }, // ID of the location this switch belongs
        createUserId: { type: String }, // Id of User that created the switchBoard
        allowChargingModes: { type: [String], enum: CHARGING_MODES }, // An array with all possible charging modes for this switchboard (Solar Mode, Base Mode, Unknown Mode, No Mode)
        meterType: { type: String }, // type of the switchboard meter
        meterDescription: { type: String }, // extra description from the meter
        dpc: { type: String }, // DPC (CPE) of the switchboard
        parentSwitchBoard: { type: String }, // parentSwitchBoard of the switchboard if this switchboard is electrically connected to another switchboard
        switchBoardGroupId: { type: String }, // only used by the for A8000 to identify chargers to switchboard
        minSolarCurrent: { type: Number }, // Minimum power available to the SWB when solar mode is activated
        deviceId: { type: String }, // Device ID of the switchboard,
        allowSharingModes: { type: [String], enum: SHARING_MODES }, // An array with all possible charging modes for this switchboard (Solar Mode, Base Mode, Unknown Mode, No Mode)
    },
    {
        timestamps: true,
    }
);
switchBoardsSchema.index({ controllerId: 1 });
switchBoardsSchema.index({ locationId: 1 });
switchBoardsSchema.index({ parentSwitchBoard: 1 });
switchBoardsSchema.index({ switchBoardGroupId: 1, controllerId: 1 });

switchBoardsSchema.statics.unsetLocationIds = async function (arrayOfSwitchToRemove: string[]): Promise<{ status: boolean }> {
    const query = { _id: { $in: arrayOfSwitchToRemove } };
    await this.updateMany(query, { $unset: { locationId: '' } });
    return { status: true };
};

switchBoardsSchema.statics.getByGroupId = async function (switchBoardGroupId: string, controllerId: string): Promise<ISwitchBoardsDocument | null> {
    return this.findOne({ switchBoardGroupId, controllerId });
};

switchBoardsSchema.statics.updateSwitchBoardById = async function (
    id: string,
    updateObject: Partial<ISwitchBoardsDocument>
): Promise<ISwitchBoardsDocument> {
    return this.findOneAndUpdate({ _id: id }, { $set: updateObject }, { new: true });
};

const SwitchBoard = (module.exports = model<ISwitchBoardsDocument, ISwitchBoardModel>('switchBoards', switchBoardsSchema));
export default module.exports = SwitchBoard;
