const mongoose = require('mongoose');
const { Schema } = mongoose;

const mobieEventModel = new Schema(
    {
        id: { type: String, index: true },
        event: { type: Object },
        eventType: { type: String },
        data: {
            type: Date,
            default: Date.now
        }
    }
);

var MobieEvent = module.exports = mongoose.model('MobieEvent', mobieEventModel);

module.exports.createMobieEvent = function (newMobieEvent, callback) {
    newMobieEvent.save(callback);
}

module.exports.updateMobieEvent = function (query, values, callback) {
    MobieEvent.findOneAndUpdate(query, values, callback);
}

module.exports.removeMobieEvent = function (query, callback) {
    MobieEvent.findOneAndRemove(query, callback);
}
