import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IWeekSchedule {
    weekDay: string;
    scheduleTime: {
        value: number;
        startTime: string;
        stopTime: string;
    }[];
}

export interface ICostTariff extends Document {
    name: string;
    description: string;
    tariffType: string;
    userId: string;
    weekSchedule: IWeekSchedule[];
    purchaseTariffId: string;
}

const CostTariffSchema: Schema<ICostTariff> = new Schema({
    name: { type: String, required: true },
    description: { type: String },
    tariffType: { type: String, required: true },
    userId: { type: String, required: true },
    weekSchedule: [
        {
            weekDay: { type: String, required: true },
            scheduleTime: [
                {
                    value: { type: Number, default: 0 },
                    startTime: { type: String, required: true },
                    stopTime: { type: String, required: true }
                }
            ]
        }
    ],
    purchaseTariffId: { type: String, required: true }
}, {
    timestamps: true
});

const CostTariff: Model<ICostTariff> = mongoose.model<ICostTariff>('CostTariff', CostTariffSchema);

export default CostTariff;
