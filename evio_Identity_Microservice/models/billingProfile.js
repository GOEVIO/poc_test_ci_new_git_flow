require("dotenv-safe").load();
const mongoose = require('mongoose');
const { billingProfileStatus } = require('../constants/env').default;

const { Schema } = mongoose;

const addressModel = new Schema(
    /*
    TODO look for this elements 
    address.address -> address.street
    address.postCode -> address.zipCode
    {
        address: { type: String },
        number: { type: String },
        postCode: { type: String },
        city: { type: String },
        country: { type: String },
        state: { type: String },
        countryCode: { type: String }
    }
    */
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


const billingProfileModel = new Schema(
    {
        id: { type: String, index: true },
        name: { type: String },
        billingName: { type: String },
        userId: { type: String },
        nif: { type: String },
        email: { type: String },
        billingAddress: { type: addressModel },
        viesVAT: { type: Boolean },
        monthlyBilling: {
            type: Boolean, default: false
        },
        billingPeriod: {
            type: String, default: 'AD_HOC'
        },
        invoiceWithoutPayment: {
            type: Boolean, default: false
        }/*,
        finalConsumer: {
            type: Boolean, default: false
        }*/,
        purchaseOrder: {
            type: String, default: ''
        },
        clientName: { type: String, default: "EVIO" },
        clientType: {
            type: String,
            enum: [process.env.CLIENTTYPEBILLINGPROFILEPRIVATECUSTOMER, process.env.CLIENTTYPEBILLINGPROFILEBUSINESSCUSTOMER],
            default: process.env.CLIENTTYPEBILLINGPROFILEPRIVATECUSTOMER
        },
        companyTaxIdNumber: { type: String },
        publicEntity: { type: Boolean, default: false },
        status: {
            type: String,
            enum: [billingProfileStatus.ACTIVE, billingProfileStatus.INACTIVE],
            default: billingProfileStatus.INACTIVE
        },
        paymentConditions: {
            type: String
        }
    },
    {
        timestamps: true
    }
);

billingProfileModel.index({ userId: 1 });

var BillingProfile = module.exports = mongoose.model('BillingProfile', billingProfileModel);

module.exports.createBillingProfile = function (newBillingProfile, callback) {
    newBillingProfile.save(callback);
};

module.exports.updateBillingProfile = function (query, values, options, callback) {
    BillingProfile.findOneAndUpdate(query, values, options, callback);
};

module.exports.removeBillingProfile = function (query, callback) {
    BillingProfile.findOneAndRemove(query, callback);
};