const mongoose = require('mongoose');

const { Schema } = mongoose;

const integrationStatusModel = new Schema(
    {
        status: { type: String },
        response : { type: String },
        errorCode: { type: String },
        errorDescription: { type: String },
        failedCount : { type: Number , default : 0 },

    }
);
const locationsQueueModel = new Schema(
    {
        charger: { type: Object },
        evioChargerBeforeChanges: { type: Object },
        requestBody: { type: Object },
        command: { type: String },
        network: { type: String },
        country_code : { type: String },
        party_id : { type: String },
        operatorId : { type: String },
        chargerId : { type: String },
        platformId : { type: String },
        integrationStatus : { type: integrationStatusModel },
        evse : { type: Object },
        connector : { type: Object },
        endpoint : { type: String },
        data : { type: Object },
        token : { type: String },
        requestType : { type: String },
        httpStatus : { type: Number },
    },
    {
        timestamps: true
    }
);

var LocationsQueue = module.exports = mongoose.model('LocationsQueue', locationsQueueModel);

module.exports.create = function (newLocationsQueue) {
    return newLocationsQueue.save();
};

module.exports.updateLocationsQueue = function (query, values, callback) {
    LocationsQueue.findOneAndUpdate(query, values, callback);
};

module.exports.removeLocationsQueue = function (query, callback) {
    LocationsQueue.findOneAndRemove(query, callback);
};