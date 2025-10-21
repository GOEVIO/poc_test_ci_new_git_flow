const mongoose = require('mongoose');

require("dotenv-safe").load();


const { Schema } = mongoose;

const configsModel = new Schema({
    config: {
        type: String
    },
    value: {
        type: Array
    }
},
    {
        timestamps: false,
        versionKey: false
    }
);

var Config = module.exports = mongoose.model('configs', configsModel);

module.exports.create = function (newObject, callback) {
    newObject.save(callback);
};

