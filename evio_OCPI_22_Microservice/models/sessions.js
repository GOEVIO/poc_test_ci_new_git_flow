const mongoose = require('mongoose');


require("dotenv-safe").load();


const { Schema } = mongoose;


const tariffTranslation = new Schema({
    language: { type: String },
    text: { type: String }
});

const priceModel = new Schema({
    excl_vat: { type: Number }, //Price/Cost excluding VAT.
    incl_vat: { type: Number } //Price/Cost including VAT.
});

const priceRoundModel = new Schema({
    round_granularity: { type: String, default: "THOUSANDTH" }, // Can take values “UNIT”, “TENTH”, “HUNDREDTH” or “THOUSANDTH”
    round_rule: { type: String, default: "ROUND_NEAR" } // Can take values “ROUND_UP”, “ROUND_DOWN” or “ROUND_NEAR”
});

const stepRoundModel = new Schema({
    round_granularity: { type: String, default: "UNIT" }, // Can take values “UNIT”, “TENTH”, “HUNDREDTH” or “THOUSANDTH”
    round_rule: { type: String, default: "ROUND_UP" } // Can take values “ROUND_UP”, “ROUND_DOWN” or “ROUND_NEAR”
});

const priceComponent = new Schema({
    type: { type: String }, //ENERGY    FLAT    PARKING_TIME    TIME
    price: { type: Number }, //Price per unit (excl. VAT) for this tariff dimension.
    vat: { type: Number }, //Applicable VAT percentage for this tariff dimension. If omitted, no VAT is applicable. Not providing a VAT is different from 0% VAT, which would be a value of 0.0 here.
    step_size: { type: Number }, //Minimum amount to be billed. This unit will be billed in this step_siz blocks. For example: if type is TIME and step_size has a value of 300, then time will be billed in blocks of 5 minutes. If 6 minutes were used, 10 minutes (2 blocks of step_size) will be billed.
    price_round: priceRoundModel,
    step_round: stepRoundModel
});

const tariffRestrictions = new Schema({
    start_date: { type: String }, //Mobie
    end_date: { type: String }, //Mobie
    start_time: { type: String }, //Mobie
    end_time: { type: String }, //Mobie
    min_kwh: { type: Number }, //Mobie
    max_kwh: { type: Number }, //Mobie
    min_current: { type: Number },
    max_current: { type: Number },
    min_power: { type: Number },
    max_power: { type: Number },
    min_duration: { type: Number }, //Mobie
    max_duration: { type: Number }, //Mobie
    day_of_week: [String], //Mobie
    reservation: { type: String }
});


const tariffElements = new Schema({
    price_components: [priceComponent],
    restrictions: { type: tariffRestrictions }
});

const tariffsOPCModel = new Schema({
    country_code: { type: String, default: "PT" },
    party_id: { type: String },
    id: { type: String, index: true },
    currency: { type: String, default: "EUR" },
    type: { type: String }, //REGULAR OR AD_HOC_PAYMENT
    tariff_alt_text: [tariffTranslation], //This field may be used by the CPO to communicate any relevant discounts.
    min_price: { type: priceModel },
    elements: [tariffElements],
    start_date_time: { type: String, default: Date.now },
    end_date_time: { type: String, default: Date.now },
    last_updated: { type: String }
},
    {
        timestamps: true
    }
);

const cdrToken = new Schema({
    uid: { type: String },
    type: { type: String },
    contract_id: { type: String }
});


const cdrDimension = new Schema({
    type: { type: String },
    volume: { type: Number }
});


const chargingPeriods = new Schema({
    start_date_time: { type: String },
    dimensions: [cdrDimension],
    tariff_id: { type: String }
});

// const priceModel = new Schema({
//     excl_vat: { type: Number }, //Price/Cost excluding VAT.
//     incl_vat: { type: Number } //Price/Cost including VAT.
// });

const displayMessage = new Schema({
    language: { type: String },
    text: { type: String }
});


var tariffModel = mongoose.Schema({
    power: { type: String },
    uom: { type: String },
    type: { type: String },
    tariffType: { type: String },
    voltageLevel: { type: String },
    price: { type: Number }
});

var tariffsHistoryModel = mongoose.Schema({
    startDate: { type: String },
    stopDate: { type: String },
    tariff: [{ type: tariffModel }],
});

const tariffCEMEModel = new Schema(
    {
        country: { type: String },
        region: { type: String },
        currency: { type: String },
        partyId: { type: String },
        evseGroup: { type: String },
        CEME: { type: String },
        tariffType: { type: String },
        cycleType: { type: String },
        planName: { type: String },
        tariff: [tariffModel],
        tariffEGME: { type: Number },
        tariffsHistory: [{ type: tariffsHistoryModel }],
        activationFee: {
            currency: { type: String, default: "EUR" },
            value: { type: Number }
        },
        activationFeeAdHoc: {
            currency: { type: String, default: "EUR" },
            value: { type: Number }
        }

    }
);

const dimensionsPriceDetailModel = {
    flatPrice: { type: priceModel },
    timePrice: { type: priceModel },
    powerPrice: { type: priceModel },
    parkingTimePrice: { type: priceModel }
}

const finalPricesModel = new Schema(
    {
        opcPrice: { type: priceModel },
        opcPriceDetail: { flatPrice: { type: priceModel }, timePrice: { type: priceModel }, powerPrice: { type: priceModel }, parkingTimePrice: { type: priceModel } },
        cemePrice: { type: priceModel },
        cemePriceDetail: { flatPrice: { type: priceModel }, timePrice: { type: priceModel }, powerPrice: { type: priceModel } },
        tarPrice: { type: priceModel },
        iecPrice: { type: priceModel },
        vatPrice: { vat: { type: Number }, value: { type: Number } },
        othersPrice: [{ description: { type: String }, price: { type: priceModel } }],
        dimensionsPriceDetail : dimensionsPriceDetailModel,
        totalPrice: { type: priceModel },
    }
);

const invoiceLineModel = new Schema({
    code: { type: String },
    description: { type: String },
    unitPrice: { type: Number },
    uom: { type: String },
    quantity: { type: Number },
    vat: { type: Number },
    discount: { type: Number },
    total: { type: Number },
    taxExemptionReasonCode: { type: String}
},
    {
        timestamps: true
    }
);

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

const schedulesModel = new Schema(
    {
        period: { type: String },
        weekDays: { type: String },
        season: { type: String },
        tariffType: { type: String },
        startTime: { type: String },
        endTime: { type: String },
    }
);

const schedulesCEMEModel = new Schema(
    {
        id: { type: String, index: true },
        country: { type: String },
        tariffType: { type: String },
        cycleType: { type: String },
        schedules: [{ type: schedulesModel }]
    }
);

var tarTariffModel = mongoose.Schema(
    {
        uom: { type: String },
        tariffType: { type: String },
        voltageLevel: { type: String },
        price: { type: Number }
    }
);

const tariffTARModel = new Schema(
    {
        id: { type: String, index: true },
        country: { type: String, default: "PT" },
        timeZone: { type: String },
        tariffType: { type: String },
        tariff: [{ type: tarTariffModel }]
    }
);

const evKmsModel = new Schema(
    {
        kms: { type: Number },
        kmsDate: { type: Date },
        updatedKmsDate: { type: Date }
    }
)

const sessionsModel = new Schema({
    userId: { type: String },
    evId: { type: String },
    evOwner: { type: String },
    invoiceType: { type: String },
    invoiceCommunication: { type: String },
    deviceIdentifier: { type: String },
    operator: { type: String },
    chargeOwnerId: { type: String },
    chargerType: { type: String, default: "004" },
    source: { type: String },
    country_code: { type: String, default: "PT" },
    party_id: { type: String },
    id: { type: String, index: true },
    start_date_time: { type: String },
    end_date_time: { type: String },
    local_start_date_time: { type: String },
    local_end_date_time: { type: String },
    kwh: { type: Number },
    cdr_token: { type: cdrToken },
    auth_method: { type: String }, //WHITELIST
    token_uid: { type: String },
    token_type: { type: String },
    location_id: { type: String },
    evse_uid: { type: String },
    connector_id: { type: String },
    currency: { type: String },
    charging_periods: [chargingPeriods],
    readingPoints: [
        {
            totalPower: { type: Number },
            instantPower: { type: Number },
            readDate: {
                type: Date,
                default: Date.now
            },
            communicationDate: { type: Date },
            batteryCharged: { type: Number },
            instantVoltage: { type: Number },
            instantAmperage: { type: Number }
        }
    ],
    total_cost: { type: priceModel },
    status: { type: String },
    authorization_reference: { type: String },
    responseTimeout: { type: Number },//seconds
    displayText: { type: displayMessage },
    statusCode: { type: String },
    suspensionReason: { type: String, required: false },
    commandResultStart: { type: String },
    commandResultStop: { type: String },
    notes: { type: String },
    last_updated: { type: String },
    stoppedByOwner: { type: Boolean, default: false },
    rating: { type: Number },
    command: { type: String },
    cdrId: { type: String , default: "-1"},
    paymentId: { type: String }, //Internal id of payments table
    paymentStatus: { type: String, default: "UNPAID" }, //PAID/UNPAID/NA/CANCELED
    paymentSubStatus: { type: String },
    paymentType: { type: String }, //AD_HOC/MONTHLY
    paymentMethod: { type: String }, //wallet/card/notPay
    paymentMethodId: { type: String },
    walletAmount: { type: Number },
    reservedAmount: { type: Number },
    confirmationAmount: { type: Number },
    userIdWillPay: { type: String },
    userIdToBilling: { type: String },
    adyenReference: { type: String },
    transactionId: { type: String },
    invoiceStatus: { type: Boolean, default: false }, //true - Processed; false - Error
    invoiceSubStatus: { type: String, },
    invoiceId: { type: String },
    newInvoiceId: { type: String, required: false },
    invoiceLines: [invoiceLineModel],
    autoStop: {
        uom: { type: String }, // Unit of measurement (time, power, cost)
        value: { type: Number } // Value
    },
    feedBack: [
        {
            questionCode: { type: String },
            value: { type: Number },
            auxiliaryText: { type: String }
        }
    ],
    feedBackText: { type: String },
    batteryCharged: { type: Number, default: -1 },
    timeCharged: { type: Number, default: 0 },
    CO2Saved: { type: Number, default: 0 },
    totalPower: { type: Number }, //Wh
    tariffOPC: { type: tariffsOPCModel },
    tariffCEME: { type: tariffCEMEModel },
    finalPrices: { type: finalPricesModel },
    voltageLevel: { type: String, default: "BTN" },
    timeZone: { type: String },
    viesVAT: { type: Boolean, default: false },
    sessionSync: { type: Boolean, default: false },
    fees: {
        IEC: { type: Number },
        IVA: { type: Number },
        countryCode: { type: String }
    },
    minimumBillingConditions: { type: Boolean, default: true },
    address: { type: addressModel },
    cpoCountryCode: { type: String },
    unlockResult: { type: Boolean, default: false },
    billingPeriod: { type: String, default: "AD_HOC" },
    createdWay: { type: String },
    clientName: { type: String, default: "EVIO" },
    endOfEnergyDate: { type: String },
    schedulesCEME: { type: schedulesCEMEModel },
    tariffTAR: { type: tariffTARModel },
    plugPower: { type: Number },
    roamingTransactionID: { type: String },    // field used to save Hubject session ID, or others session ID's from roaming platforms
    roamingTariffID: { type: String },        // field used to save Hubject Tariff ID, or others session ID's from roaming platforms
    roamingOperatorID: { type: String },
    roamingStartEnergy: { type: String },      // KW in the case that the metervalues don't come in partial number (starting with value 0)
    roamingStopCharging: { type: String },      // the Date that stop charging
    roamingCO2: { type: String },              // this is going to be usen by Hubject and gives the total CO2 emited by the energy source, in g/kWh
    plugVoltage: { type: Number },
    plafondId: { type: String, default: "-1" },
    cardNumber: { type: String },
    syncToPlafond: { type: Boolean, default: false },
    discount: { type: Number },
    clientType: { type: String },
    evDetails: { type: Object },
    fleetDetails: { type: Object },
    userIdInfo: { type: Object },
    userIdWillPayInfo: { type: Object },
    userIdToBillingInfo: { type: Object },
    notificationsHistory: [
        {
            type: { type: String },
            timestamp: { type: String },
            totalPower: { type: Number },
        }
    ],
    acceptKMs: { type: Boolean, default: false },
    updateKMs: { type: Boolean, default: false },
    evKms: { type: evKmsModel },
    reservationPay: { type: Boolean, default: false },
    userCoordinates: {
        type: {
            type: String,
            default: "Point"
        },
        coordinates: {
            type: [Number],
            default: [0,0]
        }
    },
    message: { type: String, required: false },
    errorType: { type: String, required: false },
    commandResponseDate: {
        type: Date,
        required: false,
    },
    tariffADHOC: { type: Object, required: false }
},
    {
        timestamps: true
    }
);

/*
                                            Session status

ACTIVE              The session has been accepted and is active. All pre-conditions were met: Communication
between EV and EVSE (for example: cable plugged in correctly), EV or driver is authorized. EV is
being charged, or can be charged. Energy is, or is not, being transfered.

COMPLETED           The session has been finished successfully. No more modifications will be made to the Session
object using this state.


INVALID             The Session object using this state is declared invalid and will not be billed.


PENDING             The session is pending, it has not yet started. Not all pre-conditions are met. This is the initial state.
The session might never become an active session.

RESERVATION         The session is started due to a reservation, charging has not yet started. The session might never
become an active session.

*/
sessionsModel.index({ id: 1 } , { unique: true, sparse: true });
// sessionsModel.index({ _id: 1 });
sessionsModel.index({ userCoordinates: "2dsphere", sparse: true });

var Sessions = module.exports = mongoose.model('chargingsessions', sessionsModel);

module.exports.create = function (newObject, callback) {
    newObject.save(callback);
};


module.exports.updateSession = function (query, values, callback) {
    Sessions.findOneAndUpdate(query, values, { new: true }, callback);


};

