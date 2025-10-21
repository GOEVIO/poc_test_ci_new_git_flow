const mongoose = require('mongoose');
require("dotenv-safe").load();

const { Schema } = mongoose;

const keysModel = new Schema({
    key: {
        type: String,
        required: true
    },
    readonly: {
        type: Boolean,
        required: true
    },
    value: {
        type: String,
        required: true
    }
});

const configurationKeysModel = new Schema({
    hwId : {
        type : String,
        required: true
    },
    keys : [
         keysModel
    ],
    lastUpdated : { 
        type: Date, 
        default: Date.now 
    },
    lastReadDate : { 
        type : String
    }
})

configurationKeysModel.index({ hwId: 1 });

const ConfigurationKey = module.exports = mongoose.model('ConfigurationKey', configurationKeysModel);

module.exports.findOneConfigurationKeys = function (query) {
    return ConfigurationKey.findOne(query);
};

module.exports.upsertChargerConfigurationKeys = function (query, values ) {
    return ConfigurationKey.findOneAndUpdate(query, values, {new:true,upsert:true});
};

module.exports.updateConfigurationKey = function (query, values ) {
    return ConfigurationKey.updateOne(query, values);
};