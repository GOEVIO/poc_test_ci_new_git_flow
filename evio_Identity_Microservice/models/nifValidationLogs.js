var mongoose = require('mongoose');

var NifValidationLogSchema = mongoose.Schema({
    userId: { type: String},
    clientName: { type: String, default: "EVIO" },
    tries: { type: Array },
},
{
    timestamps: true
});

NifValidationLogSchema.index({ userId: 1 });

var NifValidationLogs = module.exports = mongoose.model('NifValidationLogs', NifValidationLogSchema)

module.exports.createNifValidationLogs = function (newNifValidationLogs, callback) {
    newNifValidationLogs.save(callback);
};

module.exports.updateNifValidationLogs = function (query, values, callback) {
    NifValidationLogs.findOneAndUpdate(query, values, callback);
};