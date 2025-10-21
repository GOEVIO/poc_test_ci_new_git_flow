const mongoose = require('mongoose');

const { Schema } = mongoose;

const operatorModel = new Schema(
    {
        id: {
            type: String,
            index: true
        },
        operator: { type: String },
        operatorContact: { type: String },
        operatorEmail: { type: String },
        network: { type: String },
        partyId: { type: String }
    },
    {
        timestamps: true
    }
);


var Operator = module.exports = mongoose.model('Operator', operatorModel);

module.exports.createOperator = function (newOperator, callback) {
    newOperator.save(callback);
};

module.exports.updateOperator = function (query, values, callback) {
    Operator.findOneAndUpdate(query, values, callback);
};

module.exports.removeOperator = function (query, callback) {
    Operator.findOneAndDelete(query, callback);
};