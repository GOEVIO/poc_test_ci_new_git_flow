import { Schema, Types, model } from 'mongoose';
import dotenv from 'dotenv-safe';
import {
    IAccessPlatformList, IGuestUserDocument, IGuestUserModel, IGuestUserUser
} from '../interfaces/guestUsers.interface';

dotenv.load();

const accessPlatformModel = new Schema<IAccessPlatformList>(
    {
        api: { type: Boolean, default: true },
        webclient: { type: Boolean, default: true },
        mobile: { type: Boolean, default: true }
    }
);
const users = new Schema<IGuestUserUser>(
    {
        userId: {
            type: Types.ObjectId,
            ref: 'User',
            require: true,
            index: true
        },
        rulesIds: [{ type: Types.ObjectId, ref: 'Rule' }],
    }
);

const guestUsersModel = new Schema<IGuestUserDocument>(
    {
        id: { type: String, index: true },
        name: { type: String },
        email: { type: String },
        accessPlatform: { type: accessPlatformModel },
        accessPermissions: { type: Object },
        active: { type: Boolean, default: true },
        clientName: { type: String, default: process.env.clientNameEVIO },
        users: [users]
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

guestUsersModel.index({ email: 1, ownerId: 1 });

guestUsersModel.pre('findOneAndUpdate', function (next) {
    const data = this.getUpdate() as any;
    if (data?.ruleIds) {
        data.ruleIds = data.ruleIds.map((ruleId) => Types.ObjectId(ruleId));
    }
    next();
});

guestUsersModel.statics.createGuestUsers = function (newGuestUser, callback) {
    return newGuestUser.save(callback);
};

guestUsersModel.statics.updateGuestUsers = function (query, values, options, callback) {
    this.findOneAndUpdate(query, values, options, callback);
};

guestUsersModel.statics.removeGuestUser = function (_id) {
    return this.findByIdAndDelete(_id);
};

const GuestUser = model<IGuestUserDocument, IGuestUserModel>('GuestUser', guestUsersModel);

export default module.exports = GuestUser;
