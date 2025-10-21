const mongoose = require('mongoose');

const { Schema } = mongoose;

const activationModel = new Schema(
    {
        code: {
            type: String,
            index: true,
        },
        userId: {
            type: String,
        },
        token: {
            type: String,
        },
        used: {
            type: Boolean,
            require: true,
        },
        createDate: {
            type: Date,
            default: Date.now
        },
        modifyDate: {
            type: Date
        },
        // clientName: { type: String, default: "EVIO" },

    },
    {
        timestamps: true
    }
);

var Activation = module.exports = mongoose.model('Activation', activationModel);

module.exports.createActivation = function (newActivation, callback) {
    newActivation.save(callback);
};

module.exports.updateActivation = function (query, values, callback) {
    Activation.findOneAndUpdate(query, values, callback);
};

module.exports.removeActivation = function (query, callback) {
    Activation.findOneAndRemove(query, callback);
};