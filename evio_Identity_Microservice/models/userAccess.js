var mongoose = require('mongoose');
var mongo = require('mongodb');

var userAccessSchema = mongoose.Schema({
    packageType : {
        type: String,
        require: true
    },
    description: {
        type: String,
    },
    clientName: { type: String, default: "EVIO" },
});

var UserAccess = module.exports = mongoose.model('UserAccess', userAccessSchema)

module.exports.createUserAccess = function (newUserAccess, callback) {
    newUserAccess.save(callback);
};

module.exports.updateUserAccess = function (query, values, callback) {
    UserAccess.findOneAndUpdate(query, values, callback);
};

module.exports.removeUserAccess = function (query, callback) {
    UserAccess.findOneAndRemove(query, callback);
};