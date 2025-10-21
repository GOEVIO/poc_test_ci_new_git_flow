const mongoose = require('mongoose');
const { Schema } = mongoose;

const validationModel = new Schema({
    type: { type: String },
    value: { type: String },
    rate: { type: Number },
});

const samplerValidationModel = new Schema(
    {
        validationType : { type: String },
        defaultRate: { type: Number },
        validations : { type: [validationModel], default: [] },
    },
    {
        timestamps: true
    }
);


var SamplerValidation = module.exports = mongoose.model('SamplerValidation', samplerValidationModel);

module.exports.createSamplerValidation = function (newSamplerValidation, callback) {
    newSamplerValidation.save(callback);
};

module.exports.updateSamplerValidation = function (query, values, callback) {
    SamplerValidation.findOneAndUpdate(query, values, callback);
};

module.exports.removeSamplerValidation = function (query, callback) {
    SamplerValidation.findOneAndDelete(query, callback);
};