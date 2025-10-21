const mongoose = require('mongoose');
require("dotenv-safe").load();

const { Schema } = mongoose;

const listModel = new Schema({
    idTag: {
        type: String,
    },
    idTagInfo: {
        expiryDate : {type : Date},
        parentIdTag : { type : String },
        status : { type : String } // Accepted , Blocked, Expired, Invalid, ConcurrentTx
    },
});

const LocalAuthorizationListsModel = new Schema({
    hwId : { type : String },
    listVersion : { type : Number },
    localAuthorizationList : [
        listModel
    ],
    lastUpdated : { 
        type: Date, 
        default: Date.now 
    }
})

LocalAuthorizationListsModel.index({ hwId: 1 });

const LocalAuthorizationList = module.exports = mongoose.model('LocalAuthorizationList', LocalAuthorizationListsModel);

module.exports.findList = function (query) {
    return LocalAuthorizationList.findOne(query);
};
module.exports.upsertLocalAuthorizationLists = function (query, values ) {
    return LocalAuthorizationList.findOneAndUpdate(query, values, {new:true,upsert:true});
};

module.exports.updateLocalAuthorizationList = function (query, values ) {
    return LocalAuthorizationList.updateOne(query, values);
};