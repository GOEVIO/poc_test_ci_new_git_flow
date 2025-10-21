const mongoose = require('mongoose');
require("dotenv-safe").load();

const { Schema } = mongoose;

const heartbeatModel = new Schema({
    hwId: {
        type: String,
        required: true
    }
}, {
    strict: false
});

var Heartbeat = module.exports = mongoose.model('Heartbeat', heartbeatModel);

module.exports.createHeartbeat = function (newHeartbeat, callback) {
    newHeartbeat.save(callback);
}
