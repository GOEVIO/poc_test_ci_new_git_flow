const mongoose = require('mongoose');

require("dotenv-safe").load();


const { Schema } = mongoose;

const logsModel = new Schema({

    platformCode: {
        type: String
    },
    platformName: {
        type: String
    },
    token: {
        type: String
    },
    type: {
        type: String
    },
    path: {
        type: String
    },
    requestBody: {
        type: Object
    },
    responseBody: {
        type: Object
    },
    httpCode: { type: Number },
    trigger: { type: String },
    module: { type: String },
    cpo: { type: String },
    success: { type: Boolean },
},
    {
        timestamps: true
    }
);

var OcpiLog = module.exports = mongoose.model('ocpiLog', logsModel);

module.exports.create = function (newObject, callback) {
    newObject.save(callback);
};

