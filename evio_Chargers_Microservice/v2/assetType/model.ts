import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAssetType extends Document {
    vehicleType: string;
    description?: string;
}

const AssetTypeSchema: Schema<IAssetType> = new Schema({
    vehicleType: { type: String, required: true, unique: true },
    description: { type: String }
}, {
    timestamps: true
});

const AssetType: Model<IAssetType> = mongoose.model<IAssetType>('AssetType', AssetTypeSchema);

export default AssetType;
