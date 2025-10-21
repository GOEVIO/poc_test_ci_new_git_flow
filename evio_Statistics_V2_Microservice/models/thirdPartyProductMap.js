const mongoose = require('mongoose');
const { Enums } = require('evio-library-commons').default;

const { Schema } = mongoose;

const thirdPartyProductMapModel = new Schema(
    {
        code: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            required: true,
        },
        thirdPartyCode: {
            type: String,
            required: true,
            index: true,
        },
        thirdParty: {
            type: String,
            enum: Object.values(Enums.ThirdParties),
            required: true,
        },
    },
    {
        timestamps: true
    }
);

thirdPartyProductMapModel.index({ code: 1, thirdPartyCode: 1 }, { unique: true });

const ThirdPartyProductMap = mongoose.model('ThirdPartyProductMaps', thirdPartyProductMapModel);

module.exports.findOneThirdPartyProductMap = async (query) => {
    return ThirdPartyProductMap.findOne(query).lean();
};
