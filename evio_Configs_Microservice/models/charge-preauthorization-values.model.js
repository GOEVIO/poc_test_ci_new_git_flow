const mongoose = require('mongoose');
const { Schema } = mongoose;
const { CollectionNames } = require('evio-library-commons')

const chargerPreAuthorizationValuesSchema = new Schema(
    {
       hwId: { type: String, required: true, index: true },
       plugs: [{
        plugId: { type: String, required: false },
        preAuthorizationValue: { type: Number, required: true, default: 40 }
       }]
    },
    { timestamps: true }
);

chargerPreAuthorizationValuesSchema.index({ hwId: 1 });

const chargerPreAuthorizationValuesModel = mongoose.model(
    CollectionNames.Configs.chargerPreAuthorizationValues,
    chargerPreAuthorizationValuesSchema
);

async function saveOrUpdateCharge(hwId, plugId, preAuthorizationValue) {
    const updated = await chargerPreAuthorizationValuesModel.findOneAndUpdate(
        { hwId: hwId, 'plugs.plugId': plugId },
        { $set: { 'plugs.$.preAuthorizationValue': preAuthorizationValue } },
        { new: true }
    );
    if (updated) {
        return updated;
    }
    const upserted = await chargerPreAuthorizationValuesModel.findOneAndUpdate(
        { hwId: hwId },
        { $push: { plugs: { plugId, preAuthorizationValue } } },
        { upsert: true, new: true }
    );
    return upserted;
}

async function getCharge(hwId) {
    const charge = await chargerPreAuthorizationValuesModel.findOne(
        { 'hwId': hwId },
    );
    if (!charge) {
        throw new Error('Charge not found.');
    }
    return charge;
}

module.exports = {
    saveOrUpdateCharge,
    getCharge
};
