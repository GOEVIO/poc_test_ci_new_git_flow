import mongoose, { Schema } from 'mongoose';
import { IAlarm } from '../interfaces/alarms.interface';

const AlarmSchema = new Schema<IAlarm>({
    title: {
        code: { type: String, required: true },
        message: { type: String, required: true }
    },
    description: {
        code: { type: String, required: true },
        message: { type: String, required: true }
    },
    timestamp: { type: Date, required: true },
    type: { type: String, enum: ['error', 'warning', 'info'], required: true },
    status: { type: String, enum: ['read', 'unread'], required: true },
    userId: { type: String, required: false },
    hwId: { type: String, required: false },
    plugId: { type: String, required: false },
    data: { type: Schema.Types.Mixed, required: false }
});

export default mongoose.model<IAlarm>('Alarm', AlarmSchema);
