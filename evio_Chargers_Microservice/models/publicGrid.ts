import { Schema, model } from 'mongoose';
// Interface
import { IPublicGridDocument, IPublicGridModel } from '../interfaces/publicGridInterfaces';

const publicGridSchema = new Schema<IPublicGridDocument>(
    {
        name: { type: String, required: true },
        deviceId: { type: String, required: true },
        locationId: { type: String },
        controllerId: { type: String },
        controllerDeviceId: { type: String },
        createUserId: { type: String, required: true },
        locationConsumption: { type: Number },
        currentLimit: { type: Number }, // used for A8000
        setCurrentLimit: { type: Number }, // used for A8000
        power: { type: Number },
        totalCurrent: { type: Number },
        i1: { type: Number },
        i2: { type: Number },
        i3: { type: Number },
        v1: { type: Number },
        v2: { type: Number },
        v3: { type: Number },
        totalVoltage: { type: Number },
        exportPower: { type: Number },
        importPower: { type: Number },
        measurementDate: { type: Date },
    },
    {
        timestamps: true,
    }
);

publicGridSchema.index({ deviceId: 1, controllerId: 1 }, { background: true });
publicGridSchema.index({ deviceId: 1, createUserId: 1 }, { background: true });

publicGridSchema.statics.getByControllerIdAndDeviceId = async function (controllerId: string, deviceId: string): Promise<IPublicGridDocument | null> {
    return this.findOne({ controllerId, deviceId });
};

publicGridSchema.statics.updatePublicGrid = async function (
    controllerId: string,
    deviceId: string,
    updateObject: Partial<IPublicGridDocument>
): Promise<{ n: number; nModified: number; ok: number }> {
    return this.updateOne({ controllerId, deviceId }, { $set: updateObject });
};

publicGridSchema.statics.updateOrCreateExternalAPI = async function (
    deviceId: string,
    updateObject: Partial<IPublicGridDocument>,
    createUserId: string
): Promise<boolean> {
    const update = await this.findOneAndUpdate({ deviceId, createUserId }, { $set: updateObject }, { new: true });
    if (!update) {
        const newPublicGrid = new this(updateObject);
        await newPublicGrid.save();
    }
    return true;
};

const publicGrid = (module.exports = model<IPublicGridDocument, IPublicGridModel>('publicGridMeters', publicGridSchema));

export default module.exports = publicGrid;
