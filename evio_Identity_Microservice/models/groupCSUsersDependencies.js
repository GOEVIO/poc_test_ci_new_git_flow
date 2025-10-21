const mongoose = require('mongoose');

const { Schema } = mongoose;

const groupCSUsersDependenciesModel = new Schema(
    {
        id: { type: String, index: true },
        userId: { type: String },
        groupId: { type: String },
        users: [
            {
                mobile: {
                    type: String
                },
                internationalPrefix: {
                    type: String
                },
                registered: {
                    type: Boolean,
                    default: false
                },
                createDate: {
                    type: Date,
                    default: Date.now
                }
            }
        ],
        clientName: { type: String, default: "EVIO" },
    },
    {
        timestamps: true
    }
);

var GroupCSUsersDependencies = module.exports = mongoose.model('GroupCSUsersDependencies', groupCSUsersDependenciesModel);

module.exports.createGroupCSUsersDependencies = function (newGroupCSUsersDependencies, callback) {
    newGroupCSUsersDependencies.save(callback);
};

module.exports.updateGroupCSUsersDependencies = function (query, values, callback) {
    GroupCSUsersDependencies.findOneAndUpdate(query, values, callback);
};

module.exports.removeGroupCSUsersDependencies = function (query, callback) {
    GroupCSUsersDependencies.findOneAndRemove(query, callback);
};