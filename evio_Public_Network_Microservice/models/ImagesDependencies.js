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

const imagesDependenciesModel = new Schema(
    {
        chargerId: { type: String },
        hwId: { type: String },
        imageContent: { type: String },
        status: { type: String, default: process.env.ImagesDependenciesOpen },
        userId: { type: String },
        createdBy: { type: String },
        geometry: {
            type: { type: String, default: "Point" },
            coordinates: { type: [Number], index: "2dsphere" },
        },
        address: { type: addressModel },
        chargerType: { type: String }
    },
    {
        timestamps: true
    }
);

imagesDependenciesModel.index({ geometry: "2dsphere" });

var ImagesDependencies = module.exports = mongoose.model('ImagesDependencies', imagesDependenciesModel);

module.exports.createImagesDependencies = function (newImagesDependencies, callback) {
    newImagesDependencies.save(callback);
};

module.exports.updateImagesDependencies = function (query, values, callback) {
    ImagesDependencies.findOneAndUpdate(query, values, callback);

};

module.exports.removeImagesDependencies = function (query, callback) {
    ImagesDependencies.findOneAndRemove(query, callback);
};