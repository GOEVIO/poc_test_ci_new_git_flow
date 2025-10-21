const mongoose = require('mongoose');
require("dotenv-safe").load();

const { Schema } = mongoose;

const costByPowerModel = new Schema({
    id: { type: String },
    cost: { type: Number },
    uom: { type: String }
});

const costByTimeModel = new Schema({
    id: { type: String },
    minTime: { type: Number },
    maxTime: { type: Number },
    cost: { type: Number },
    uom: { type: String },
    description: { type: String }
});

const serviceCostModel = new Schema({
    id: { type: String },
    initialCost: { type: Number },
    costByTime: [{ type: costByTimeModel }],
    costByPower: { type: costByPowerModel },

});

const plugsModel = new Schema({
    plugId: { type: String },
    qrCodeId: { type: String },
    tariff: [
        {
            groupName: { type: String },
            groupId: { type: String },
            tariffId: { type: String }
        }
    ],
    connectorType: { type: String },
    voltage: { type: Number },
    amperage: { type: Number },
    power: { type: Number },
    active: { type: Boolean },
    status: { type: String, default: process.env.ChargePointStatusEVIO },
    serviceCost: { type: serviceCostModel },
    canBeNotified: { type: Boolean },
    canBeAutomaticallyBooked: { type: Boolean },
    hasRemoteCapabilities: { type: Boolean, default: true },   // this flag will indicate that this plug has or not the abilitie to accept start/stop remote commands
    mySession: { type: String }
});

const chargersEvioModel = new Schema(
    {
        id: { type: String, index: true },
        hwId: { type: String },
        vendor: { type: String },
        model: { type: String },
        vehiclesType: [
            {
                vehicle: { type: String }
            }
        ],
        chargerType: { type: String },
        plugs: [{ type: plugsModel }],
        imageContent: { type: [String] },
        wifiPairingName: { type: String },
        createUser: { type: String },
        manufacturer: { type: String },
        network: { type: String },
        operator: { type: String, default: "EVIO" },
        operatorContact: { type: Number },
        operatorEmail: { type: String, default: "evio@go-evio.com" },
        stationIdentifier: { type: String },
        wrongBehaviorStation: { type: Boolean, default: false },
        clientName: { type: String, default: "EVIO" },
    },
    {
        timestamps: true
    }
);

//chargersEvioModel.index({ geometry: "2dsphere" });

var ChargersEvio = module.exports = mongoose.model('ChargersEvio', chargersEvioModel);


module.exports.createChargersEvio = function (newChargersEvio, callback) {
    newChargersEvio.save(callback);
}

module.exports.updateChargersEvio = function (query, values, callback) {

    ChargersEvio.findOneAndUpdate(query, values, callback);
};