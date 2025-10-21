const mongoose = require('mongoose');

const { Schema } = mongoose;

const iconSchema = new Schema(
    {
        type: {
            type: String,
            enum: ['single', 'multiple', 'offline'],
            required: true,
        },
        url: {type: String, required: true},
    },
    {
        _id: false
    }
);

const operatorModel = new Schema(
    {
        id: { type: String, index: true },
        entityName: { type: String },
        companyName: { type: String },
        mobieCode: { type: String },
        partyId: { type: String },
        contact: { type: String },
        email: { type: String },
        isOPC: { type: Boolean },
        isCEME: { type: Boolean },
        icons: {
            type: [iconSchema],
            default: []
        }
    },
    {
        timestamps: true
    }
);

operatorModel.index({ partyId: 1 });

var Operator = module.exports = mongoose.model('Operator', operatorModel);

module.exports.createOperator = function (newOperator, callback) {
    newOperator.save(callback);
};

module.exports.updateOperator = function (query, values, callback) {
    Operator.findOneAndUpdate(query, values, callback);
};

module.exports.removeOperator = function (query, callback) {
    Operator.findOneAndRemove(query, callback);
};
