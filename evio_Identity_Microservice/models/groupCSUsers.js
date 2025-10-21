const mongoose = require('mongoose');

const { Schema } = mongoose;

const groupCSUsersModel = new Schema(
    {
        id: { type: String, index: true },
        name: { type: String },
        createUser: { type: String },
        imageContent: { type: String },
        listOfUsers: [
            {
                userId: { type: String },
                name: { type: String },
                mobile: { type: String },
                internationalPrefix: { type: String },
                active: { type: Boolean },
                admin: {
                    type: Boolean,
                    default: false
                }
            }
        ],
        clientName: { type: String, default: "EVIO" },
    },
    {
        timestamps: true
    }
);

groupCSUsersModel.index({ userId: 1 });

var GroupCSUsers = module.exports = mongoose.model('GroupCSUsers', groupCSUsersModel);

module.exports.createGroupCSUsers = function (newGroupCSUsers, callback) {
    newGroupCSUsers.save(callback);
};

module.exports.updateGroupCSUsers = function (query, values, callback) {
    GroupCSUsers.findOneAndUpdate(query, values, callback);
};

module.exports.removeGroupCSUsers = function (query, callback) {
    GroupCSUsers.findOneAndRemove(query, callback);
};