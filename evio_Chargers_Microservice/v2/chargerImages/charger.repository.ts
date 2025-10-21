import ChargerModel from '../../models/charger';
import { Charger } from './charger.types';

export const findChargerById = async (hwId: string): Promise<Charger | null> => {
    return ChargerModel.findOne({ hwId });
};

export const updateCharger = async (hwId: string, update: any): Promise<Charger | null> => {
    return ChargerModel.findOneAndUpdate({ hwId }, update, { new: true });
};
