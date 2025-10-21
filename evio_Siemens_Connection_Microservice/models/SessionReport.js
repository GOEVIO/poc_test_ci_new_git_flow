const mongoose = require('mongoose');

const { Schema } = mongoose;

const sessionReportModel = new Schema(
    {
        id: {
            type: String,
            index: true
        },
        sessionId: { type: String },
        meter_abs: { type: String },
        meter_abs_unit: { type: String },
        meter_current_session: { type: String },
        meter_current_session_unit: { type: String }
    },
    {
        timestamps: true
    }
);

var SessionReport = module.exports = mongoose.model('sessionReport', sessionReportModel);