import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IParkingType extends Document {
    parkingType: string;
    description?: string;
}

const ParkingTypeSchema: Schema<IParkingType> = new Schema({
    parkingType: { type: String, required: true, unique: true },
    description: { type: String }
}, {
    timestamps: true
});

const ParkingType: Model<IParkingType> = mongoose.model<IParkingType>('ParkingType', ParkingTypeSchema);

export default ParkingType;
