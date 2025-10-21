import { Schema, Types, model } from 'mongoose';
import { DBControllerInterface, IEquipmentDB, IMeasurementsDB, IChargingModeInterfaceDB } from '../interfaces/controllersInterfaces';

const measurements = new Schema<IMeasurementsDB>({
    measurementId: { type: String },
    name: { type: String },
    description: { type: String },
    unit: { type: String },
    valueType: { type: String },
});

const equipmentSchema = new Schema<IEquipmentDB>(
    {
        name: { type: String },
        deviceDescription: { type: String },
        deviceId: { type: String },
        protocol: { type: String },
        deviceType: { type: String },
        listMeasurementsTypes: { type: [measurements] },
    },
    {
        timestamps: true,
    }
);

const chargingModeSchema = new Schema<IChargingModeInterfaceDB>({
    id: { type: Types.ObjectId, index: true },
    name: { type: String },
    mode: { type: String }, // Charging mode ( Solar_Mode Base_Mode Unknown_Mode )
    active: { type: Boolean },
    strategyId: { type: String },
});

const controllerSchema = new Schema<DBControllerInterface>(
    {
        controllerId: { type: Types.ObjectId, index: true }, // id of controller id in Comms microservice
        deviceId: { type: String },
        name: { type: String },
        protocol: { type: String }, // protocol used to communicate (ex: MQTT or OPC-UA)
        model: { type: String }, // model of the controller (ex: smartBox_v1, Siemens A8000)
        devices: { type: [equipmentSchema] }, // array of all devices controlled by this controller
        listChargingModes: { type: [chargingModeSchema] },
    },
    {
        timestamps: true,
    }
);

controllerSchema.index({ controllerId: 1, deviceId: 1, protocol: 1 });

const Controllers = model<DBControllerInterface>('controllers', controllerSchema);

export default module.exports = Controllers;
