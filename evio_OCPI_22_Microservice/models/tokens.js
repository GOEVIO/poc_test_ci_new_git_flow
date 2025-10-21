const mongoose = require('mongoose');

require("dotenv-safe").load();


const { Schema } = mongoose;

const energyContract = new Schema({
    supplier_name: { type: String },
    contract_id: { type: String }
});

const tokensModel = new Schema({
    source: { type: String },
    country_code: { type: String, default: "PT" },
    party_id: { type: String },
    uid: { type: String },
    type: { type: String, default: "RFID" }, //AD_HOC_USER       APP_USER      RFID
    contract_id: { type: String },
    issuer: { type: String },
    valid: { type: Boolean, default: true },
    userId: { type: String },
    evId: { type: String },
    whitelist: { type: String, default: "ALWAYS" }, //ALWAYS      ALLOWED     ALLOWED_OFFLINE     NEVER - Mobie only supports ALWAYS Type
    energy_contract: { type: energyContract },
    last_updated: { type: String }
},
    {
        timestamps: true
    }
);

tokensModel.index({ uid: 1 });

var Tokens = module.exports = mongoose.model('tokens', tokensModel);

module.exports.create = function (newObject, callback) {
    newObject.save(callback);
};


module.exports.updateToken = function (query, values, callback) {
    Tokens.findOneAndUpdate(query, values, callback);

};

