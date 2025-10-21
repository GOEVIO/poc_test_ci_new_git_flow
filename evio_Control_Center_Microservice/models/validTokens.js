const mongoose = require('mongoose');

const { Schema } = mongoose;

const validTokensModel = new Schema(
    {
        id: { type: String, index: true },
        userId: { type: String },
        //token: { type: String },
        //refreshtoken: { type: String },
        active: { type: Boolean },
        listOfTokens:[
            {
                token: { type: String },
                refreshtoken: { type: String },
                active: { type: Boolean },
            }
        ]

    },
    {
        timestamps: true
    }
);

var ValidTokens = module.exports = mongoose.model('ValidTokens', validTokensModel);

module.exports.createValidTokens = function (newValidTokens, callback) {
    newValidTokens.save(callback);
};

module.exports.updateValidTokens = function (query, values, callback) {
    ValidTokens.findOneAndUpdate(query, values, callback);
};

module.exports.removeValidTokens = function (query, callback) {
    ValidTokens.findOneAndRemove(query, callback);
};