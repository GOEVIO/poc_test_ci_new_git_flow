const mongoose = require('mongoose');
require("dotenv-safe").load();

const { Schema } = mongoose;

const listDriversModel = new Schema(
    {
        userId: { type: String },
        name: { type: String },
        groupId: { type: String },
        period: {
            periodType: { type: String },
            period: {
                startDate: { type: Date },
                stopDate: { type: Date }
            }
        },
        paymenteBy: { type: String },
        billingBy: { type: String },
        mobile: { type: String },
        internationalPrefix: { type: String }
    }
);

const listOfPlugs = new Schema(
    {
        plugType: { type: String },
        plugPower: { type: Number }
    }
);

const PlugChargingList = new Schema(
    {
        plugType: { type: String },
        chargePhaseVolt: { type: Number },
        chargePhaseAmp: { type: Number },
        chargePhase: { type: Number },
        chargePower: { type: Number },
        chargeTime: { type: Number }
    }
);

const PlugFastChargingList = new Schema(
    {
        plugType: { type: String },
        fastChargePower: { type: Number },
        fastChargeTime: { type: Number },
        currentType: { type: String }
    }
);

const EVInfo = new Schema(
    {
        databaseVehicleId: { type: Number },
        yearFrom: { type: String },
        yearTo: { type: String },
        range: { type: Number },
        useableBatteryCapacity: { type: Number },
        maxBatteryCapacity: { type: Number },
        eletricMotorPower: { type: Number },
        internalChargerPower: { type: Number },
        internalChargerChargeTime: { type: Number },
        internalChargerChargeSpeed: { type: Number },
        maxFastChargingPower: { type: Number },
        avgFastChargingPower: { type: Number },
        fastchargeChargeTime: { type: Number },
        fastchargeChargeSpeed: { type: Number },
        evType: { type: String },
        evEfficiency: { type: Number },
        consumptionCity: { type: Number },
        consumptionHighway: { type: Number },
        plugsChargingTable: [{ type: PlugChargingList }],
        plugsFastChargingTable: [{ type: PlugFastChargingList }],
        plugs: [
            { type: listOfPlugs }
        ]
    }
);

const listOfKMsModel = new Schema(
    {
        kms: { type: Number },
        sessionID: { type: String }, // ID of charging session
        chargingDate: { type: Date }, // date of start of charging, needed so we can order by time
        chargerType: { type: String },
        kmsDate: { type: Date },
        updatedKmsDate: { type: Date }
    }
)

const evModel = new Schema(
    {
        id: { type: String, index: true },
        brand: { type: String },
        model: { type: String },
        version: { type: String },
        vehicleId: { type: String },
        evInfo: { type: EVInfo },
        imageContent: { type: String },
        evType: { type: String },
        userId: { type: String },
        primaryEV: { type: Boolean, default: false },
        status: { type: String, default: process.env.EVsStatusAvailable },
        paymenteBy: { type: String },
        sessions: [
            {
                userId: { type: String },
                numberOfSessions: { type: Number }
            }
        ],
        chargerId: { type: String },
        batteryChargingSession: { type: Number },
        consumptionChargingSession: { type: Number },
        paymentChargingSession: { type: Number },
        fleet: { type: String },
        hasFleet: { type: Boolean, default: true },
        licensePlate: { type: String },
        country: { type: String },
        usageNumber: {
            type: Number,
            default: 0
        },
        listOfGroupDrivers: [
            {
                type: listDriversModel
            }
        ],
        listOfDrivers: [
            {
                type: listDriversModel
            }
        ],
        otherInfo: { type: String },
        plafondId: { type: String },
        plafond: { type: Number },
        clientName: { type: String, default: "EVIO" },
        invoiceType: { type: String },
        invoiceCommunication: { type: String },
        acceptKMs: { type: Boolean, default: false },
        updateKMs: { type: Boolean, default: false },
        listOfKMs: [{ type: listOfKMsModel }],
        kms: { type: String } // total amount of Km's this EV has
    },
    {
        timestamps: true
    }
);

evModel.index({ id: 1 });
evModel.index({ userId: 1 });
evModel.index({ fleet: 1 });
evModel.index({ 'listOfGroupDrivers.groupId': 1, hasFleet: 1 }, { background: true });
evModel.index({ 'listOfDrivers.userId': 1, hasFleet: 1 }, { background: true });

var EV = module.exports = mongoose.model('EV', evModel);

module.exports.createEvs = function (newEv, callback) {
    newEv.save(callback);
};

module.exports.getEVByUserId = function (userId, callback) {
    var query = { userId: userId };
    EV.find(query, callback);
};

module.exports.markAsPrimaryEV = function (evId, callback) {
    var query = { _id: evId };
    var newvalues = { $set: { primaryEV: true } };
    EV.updateOne(query, newvalues, callback);
};

module.exports.markAllAsSecondaryEV = function (userId, callback) {
    var query = { userId: userId };
    var newvalues = { $set: { primaryEV: false } };
    EV.updateMany(query, newvalues, callback);
};

module.exports.updateEV = function (query, values, callback) {
    EV.findOneAndUpdate(query, values, callback);
};

module.exports.removeEV = function (query, callback) {
    EV.findOneAndDelete(query, callback);
};
