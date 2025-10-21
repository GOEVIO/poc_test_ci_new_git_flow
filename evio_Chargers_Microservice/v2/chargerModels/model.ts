import { Schema, model } from 'mongoose';

export interface IChargerModel {
    brand: string,
    manufacturer: string,
    models: [{
        model: string,
        versions: [{
            protocol: string,
            firmwareVersion: string,
            compatibility: string,
        }]
    }],
}

const ChargerModelSchema = new Schema<IChargerModel>(
    {
        brand: String,
        manufacturer: String,
        models: [{
            model: String,
            versions: [{
                protocol: String,
                firmwareVersion: String,
                compatibility: String,
            }],
        }],
    },
    {
        timestamps: true,
    }
);

const ChargerModel = model<IChargerModel>('chargerModels', ChargerModelSchema);

export default module.exports = ChargerModel;
