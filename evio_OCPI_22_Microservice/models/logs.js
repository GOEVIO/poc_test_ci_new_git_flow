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
    httpCode: { type: Number }
},
    {
        timestamps: true
    }
);

logsModel.index({ path: 1 }, {background: true});

var Logs = module.exports = mongoose.model('logs', logsModel);

module.exports.create = function (newObject, callback) {
    newObject.save(callback);
};

