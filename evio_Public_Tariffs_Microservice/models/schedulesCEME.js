const mongoose = require('mongoose');

const { Schema } = mongoose;

const schedulesModel = new Schema(
    {
        period: { type: String },
        weekDays: { type: String },
        season: { type: String },
        tariffType: { type: String },
        startTime: { type: String },
        endTime: { type: String },
    }
);

const schedulesCEMEModel = new Schema(
    {
        id: { type: String, index: true },
        country: { type: String },
        tariffType: { type: String },
        cycleType: { type: String },
        schedules: [{ type: schedulesModel }]
    },
    {
        timestamps: true
    }
);


var SchedulesCEME = module.exports = mongoose.model('SchedulesCEME', schedulesCEMEModel);

module.exports.createSchedulesCEME = function (newSchedulesCEME, callback) {
    newSchedulesCEME.save(callback);
};

module.exports.updateSchedulesCEME = function (query, values, callback) {
    SchedulesCEME.findOneAndUpdate(query, values, callback);
};

module.exports.removeSchedulesCEME = function (query, callback) {
    SchedulesCEME.findOneAndRemove(query, callback);
};