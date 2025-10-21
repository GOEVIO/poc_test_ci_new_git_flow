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
const tariffsQueueModel = new Schema(
    {
        tariff: { type: Object },
        controlCenterTariff: { type: Object },
        requestBody: { type: Object },
        command: { type: String },
        network: { type: String },
        country_code : { type: String },
        party_id : { type: String },
        operatorId : { type: String },
        tariffId : { type: String },
        platformId : { type: String },
        integrationStatus : { type: integrationStatusModel },
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

var TariffsQueue = module.exports = mongoose.model('TariffsQueue', tariffsQueueModel);

module.exports.create = function (newTariffsQueue) {
    return newTariffsQueue.save();
};

module.exports.updateTariffsQueue = function (query, values, callback) {
    TariffsQueue.findOneAndUpdate(query, values, callback);
};

module.exports.removeTariffsQueue = function (query, callback) {
    TariffsQueue.findOneAndRemove(query, callback);
};