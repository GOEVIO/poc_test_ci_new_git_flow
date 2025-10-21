const mongoose = require('mongoose');

require("dotenv-safe").load();


const { Schema } = mongoose;

//Image Category
// CHARGER          Photo of the physical device that contains one or more EVSEs.
// ENTRANCE         Location entrance photo. Should show the car entrance to the location from street side.
// LOCATION         Location overview photo.
// NETWORK          Logo of an associated roaming network to be displayed with the EVSE for example in lists, maps and detailed information views.
// OPERATOR         Logo of the charge point operator, for example a municipality, to be displayed in the EVSEs detailed information view or in lists and maps, if no network logo is present.
// OTHER            Other
// OWNER            Logo of the charge point owner, for example a local store, to be displayed in the EVSEs detailed information view.

const image = new Schema({
    url: { type: String },
    thumbnail: { type: String },
    category: { type: String },
    type: { type: String },
    width: { type: Number },
    height: { type: Number }
}, { _id: false });

const businessDetails = new Schema({
    name: { type: String },
    website: { type: String },
    logo: { type: image }
}, { _id: false });


const roles = new Schema({
    role: { type: String },
    party_id: { type: String },
    country_code: { type: String },
    business_details: { type: businessDetails }
}, { _id: false });

const versions = new Schema({
    version: { type: String },
    url: { type: String }
});

const endpoints = new Schema({
    identifier: { type: String },
    role: { type: String },
    url: { type: String }
});

const versionsDetails = new Schema({
    version: {
        type: String
    },
    endpoints: [endpoints]
});

const tokensHistory = new Schema({
    token: { type: String },
    createDate: { type: String },
    expiredDate: { type: String },
    version: { type: String },
});

const token = new Schema({
    token: { type: String },
    version: { type: String }
});


const connectionConfigsModel = new Schema({
    _id: false,
    host: { type: String },
    port: { type: String },
    username: { type: String },
    password: { type: String }
});


const platformsModel = new Schema({
    platformCode: {
        type: String
    },
    platformName: {
        type: String
    },
    party_id: {
        type: String
    },
    platformId: {
        type: String
    },
    cpo: {
        type: String
    },
    platformRoles: { type: [roles], default: [] },
    cpoRoles: [roles],
    platformVersions: { type: [versions], default: [] },
    platformDetails: { type: [versionsDetails], default: [] },
    platformVersionsEndpoint: {
        type: String, default: ""
    },
    platformDetailsEndpoint: {
        type: String, default: ""
    },
    tokenLength: { type: Number, default: 48 },
    cpoActiveCredentialsToken: { type: [token], default: [] }, //Token to access EVIO OCPI Platform
    cpoTokensHistory: { type: [tokensHistory], default: [] },
    cpoURL: { type: String },
    platformActiveCredentialsToken: { type: [token], default: [] }, //Token to access to 3º party OCPI Platform
    platformTokensHistory: { type: [tokensHistory], default: [] },
    credendialExchanged: { type: Boolean, default: false },
    generateNewTokenEndpointUpdate: { type: Boolean, default: false },
    generateNewTokenDeleteCredentials: { type: Boolean, default: true },
    active: { type: Boolean, default: false },
    source: { type: String },
    locationsScheduleTimeCronJob: { type: String, default: "*/30 * * * *" },
    locationsBulkLastUpdateDate: { type: Boolean, default: true },
    tariffsScheduleTimeCronJob: { type: String, default: "0 */12 * * *" },
    tariffsBulkLastUpdateDate: { type: Boolean, default: true },
    cdrsScheduleTimeCronJob: { type: String, default: "*/30 * * * *" },
    sftpCdrsScheduleTimeCronJob: { type: String },
    cdrsBulkLastUpdateDate: { type: Boolean },
    sessionsScheduleTimeCronJob: { type: String, default : "*/5 * * * *" },
    sessionsFetchPastHours: { type: String },
    responseUrlSessionRemoteStart: { type: String },
    locationsLastRequestDate: { type: String },
    tariffsLastRequestDate: { type: String },
    sessionsLastRequestDate: { type: String },
    cdrsLastRequestDate: { type: String },
    externalMobieLocationsEndpoint: { type: String },
    defaultOperatorId: { type: String },
    mobieSftpRemotePath: { type: String },
    sftpConnectionConfigs : { type: connectionConfigsModel },
},
    {
        timestamps: true
    }
);

var Platforms = module.exports = mongoose.model('platforms', platformsModel);


module.exports.create = function (newObject, callback) {
    newObject.save(callback);
};

module.exports.updatePlatform = function (query, values, callback) {

    Platforms.findOneAndUpdate(query, values, callback);
};

module.exports.addTokenHistory = function (query, values, callback) {

    Platforms.updateOne(query, values, callback);
};
