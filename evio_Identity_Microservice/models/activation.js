var mongoose = require('mongoose');
var mongo = require('mongodb');

var ActivationSchema = mongoose.Schema({
    code: {
        type: String,
        index: true,
        require: true
    },
    userId: {
        type: String,
        require: true
    },
    token: {
        type: String,
        require: true
    },
    used: {
        type: Boolean,
        require: true,
        default: false
    },
    createDate: {
        type: Date,
        default: Date.now
    },
    modifyDate: {
        type: Date
    },
    clientName: { type: String, default: "EVIO" },
});

ActivationSchema.index({ userId: 1 });

var Activation = module.exports = mongoose.model('Activation', ActivationSchema)

module.exports.createActivation = function (newActivation, callback) {
    newActivation.save(callback);
};

module.exports.updateActivation = function (query, values, callback) {
    Activation.findOneAndUpdate(query, values, callback);
};