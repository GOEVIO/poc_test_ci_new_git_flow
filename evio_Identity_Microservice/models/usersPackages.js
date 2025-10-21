const mongoose = require('mongoose');

const { Schema } = mongoose;

const usersPackagesModel = new Schema(
    {
        id: { type: String, index: true },
        packageName: {
            type: String
        },
        packageType: {
            type: String
        },
        rfidCardsLimit: {
            type: Number
        },
        fleetsLimit: {
            type: Number
        },
        evsLimit: {
            type: Number
        },
        driversLimit: {
            type: Number
        },
        groupOfDriversLimit: {
            type: Number
        },
        driversInGroupDriversLimit: {
            type: Number
        },
        chargingAreasLimit: {
            type: Number
        },
        evioBoxLimit: {
            type: Number
        },
        chargersLimit: {
            type: Number
        },
        tariffsLimit: {
            type: Number
        },
        chargersGroupsLimit: {
            type: Number
        },
        userInChargerGroupsLimit: {
            type: Number
        },
        searchLocationsLimit: {
            type: String
        },
        searchChargersLimit: {
            type: String
        },
        comparatorLimit: {
            type: String
        },
        routerLimit: {
            type: String
        },
        cardAssociationEnabled: {
            type: Boolean
        },
        billingTariffEnabled: {
            type: Boolean
        },
        clientName: { type: String, default: "EVIO" },
    },
    {
        timestamps: true
    }
);

var UsersPackages = module.exports = mongoose.model('UsersPackages', usersPackagesModel);

module.exports.createUsersPackages = function (newUsersPackages, callback) {
    newUsersPackages.save(callback);
};

module.exports.updateUsersPackages = function (query, values, callback) {
    UsersPackages.findOneAndUpdate(query, values, callback);
};

module.exports.updateUsersPackagesFilter = function (query, values, filter, callback) {
    UsersPackages.findOneAndUpdate(query, values, filter, callback);
};

module.exports.removeUsersPackages = function (query, callback) {
    UsersPackages.findOneAndRemove(query, callback);
};