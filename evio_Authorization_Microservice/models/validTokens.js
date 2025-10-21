// TODO: Deprecate this model when there are no more active tokens
const mongoose = require('mongoose');

const { Schema } = mongoose;

const validTokensModel = new Schema(
    {
        id: { type: String, index: true },
        userId: { type: String },
        active: { type: Boolean },
        listOfTokens: [
            {
                token: { type: String },
                refreshtoken: { type: String },
                active: { type: Boolean },
            },
        ],
        clientName: { type: String, default: 'EVIO' },
    },
    {
        timestamps: true,
    }
);

validTokensModel.index({ listOfTokens: 1 });

const ValidTokens = (module.exports = mongoose.model(
    'ValidTokens',
    validTokensModel
));

module.exports.updateValidTokens = (query, values) => ValidTokens.findOneAndUpdate(query, values);
