const mongoose = require('mongoose');

const { Schema } = mongoose;

const groupDriversModel = new Schema(
    {
        id: { type: String, index: true },
        name: { type: String },
        createUser: { type: String },
        imageContent: { type: String },
        listOfDrivers: [
            {
                driverId: { type: String },
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

groupDriversModel.index({ userId: 1 });

var GroupDrivers = module.exports = mongoose.model('GroupDrivers', groupDriversModel);

module.exports.createGroupDrivers = function (newGroupDrivers, callback) {
    newGroupDrivers.save(callback);
};

module.exports.updateGroupDrivers = function (query, values, callback) {
    GroupDrivers.findOneAndUpdate(query, values, callback);
};

module.exports.removeGroupDrivers = function (query, callback) {
    GroupDrivers.findOneAndRemove(query, callback);
};