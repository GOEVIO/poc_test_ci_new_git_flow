const mongoose = require('mongoose');

const { Schema } = mongoose;


const costByPowerModel = new Schema(
    {
        cost: { type: Number },
        uom: { type: String }
    }
);

const costByTimeModel = new Schema(
    {
        minTime: { type: Number },
        maxTime: { type: Number },
        cost: { type: Number },
        uom: { type: String },
        description: { type: String }
    }
);


const tariffsOPCModel = new Schema(
    {
        station: { type: String },
        location: { type: String },
        initialCost: { type: Number },
        costByTime: [{ type: costByTimeModel }],
        costByPower: { type: costByPowerModel }
    }
);

var TariffsOPC = module.exports = mongoose.model('TariffsOPC', tariffsOPCModel);

module.exports.createTariffsOPC = function (newTariffsOPC, callback) {
    newTariffsOPC.save(callback);
};