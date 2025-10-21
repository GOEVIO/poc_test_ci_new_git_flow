const mongoose = require('mongoose');
require("dotenv-safe").load();

const { Schema } = mongoose;

const geometryModel = new Schema(
    {
        location: {
            lat: { type: Number },
            lng: { type: Number }
        },
        viewport: {
            northeast: {
                lat: { type: Number },
                lng: { type: Number }
            },
            southwest: {
                lat: { type: Number },
                lng: { type: Number }
            }
        }
    }
);

const POIsModel = new Schema(
    {
        business_status: { type: String },
        geometry: { type: geometryModel },
        icon: { type: String },
        id: { type: String },
        name: { type: String },
        photos: { type: String },
        place_id: { type: String },
        plus_code: {
           compound_code: { type: String },
           global_code: { type: String }
        },
        rating: { type: Number },
        reference: { type: String },
        scope: { type: String },
        types: [
            { type: String },
        ],
        user_ratings_total: { type: Number },
        vicinity: { type: String }
    }
);



const managementPOIsModel = new Schema(
    {
        chargerId: { type: String },
        hwId:{ type: String },
        geometry: {
            type: { type: String, default: "Point" },
            coordinates: { type: [Number], index: "2dsphere" },
        },
        POIs: [{ type: POIsModel }],
        daysToUpdate:{ type: Number, default: 15 },
        clientName: { type: String, default: "EVIO" },

    },
    {
        timestamps: true
    }
);


managementPOIsModel.index({ geometry: "2dsphere" });


var ManagementPOIs = module.exports = mongoose.model('ManagementPOIs', managementPOIsModel);

module.exports.createManagementPOIs = function (newManagementPOIs, callback) {
    newManagementPOIs.save(callback);
};

module.exports.updateManagementPOIs = function (query, values, callback) {
    ManagementPOIs.findOneAndUpdate(query, values, callback);
};

module.exports.removeManagementPOIs = function (query, callback) {
    ManagementPOIs.findOneAndRemove(query, callback);
};