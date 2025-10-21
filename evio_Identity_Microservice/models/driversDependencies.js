const mongoose = require('mongoose');

const { Schema } = mongoose;

const driversDependenciesModel = new Schema(
    {
        id: { type: String, index: true },
        userId: { type: String },
        drivers: [
            {
                mobile: {
                    type: String
                },
                internationalPrefix: {
                    type: String
                },
                registered: {
                    type: Boolean,
                    default: false
                },
                createDate: {
                    type: Date,
                    default: Date.now
                }
            }
        ],
        clientName: { type: String, default: "EVIO" },
    },
    {
        timestamps: true
    }
);

var DriversDependencies = module.exports = mongoose.model('DriversDependencies', driversDependenciesModel);

module.exports.createDriversDependencies = function (newDriversDependencies, callback) {
    newDriversDependencies.save(callback);
};

module.exports.updateDriversDependencies = function (query, values, callback) {
    DriversDependencies.findOneAndUpdate(query, values, callback);
};