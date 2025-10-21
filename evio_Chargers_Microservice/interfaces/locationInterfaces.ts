import { Document, Model } from 'mongoose';
// Enums
import { CONTROLLER_INTERFACE } from '../utils/enums/controllersEnums';

export interface ICreateLocationRequest {
    name: string;
    listOfSwitchboardsIds?: string[];
    energyManagementEnable?: boolean;
    energyManagementInterface?: string;
    equipmentModel?: string;
    deviceId: string;
}

export interface IUpdateLocationRequest extends Partial<ICreateLocationRequest> {
    
}
export interface ILocationDocument extends Document {
    name: string;
    listOfSwitchboardsIds: string[];
    controllerId?: string;
    pvID?: string;
    createUserId: string;
    energyManagementEnable: boolean;
    energyManagementInterface: CONTROLLER_INTERFACE;
    online: boolean;
    onlineStatusChangedDate?: Date;
}

export interface ILocationModel extends Model<ILocationDocument> {
    getLocationByNameOrId(userId: string, locationName: string | null, locationId: string | null): Promise<ILocationDocument>;
}
