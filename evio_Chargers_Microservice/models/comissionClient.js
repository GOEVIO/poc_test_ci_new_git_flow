const mongoose = require('mongoose');
require("dotenv-safe").load();
var AutoIncrement = require('mongoose-sequence')(mongoose);

const { Schema } = mongoose;

const comissionClientModel = new Schema(
    {
        userId: { type: String },
        charger: { type: String },
        percentage: { type: Number }
    },
    {
        timestamps: true
    }
);

var comissionClient = module.exports = mongoose.model('ComissionClient', comissionClientModel);

module.exports.createComission = function (newComission, callback) {
    newComission.save(callback);
};