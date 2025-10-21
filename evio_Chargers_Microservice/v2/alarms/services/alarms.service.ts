import AlarmModel from '../models/alarms.model';
import { IAlarm } from '../interfaces/alarms.interface';
import mongoose from 'mongoose';

export const createAlarm = async (alarm: IAlarm) => {
    const newAlarm = new AlarmModel(alarm);
    return await newAlarm.save();
};

export const updateAlarmStatus = async (id: string, status: 'read' | 'unread') => {
    const updated = await AlarmModel.findByIdAndUpdate(
        id,
        { status },
        { new: true }
    );

    return updated;
};

export const getAlarms = async (
    filters: Record<string, any>,
    sort: string,
    order: 1 | -1
) => {
    return await AlarmModel.find(filters).sort({ [sort]: order });
};

export const updateMultipleAlarmsStatusService = async (
    ids: string[],
    status: 'read' | 'unread'
) => {
    const objectIds = ids
        .filter(id => mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));

    return await AlarmModel.updateMany(
        { _id: { $in: objectIds } },
        { status }
    );
};

