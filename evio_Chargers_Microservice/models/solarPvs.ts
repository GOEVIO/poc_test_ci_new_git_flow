import { Schema, Types, model } from 'mongoose';
// Interface
import { ISolarPvModelDocument, IPvModel } from '../interfaces/solarPvInterfaces';

const solarPvsSchema = new Schema<ISolarPvModelDocument>(
    {
        name: { type: String },
        deviceId: { type: String },
        description: { type: String }, // extra description to give more feedBack about the Solar PV
        lastReading: { type: Date }, // date of last reading measurement
        controllerDeviceId: { type: String }, // device ID of the controller
        powerProduction: { type: Number }, // PV power production.
        locationID: { type: String }, // Id of location that this PV belongs to
        switchBoardId: { type: String }, // Id of Switchboard that belongs to
        controllerId: { type: String }, // Id of controller that belongs to
        createdBy: { type: String }, // Id of user
        exportEnergyActive: { type: Number }, // Export Energy Active
        exportPowerActive: { type: Number }, // Export Power Active
        importPowerActive: { type: Number }, // Import Power Active
    },
    {
        timestamps: true,
    }
);
solarPvsSchema.index({ deviceId: 1 }, { background: true });
solarPvsSchema.index({ controllerDeviceId: 1 }, { background: true });
solarPvsSchema.index({ locationID: 1 }, { background: true });
solarPvsSchema.index({ deviceId: 1, _id: 1 }, { background: true });

solarPvsSchema.statics.getPvByHwId = async function (deviceId: string, createdBy: string): Promise<ISolarPvModelDocument | null> {
    return this.findOne({ deviceId, createdBy });
};

solarPvsSchema.statics.getPV = async function (createdBy: string, _id?: string): Promise<ISolarPvModelDocument[]> {
    let query: { createdBy: string; _id?: string } = { createdBy };
    if (_id) {
        query = { createdBy, _id };
    }
    return this.find(query).sort({ name: 1 });
};
const PvSolar = (module.exports = model<ISolarPvModelDocument, IPvModel>('solarPvs', solarPvsSchema));

export default module.exports = PvSolar;
