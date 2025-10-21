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
    },
    required: {
        type: Boolean,
        default: false
    }
});

const EvioKeysModel = new Schema({
    code : {
        type : String,
    },
    description : {
        type : String,
    },
    manufacturer : {
        type : String,
    },
    model : {
        type : String,
    },
    keys : [
        keysModel
    ],
    lastUpdated : {
        type: Date,
        default: Date.now
    }
})

EvioKeysModel.index({ hwId: 1 });

const EvioKey = module.exports = mongoose.model('EvioKey', EvioKeysModel);

module.exports.findOneEvioKeys = function (query) {
    return EvioKey.findOne(query);
};

module.exports.upsertChargerEvioKeys = function (query, values ) {
    return EvioKey.findOneAndUpdate(query, values, {new:true,upsert:true});
};

module.exports.updateEvioKey = function (query, values ) {
    return EvioKey.updateOne(query, values);
};
