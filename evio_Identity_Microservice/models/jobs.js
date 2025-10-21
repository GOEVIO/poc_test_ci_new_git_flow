const mongoose = require('mongoose');
const { Schema } = mongoose;

const jobModel = new Schema(
    {
        name: { type: String, index: true },                      // name of the job
        lastRun: { type: Date },                     // date when was last run with successs
        jobTimer: { type: String }                   // the periodicy witch the job will be run
    },
    {
        timestamps: true
    }
);

jobModel.index({ name: 1 });

var Jobs = module.exports = mongoose.model('jobs', jobModel);