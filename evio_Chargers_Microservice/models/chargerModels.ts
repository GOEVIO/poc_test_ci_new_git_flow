import { Schema, Types, model } from 'mongoose';
// Interfaces
import {
    IListProtocols,
    IChargerModelsDocument,
    IChargerModelsCreateRequest,
    IChargerModel,
    IChargerModelsGroupByBrand,
    IChargerModelsUpdateRequest,
} from '../interfaces/chargerModelsInterfaces';
// Enums
import { TEST_STATUS } from '../utils/enums/chargerModelsEnums';

const listProtocols = new Schema<IListProtocols>({
    protocol: { type: String },
    protocolVersion: { type: String },
    core: { type: TEST_STATUS },
    remoteUnlock: { type: TEST_STATUS },
    lockDetection: { type: TEST_STATUS },
    remoteFirmwareUpdate: { type: TEST_STATUS },
    autoCharge: { type: TEST_STATUS },
    plugAndCharge: { type: TEST_STATUS },
    remoteEnergyManagement: { type: TEST_STATUS },
    localEnergyManagement: { type: TEST_STATUS },
    confluenceLink: { type: String },
    firmwareVersion: { type: String },
    testDate: { type: Date },
});

const ChargerModelsSchema = new Schema<IChargerModelsDocument>(
    {
        manufacturer: { type: String },
        modelName: { type: String },
        listProtocol: { type: [listProtocols] },
        image: { type: String },
        active: { type: Boolean },
    },
    {
        timestamps: true,
    }
);
ChargerModelsSchema.index({ modelName: 1 });
ChargerModelsSchema.index({ manufacturer: 1 });
ChargerModelsSchema.index({ manufacturer: 1, modelName: 1 });

ChargerModelsSchema.statics.findModel = async function (manufacturer: string, modelName: string): Promise<IChargerModelsDocument | null> {
    return this.findOne({ manufacturer, modelName });
};

ChargerModelsSchema.statics.findByIdModel = async function (_id: string): Promise<IChargerModelsDocument | null> {
    return this.findById( _id );
};

ChargerModelsSchema.statics.createNewModel = async function (chargerModel: IChargerModelsCreateRequest): Promise<IChargerModelsDocument> {
    const newChargerModel = new this({
        manufacturer: chargerModel.manufacturer,
        modelName: chargerModel.modelName,
        active: chargerModel.active,
        listProtocol: [
            {
                protocol: chargerModel.protocol,
                protocolVersion: chargerModel.protocolVersion,
                core: chargerModel.core,
                remoteUnlock: chargerModel.remoteUnlock,
                lockDetection: chargerModel.lockDetection,
                remoteFirmwareUpdate: chargerModel.remoteFirmwareUpdate,
                autoCharge: chargerModel.autoCharge,
                plugAndCharge: chargerModel.plugAndCharge,
                remoteEnergyManagement: chargerModel.remoteEnergyManagement,
                localEnergyManagement: chargerModel.localEnergyManagement,
                confluenceLink: chargerModel.confluenceLink,
                firmwareVersion: chargerModel.firmwareVersion,
                testDate: chargerModel.testDate,
            },
        ],
    });
    return newChargerModel.save();
};
ChargerModelsSchema.statics.getModelsGroupByBrand = async function (): Promise<IChargerModelsGroupByBrand[]> {
    return this.aggregate([
        {
            $match: { active: true },
        },
        {
            $group: {
                _id: '$manufacturer',
                models: { $push: '$modelName' },
            },
        },
        {
            $project: {
                _id: 0,
                manufacturer: '$_id',
                models: 1,
            },
        },
    ]);
};
ChargerModelsSchema.statics.updateChargerModel = async function(id: string, updateFields: IChargerModelsUpdateRequest): Promise<IChargerModelsDocument> {
    const filter = { _id: id };
    const update: any = {};

    if (updateFields.manufacturer) {
        update.manufacturer = updateFields.manufacturer;
    }
    if (updateFields.modelName) {
        update.modelName = updateFields.modelName;
    }

    if (updateFields.hasOwnProperty('active')) {
        update.active = updateFields.active;
    }

    if (updateFields.listProtocol && updateFields.listProtocol.length > 0) {
        const listProtocolUpdate = updateFields.listProtocol.map((protocol, index) => {
            return {
                [`listProtocol.${index}.protocol`]: protocol.protocol,
                [`listProtocol.${index}.protocolVersion`]: protocol.protocolVersion,
                [`listProtocol.${index}.core`]: protocol.core,
                [`listProtocol.${index}.remoteUnlock`]: protocol.remoteUnlock,
                [`listProtocol.${index}.lockDetection`]: protocol.lockDetection,
                [`listProtocol.${index}.remoteFirmwareUpdate`]: protocol.remoteFirmwareUpdate,
                [`listProtocol.${index}.autoCharge`]: protocol.autoCharge,
                [`listProtocol.${index}.plugAndCharge`]: protocol.plugAndCharge,
                [`listProtocol.${index}.remoteEnergyManagement`]: protocol.remoteEnergyManagement,
                [`listProtocol.${index}.localEnergyManagement`]: protocol.localEnergyManagement,
                [`listProtocol.${index}.confluenceLink`]: protocol.confluenceLink,
                [`listProtocol.${index}.firmwareVersion`]: protocol.firmwareVersion,
                [`listProtocol.${index}.testDate`]: protocol.testDate
            };
        });

        update.$set = Object.assign({}, ...listProtocolUpdate);
    }

    return this.findByIdAndUpdate(filter, update, { new: true });
};

const ChargerModels = model<IChargerModelsDocument, IChargerModel>('chargerModels_deprecated', ChargerModelsSchema);

export default module.exports = ChargerModels;
