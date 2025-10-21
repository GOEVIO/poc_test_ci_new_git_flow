const mongoose = require('mongoose');

require("dotenv-safe").load();


const { Schema } = mongoose;

const versionsModel = new Schema({
    version: {
        type: String
    },
    url: {
        type: String
    },
    cpo: {
        type: String
    },
    platformId: {
        type: String
    }
});

var Versions = module.exports = mongoose.model('ocpicredentialsversions', versionsModel);


module.exports.create = function (newObject, callback) {
    newObject.save(callback);
};


module.exports.updateVersions = function (query, values, callback) {
    Versions.findOneAndUpdate(query, values, callback);
};