const mongoose = require('mongoose');
require("dotenv-safe").load();
const { Schema } = mongoose;

const insightsModel = new Schema(
    {
        
    },
    {
        timestamps: true
    }
);

var Insights = module.exports = mongoose.model('Insights', insightsModel);

module.exports.createInsights = function (newInsights, callback) {
    newInsights.save(callback);
};

module.exports.updateInsights = function (query, values, callback) {
    Insights.findOneAndUpdate(query, values, callback);
};

module.exports.removeInsights = function (query, callback) {
    Insights.findOneAndRemove(query, callback);
};