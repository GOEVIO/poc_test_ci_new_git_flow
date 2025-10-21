import { Schema, model } from 'mongoose';
// Interface
import { IUpdateInfo, IControllerDocument, IControllerModel, ICreateNewController } from '../interfaces/controllersInterfaces';
// Enums
import { CONTROLLER_MODEL, CONTROLLER_INTERFACE } from '../utils/enums/controllersEnums';

const updateInfoSchema = new Schema<IUpdateInfo>({
    serial: { type: String }, // device serial Number
    localIp: { type: String }, // device local ip
    osVersion: { type: String }, // device OS version that is running
    softwareVersion: { type: String }, // Software version of device
    hwVersion: { type: String }, // Hardware revision of device
    generalAlarm: { type: Boolean, default: false }, // General alarm
    commAlarm: { type: Boolean, default: false }, // communication alarm
});

const controllerSchema = new Schema<IControllerDocument>(
    {
        interface: { type: CONTROLLER_INTERFACE }, // type of interface of this controller (MQTT , etc)
        name: { type: String }, // extra info about the controller
        generalAlarm: { type: Boolean, default: false }, // General alarm
        communicationFaultAlarm: { type: Boolean, default: false }, // Alarm of communication fail
        model: { type: CONTROLLER_MODEL }, // model of the controller ( ex: A8000 )
        connectionURL: { type: String }, // URL to connect to this OPC-UA server (ex: opc.tcp://localhost:3060 )
        active: { type: Boolean, default: true }, // flag to indicate if this controller should be connected by the back-end (OPCUA implementation)
        locationId: { type: String },
        createUserId: { type: String },
        deviceId: { type: String }, // this variable is a string of something that will identify the controller in the communication process
        updateInfo: { type: updateInfoSchema },
    },
    {
        timestamps: true,
    }
);
controllerSchema.index({ interface: 1 }, { background: true });
controllerSchema.index({ name: 1 }, { background: true });
controllerSchema.index({ active: 1 }, { background: true });
controllerSchema.index({ active: 1, interface: 1 }, { background: true });

controllerSchema.statics.createAndSave = async function (controller: ICreateNewController): Promise<IControllerDocument> {
    const newController = new this(controller);
    return newController.save();
};

controllerSchema.statics.unsetLocationId = async function (controllerId: string): Promise<{ status: boolean }> {
    const query = { _id: controllerId };
    await this.updateOne(query, { $unset: { locationId: '' } });
    return { status: true };
};

const Controller = (module.exports = model<IControllerDocument, IControllerModel>('controller', controllerSchema));

export default module.exports = Controller;
