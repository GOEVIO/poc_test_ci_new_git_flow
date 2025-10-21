const mongoose = require('mongoose');
var AutoIncrement = require('mongoose-sequence')(mongoose);

const { Schema } = mongoose;

const listCEMEModel = new Schema(
    {
        id: { type: String, index: true },
        CEME: { type: String },
        imageCEME: { type: String },
        imageCard: { type: String },
        fontCardBlack: { type: Boolean, default: false },
        order: { type: Number }
    },
    {
        timestamps: true
    }
);

//listCEMEModel.plugin(AutoIncrement, { id: 'order_seq', inc_field: 'order' });

var ListCEME = module.exports = mongoose.model('ListCEME', listCEMEModel);

module.exports.createListCEME = function (newListCEME, callback) {
    newListCEME.save(callback);
};

module.exports.updateListCEME = function (query, values, callback) {
    ListCEME.findOneAndUpdate(query, values, callback);
};

module.exports.removeListCEME = function (query, callback) {
    ListCEME.findOneAndRemove(query, callback);
};

module.exports.markAllAsNotDefault = function (userId, callback) {
    var query = { userId: userId };
    var newvalues = { $set: { default: false } };
    ListCEME.updateMany(query, newvalues, callback);
};

module.exports.markAsDefaultListCEME = function (contractId, userId, callback) {
    var query = {
        _id: contractId,
        userId: userId
    };
    var newvalues = { $set: { default: true } };
    ListCEME.updateOne(query, newvalues, callback);
};