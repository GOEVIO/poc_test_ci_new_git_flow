import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IFacilitiesType extends Document {
    locationType: string;
    description?: string;
}

const FacilitiesTypeSchema: Schema<IFacilitiesType> = new Schema({
    locationType: { type: String, required: true, unique: true },
    description: { type: String }
}, {
    timestamps: true
});

const FacilitiesType: Model<IFacilitiesType> = mongoose.model<IFacilitiesType>('FacilitiesType', FacilitiesTypeSchema);

export default FacilitiesType;
