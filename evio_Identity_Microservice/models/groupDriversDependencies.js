const mongoose = require('mongoose');

const { Schema } = mongoose;

const groupDriversDependenciesModel = new Schema(
    {
        id: { type: String, index: true },
        userId: { type: String },
        groupId: { type: String },
        drivers: [
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

var GroupDriversDependencies = module.exports = mongoose.model('GroupDriversDependencies', groupDriversDependenciesModel);

module.exports.createGroupDriversDependencies = function (newgroupDriversDependencies, callback) {
    newgroupDriversDependencies.save(callback);
};

module.exports.updateGroupDriversDependencies = function (query, values, callback) {
    GroupDriversDependencies.findOneAndUpdate(query, values, callback);
};

module.exports.removeGroupDriversDependencies = function (query, callback) {
    GroupDriversDependencies.findOneAndRemove(query, callback);
};