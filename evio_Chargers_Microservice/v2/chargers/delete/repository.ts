import Charger from '../../../models/charger';
import mongoose from 'mongoose';

export const findByIdAndUser = async (_id: string, userId: string) => {
    if (!mongoose.Types.ObjectId.isValid(_id)) return null;
    return Charger.findOne({ _id, createUser: userId, hasInfrastructure: true });
};

export const deleteChargerById = async (id: string) => {
    return Charger.deleteOne({ _id: id });
};

export const deactivateCharger = async (id: string) => {
    return Charger.updateOne(
        { _id: id },
        {
            $set: {
                active: false,
                infrastructure: '',
                hasInfrastructure: false,
                status: process.env.ChargePointStatusEVIOFaulted,
                operationalStatus: process.env.OperationalStatusRemoved
            }
        }
    );
};
