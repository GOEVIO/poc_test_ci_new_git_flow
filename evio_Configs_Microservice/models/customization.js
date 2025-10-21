const mongoose = require('mongoose');

const { Schema } = mongoose;

const IconsModel = new Schema(
    {
        principalIcon: { type: String },//svg
        mapIcons: { type: Object },//svg
        favicon: { type: String },//png or ico
        cards: { type: Object },
        walletIcon: { type: String },//svg,
        logo: { type: String },//png,
        qrcodeIcon: [{ type: String }],//svg,
    }
);

const ColorsModel = new Schema(
    {
        primaryColor: { type: String },//HEX
        secondaryColor: { type: String },//HEX
        reportsColumColor: { type: String },//HEX
        walletColorBackGround: { type: String },//HEX
        walletColorAddValues: { type: String },//HEX
    }
);

const CustomizationModel = new Schema(
    {
        id: { type: String, index: true },
        brandName: { type: String },
        brandNameMap: { type: String },
        tokenMapBox: { type: String },
        endpointToSupport: { type: String },
        endpointToPrivacy: { type: String },
        endpointToTermsAndConditions: { type: String },
        baseURL: { type: String },
        icons: { type: IconsModel },
        colors: { type: ColorsModel },
        clientName: { type: String, default: "EVIO" },
        additionalInformation: {
            address: { type: String },
            city: { type: String },
            mobile: { type: String },
            email: { type: String },
        },
        brandTitle: { type: String }

    },
    {
        timestamps: true
    }
);

var Customization = module.exports = mongoose.model('customization', CustomizationModel);

module.exports.createCustomization = function (newCustomization, callback) {
    newCustomization.save(callback);
};

module.exports.updateCustomization = function (query, values, callback) {
    Customization.findOneAndUpdate(query, values, { new: true }, callback);
};

module.exports.removeCustomization = function (query, callback) {
    Customization.findOneAndRemove(query, callback);
};