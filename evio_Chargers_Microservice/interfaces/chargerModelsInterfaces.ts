import { Document, Model } from 'mongoose';
import { TEST_STATUS } from '../utils/enums/chargerModelsEnums';

export interface IListProtocols {
    protocol: string;
    protocolVersion: string;
    core: TEST_STATUS;
    remoteUnlock: TEST_STATUS;
    lockDetection: TEST_STATUS;
    remoteFirmwareUpdate: TEST_STATUS;
    autoCharge: TEST_STATUS;
    plugAndCharge: TEST_STATUS;
    remoteEnergyManagement: TEST_STATUS;
    localEnergyManagement: TEST_STATUS;
    confluenceLink: string;
    firmwareVersion: string;
    testDate: Date;
}
export interface IChargerModelsDocument extends Document {
    manufacturer: string;
    modelName: string;
    listProtocol: IListProtocols[];
    image: string;
    active: boolean;
}

export interface IChargerModelsCreateRequest extends Omit<IListProtocols, 'testDate'> {
    manufacturer: string;
    modelName: string;
    active: boolean;
    testDate: string,
    image?: string;
}

export interface IChargerModelsGroupByBrand {
    manufacturer: string;
    models: string[];
}

export interface IChargerModelsUpdateRequest {
    manufacturer?: string;
    modelName?: string;
    listProtocol?: IListProtocols[];
    active?: boolean;
}

export interface IChargerModel extends Model<IChargerModelsDocument> {
    findModel: (manufacturer: string, modelName: string) => Promise<IChargerModelsDocument | null>;
    findByIdModel: ( _id: string )=> Promise<IChargerModelsDocument | null>;
    createNewModel: (chargerModel: IChargerModelsCreateRequest) => Promise<IChargerModelsDocument>;
    getModelsGroupByBrand: () => Promise<IChargerModelsGroupByBrand>;
    updateChargerModel: (_id:string, chargerModel: IChargerModelsUpdateRequest) => Promise<IChargerModelsDocument>;
}

export default IListProtocols;
