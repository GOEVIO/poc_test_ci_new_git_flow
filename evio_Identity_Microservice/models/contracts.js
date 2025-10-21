require("dotenv-safe").load();
const mongoose = require('mongoose');

const { Schema } = mongoose;

/*const addressModel = new Schema({
    city: { type: String },
    country: { type: String },
    countryCode: { type: String },
    address: { type: String },
    postCode: { type: String },
});*/

const addressModel = new Schema({
    street: { type: String },
    number: { type: String },
    floor: { type: String },
    zipCode: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String },
    countryCode: { type: String }
});

const tokenModel = new Schema({
    idTagHexa: { type: String },
    idTagHexaInv: { type: String },
    idTagDec: { type: String },
    refId: { type: String },
    tokenType: { type: String },
    status: { type: String },
    wasAssociated: { type: Boolean, default: false },
    created: { type: Boolean, default: false },
    tokenStatusHistory: {
      type: [
        {
          previousStatus: { type: String },
          newStatus: { type: String },
          updatedAt: { type: Date, default: Date.now },
          reason: { type: String },
          action: { type: String },
        }
      ],
      default: null,
    },
    deactivationReason: {
        type: [String],
        default: []
    },
});

const networkModel = new Schema({
    name: { type: String },
    network: { type: String },
    networkName: { type: String },
    paymentMethod: { type: String },
    tokens: [{ type: tokenModel }],
    hasJoined: { type: Boolean },
    isVisible: { type: Boolean, default: true }
});

const tarifModel = new Schema({
    planId: { type: String },
    power: { type: String }
})

const tariffRoamingModel = new Schema({
    planId: { type: String },
    power: { type: String },
    network: { type: String }
})

const tokensInternationalNetworkModel = new Schema({
    tokenType: { type: String },
    contract_id: { type: String }
})

const contractIdInternationalNetworkModel = new Schema({
    network: { type: String },
    tokens: [{ type: tokensInternationalNetworkModel }]
})

const contractsModel = new Schema(
    {
        id: { type: String, index: true },
        cardNumber: { type: String },
        cardName: { type: String },
        cardPhysicalName: { type: String },
        cardPhysicalLicensePlate: { type: String },
        cardPhysicalText: { type: String },
        cardPhysicalSendTo: { type: String },
        cardPhysicalInTheCareOf: { type: String },
        cardPhysicalState: { type: Boolean, default: false },
        cardPhysicalStateInfo: {
            type: String,
            enum: ['VIRTUALONLY', 'REQUESTEDBYCUSTOMER', 'CANCELEDBYEVIO', 'REQUESTEDTOTHIRDPARTY', 'ASSOCIATED', 'ACTIVE', 'CANCELEDBYCUSTOMER'],
            default: 'VIRTUALONLY'
        },
        name: { type: String },
        email: { type: String },
        nif: { type: String },
        mobile: { type: String },
        internationalPrefix: { type: String, default: "+351" },
        cardType: { type: String },
        fontCardBlack: { type: Boolean, default: false },
        imageCard: { type: String },
        address: { type: addressModel },
        shippingAddress: { type: addressModel },
        status: { type: String, default: 'active' },
        statusMessageKey: { type: String },
        networks: [{ type: networkModel }],
        imageCEME: { type: String },
        userId: { type: String },
        tariff: { type: tarifModel },
        //tariffRoaming: { type: tarifModel },
        tariffRoaming: [{ type: tariffRoamingModel }],
        default: { type: Boolean, default: false },
        contractType: { type: String },
        active: { type: Boolean, default: true },
        evId: { type: String },
        fleetId: { type: String },
        contract_id: { type: String },
        chargersAccessPermission: { type: Boolean },
        scheduledTokenActivationDate: { type: Date },
        contractIdInternationalNetwork: [{ type: contractIdInternationalNetworkModel }],
        clientName: { type: String, default: "EVIO" },
        cancelReason: { type: String },
        cancellationReason: {
            reason: {
                type: String,
                enum: ['OTHER', 'LOST', 'THEFT']
            },
            description: {
                type: String
            }
        },
        firstPhysicalCard: { type: Boolean, default: true },
        cardPhysicalPaymentStateInfo: {
            type: String,
            enum: ['FREE', 'CHARGEPAYMENT', 'PAYMENTFAILURE', 'PROCESSING', 'PAID'],
            default: 'FREE'
        },
        amountChargeToRequestPayent: {
            currency: { type: String, default: "EUR" },
            value: { type: Number, default: 4 }
        },
        requestDate: { type: Date },
        requestThirdPartyDate: { type: Date },
        processedThirdPartyDate: { type: Date },
        activationDate: { type: Date },
    },
    {
        timestamps: true
    }
);

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
};

contractsModel.index({ userId: 1 }, { background: true });
contractsModel.index({ active: 1, evId: 1 }, { background: true });

var Contracts = module.exports = mongoose.model('Contracts', contractsModel);

/**
 * @param {Contracts} newContract
 * @param {Function | undefined} callback - called if passed, else returns a promise that resolves the created contract
 */
module.exports.createContract = async function (newContract, callback) {
    //console.log("newContract", newContract);
    let random = getRandomInt(10000000000000, 99999999999999);
    newContract.cardNumber = "PTEVIOV" + random;

    if (callback) {
        return await newContract.save(callback);
    } else {
        return await newContract.save();
    }
};

module.exports.updateContract = function (query, values, callback) {
    Contracts.findOneAndUpdate(query, values, callback);
};

module.exports.updateContractWithFilters = function (query, values, filters, callback) {
    Contracts.findOneAndUpdate(query, values, filters, callback);
};

module.exports.removeContracts = function (query, callback) {
    Contracts.findOneAndRemove(query, callback);
};

module.exports.markAllAsNotDefault = function (userId, callback) {
    var query = { userId: userId };
    var newvalues = { $set: { default: false } };
    Contracts.updateMany(query, newvalues, callback);
};

module.exports.markAllAsInactive = async function (data, callback) {
    console.info(`[markAllAsInactive] | userId: ${data.userId}`);
    const query = { userId: data.userId };
    const newvalues = { $set: { status: process.env.ContractStatusInactive, statusMessageKey: data.message.key, active: false } };
    return await Contracts.updateMany(query, newvalues, callback);   
};

module.exports.markAllAsActive = async function (userId, callback) {
    var query = { userId: userId, cardPhysicalStateInfo: { $nin: [process.env.CARDPHYSICALSTATEINFOCANCELEDBYCUSTOMER, process.env.CARDPHYSICALSTATEINFOCANCELEDBYEVIO] } };
    var newvalues = { $set: { status: process.env.ContractStatusActive, statusMessageKey: "", active: true } };
    return await Contracts.updateMany(query, newvalues, callback)
};

module.exports.markAsDefaultContract = function (contractId, userId, callback) {
    var query = {
        _id: contractId,
        userId: userId
    };
    var newvalues = { $set: { default: true } };
    Contracts.updateOne(query, newvalues, callback);
};

module.exports.createContractCancelRFID = function (newContract, callback) {
    newContract.save(callback);
};

module.exports.updateStatusMessageKey = async function ({ userId, statusMessageKey }, callback) {
    return await Contracts.updateMany({ userId }, { $set: { statusMessageKey } }, callback);
};