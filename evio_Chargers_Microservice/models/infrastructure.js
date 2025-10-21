const mongoose = require('mongoose');

const { Schema } = mongoose;

const addressModel = new Schema(
    {
        street: { type: String },
        number: { type: String },
        floor: { type: String },
        zipCode: { type: String },
        city: { type: String },
        state: { type: String },
        country: { type: String },
        countryCode: { type: String }
    }
);

const infrastructureModel = new Schema(
    {
        id: {
            type: String,
            index: true
        },
        name: { type: String },
        imageContent: { type: String },
        listChargers: [
            {
                chargerId: { type: String }
            }
        ],
        listSwitchBoards: [
            {
                switchBoardId: { type: String }
            }
        ],
        controllerId: { type: String },
        pVId: { type: String },                                               // id of solar PV equipment
        publicGridID: { type: String },                                       // id of public grid equipment
        CPE: { type: String },
        createUserId: { type: String },
        clientName: { type: String, default: "EVIO" },
        address: { type: addressModel, default: {} },
        createdBy: { type: String },
        operatorId: { type: String },
        additionalInformation: { type: String },
        geometry: {
            type: { type: String, default: "Point" },
            coordinates: { type: [Number], index: "2dsphere" },
        }
    },
    {
        timestamps: true
    }
);

infrastructureModel.index({ createUserId: 1 });

var Infrastructure = module.exports = mongoose.model('Infrastructure', infrastructureModel);

module.exports.createInfrastructure = function (newInfrastructure, callback) {
    newInfrastructure.save(callback);
};

module.exports.updateInfrastructure = function (query, values, callback) {
    Infrastructure.findOneAndUpdate(query, values, callback);
};

module.exports.removeInfrastructure = async function (query) {
    try {
        const result = await Infrastructure.findOneAndDelete(query);
        if (!result) {
            throw new Error("Infrastructure not found");
        }
        return result;
    } catch (error) {
        console.error(`[removeInfrastructure] Error:`, error.message);
        throw error;
    }
};
