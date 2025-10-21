import { Schema, model } from 'mongoose';
// Interface
import { ILocationDocument, ILocationModel } from '../interfaces/locationInterfaces';
// Enums
import { CONTROLLER_INTERFACE } from '../utils/enums/controllersEnums';

const locationSchema = new Schema<ILocationDocument>(
    {
        name: { type: String },
        listOfSwitchboardsIds: [{ type: String }], // array of switchBoards that belong to this location
        controllerId: { type: String }, // id of controller connected to this location
        pvID: { type: String }, // id of the solar indorsor connected to this location
        createUserId: { type: String },
        energyManagementEnable: { type: Boolean, default: false }, // flag to indicate if this location has energy management
        energyManagementInterface: { type: CONTROLLER_INTERFACE }, // communication protocol used by the energy management system to communicate
        online: { type: Boolean, default: false }, // state of the connection to the controller ID
        onlineStatusChangedDate: { type: Date }, // date of the changed of online status
    },
    {
        timestamps: true,
    }
);
locationSchema.index({ controllerId: 1 });
locationSchema.index({ createUserId: 1 });

locationSchema.statics.getLocationByNameOrId = async function (createUserId: string, name: string | null, _id: string | null) {
    const query = name ? { name, createUserId } : { _id, createUserId };
    return this.findOne(query);
};
const Locations = (module.exports = model<ILocationDocument, ILocationModel>('locations', locationSchema));

export default module.exports = Locations;
