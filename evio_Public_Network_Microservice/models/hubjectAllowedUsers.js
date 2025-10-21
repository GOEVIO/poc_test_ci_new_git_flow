const mongoose = require('mongoose');

const { Schema } = mongoose;

const hubjectAllowedUsersSchema = new Schema(
    {
        userId: { type: String, index: true, required: true },
    },
    {
        timestamps: false,
        versionKey: false
    }
);

hubjectAllowedUsersSchema.index({ userId: 1 });

const HubjectAllowedUsers = mongoose.model('HubjectAllowedUsers', hubjectAllowedUsersSchema);

module.exports = {
    HubjectAllowedUsers,
    isHubjectAllowedUser: async function (userId) {
        const allowedUser = await HubjectAllowedUsers.findOne({ userId });
        return !!allowedUser;
    }
};
