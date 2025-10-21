const mongoose = require('mongoose');
const { Schema } = mongoose;
var AutoIncrement = require('mongoose-sequence')(mongoose);

const PriceRoundSchema = new Schema({
  round_granularity: { type: String },
  round_rule: { type: String },
}, { _id: false });

const StepRoundSchema = new Schema({
  round_granularity: { type: String },
  round_rule: { type: String },
}, { _id: false });

const PriceComponentSchema = new Schema({
  type: { type: String },
  price: { type: Number},
  vat: { type: Number },
  step_size: { type: Number, default: 1 },
  price_round: { type: PriceRoundSchema },
  step_round: { type: StepRoundSchema },
}, { _id: false });

const RestrictionsSchema = new Schema({
  start_date: { type: String },
  end_date:   { type: String },
  start_time: { type: String }, 
  end_time:   { type: String }, 
  min_kwh: { type: Number},
  max_kwh: { type: Number},
  min_current: { type: Number },
  max_current: { type: Number },
  min_power: { type: Number },
  max_power: { type: Number },
  min_duration: { type: Number },
  max_duration: { type: Number },
  day_of_week: [{ type: String }],   
  reservation: { type: String },     
}, { _id: false });

const TariffElementSchema = new Schema({
  price_components: { type: [PriceComponentSchema]},
  restrictions: { type: RestrictionsSchema  },
}, { _id: false });

const PriceSchema = new Schema({
  excl_vat: { type: Number },
  incl_vat: { type: Number },
}, { _id: false });


const salesTariffModel = new Schema(
    {
        name: {
            type: String
        },
        tariffType: {
            type: String
        },
        tariff: {
            activationFee: {
                type: Number
            },
            bookingAmount: {
                uom: { type: String }, // Unit of measurement (s - seconds, min - minutes, h - hours)
                value: { type: Number } // Value
            },
            chargingAmount: {
                uom: { type: String }, // Unit of measurement (s - seconds, min - minutes, h - hours)
                value: { type: Number } // Value
            },
            parkingDuringChargingAmount: {
                uom: { type: String }, // Unit of measurement (s - seconds, min - minutes, h - hours)
                value: { type: Number } // Value
            },
            parkingAmount: {
                uom: { type: String }, // Unit of measurement (s - seconds, min - minutes, h - hours)
                value: { type: Number } // Value
            },
            evioCommission: {
                minAmount: {
                    uom: { type: String }, // Unit of measurement
                    value: { type: Number } // Value
                },
                transaction: {
                    uom: { type: String }, // Unit of measurement
                    value: { type: Number } // Value
                }
            }
        },
        billingType: {
            type: String
        },
        type: { type: String },
        currency: { type: String },
        min_price: { type: PriceSchema },
        max_price: { type: PriceSchema },
        elements: { type: [TariffElementSchema]},
    }
);

const priceModel = new Schema({
    excl_vat: { type: Number, default: 0 }, //Price/Cost excluding VAT.
    incl_vat: { type: Number, default: 0 } //Price/Cost including VAT.
});

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

const costDetailsModel = new Schema(
    {
        activationFee: { type: Number, default: 0 },
        parkingDuringCharging: { type: Number, default: 0 },
        parkingAmount: { type: Number, default: 0 },
        timeCharged: { type: Number, default: 0 },
        totalTime: { type: Number, default: 0 },
        totalPower: { type: Number, default: 0 },
        costDuringCharge: { type: Number, default: 0 },
        timeDuringParking: { type: Number, default: 0 }
    }
);

const purchaseTariffModel = new Schema(
    {

        name: {
            type: String
        },
        description: {
            type: String
        },
        tariffType: {
            type: String
        },
        userId: {
            type: String
        },
        weekSchedule: [
            {
                weekDay: { type: String },
                scheduleTime: [
                    {
                        value: { type: Number, default: 0 }, // Value
                        startTime: { type: String },
                        stopTime: { type: String }
                    }
                ]
            }
        ],
        purchaseTariffId: {
            type: String
        }
    }
);

const evKmsModel = new Schema(
    {
        kms: { type: Number },
        kmsDate: { type: Date },
        updatedKmsDate: { type: Date }
    }
)

const cpoTariffIdsModel = new Schema(
    {
        tariffId: { type: String },
        plugId: { type: String },
    }
)


const chargingSessionModel = new Schema(
    {
        id: { type: String, index: true },
        sessionId: { type: Number },
        hwId: { type: String },
        idTag: { type: String },
        cardNumber: { type: String },
        plugId: { type: String },
        userId: { type: String },
        fleetId: { type: String },
        deviceIdentifier: { type: String },
        evId: { type: String },
        invoiceType: { type: String },
        invoiceCommunication: { type: String },
        startDate: {
            type: Date,
            default: Date.now
        },
        stopDate: { type: Date },
        localStartDate: { type: Date },
        localStopDate: { type: Date },
        clientType: { type: String },
        command: { type: String },
        chargerType: { type: String },
        meterStart: { type: Number },
        meterStop: { type: Number },
        totalPower: { type: Number, default: 0 },
        sessionPrice: { type: Number },
        tariffId: { type: String },
        tariff: { type: salesTariffModel },
        estimatedPrice: { type: Number, default: 0 },
        totalPrice: { type: priceModel },
        finalPrice: { type: Number },
        batteryCharged: { type: Number, default: -1 },
        timeLeft: { type: Number },
        timeCharged: { type: Number, default: 0 },
        CO2Saved: { type: Number, default: 0 },
        model: { type: String },
        status: { type: String },
        parkingStartDate: {
            type: Date,
            default: Date.now
        },
        parkingStopDate: {
            type: Date,
            default: Date.now
        },
        rating: { type: Number },
        bookingId: { type: String },
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
        feedBack: [
            {
                questionCode: { type: String },
                value: { type: Number },
                auxiliaryText: { type: String }
            }
        ],
        feedBackText: { type: String },
        stoppedByOwner: { type: Boolean, default: false },
        stopReason: {
            reasonCode: { type: String },
            reasonText: { type: String }
        },
        autoStop: {
            uom: { type: String }, // Unit of measurement (time, power, cost)
            value: { type: Number } // Value
        },
        counter: { type: Number, default: 0 },
        downtime: { type: Number },
        uptime: { type: Number },
        paymentId: { type: String },
        chargerOwner: { type: String },
        evOwner: { type: String },
        paymentMethod: { type: String },//wallet, card, notPay
        paymentMethodId: { type: String },
        walletAmount: { type: Number },
        reservedAmount: { type: Number },
        confirmationAmount: { type: Number },
        userIdWillPay: { type: String },
        userIdToBilling: { type: String },
        adyenReference: { type: String },
        transactionId: { type: String },
        paymentStatus: { type: String, default: "UNPAID" },//PAID, UNPAID, NA, CANCELED
        paymentType: { type: String }, //AD_HOC/MONTHLY
        paymentNotificationStatus: { type: Boolean, default: false },
        address: { type: addressModel },
        timeZone: { type: String },
        // startedBy : { type: String  , default: 'StartTransaction'}, // StartTransaction , StatusNotification
        fees: {
            IEC: { type: Number },
            IVA: { type: Number },
            countryCode: { type: String }
        },
        invoiceId: { type: String },//DocmentId from invoice
        invoiceStatus: { type: Boolean, default: false },//Status of the invoice
        authType: { type: String, default: 'APP_USER' }, // APP_USER , RFID
        sessionSync: { type: Boolean, default: false },
        stopTransactionReceived: { type: Boolean, default: false },
        costDetails: { type: costDetailsModel },
        purchaseTariff: { type: purchaseTariffModel },
        billingPeriod: { type: String, default: "AD_HOC" },
        purchaseTariffDetails: {
            excl_vat: { type: Number, default: 0 }, //Price/Cost excluding VAT.
            incl_vat: { type: Number, default: 0 }, //Price/Cost including VAT.
            kwhListAverage: [{ type: Number }]
        },
        clientName: { type: String, default: "EVIO" },
        endOfEnergyDate: { type: String },
        freeOfCharge: { type: Boolean, default: false },
        createdWay: { type: String }, // CONTROLCENTER,WEBCLIENT,APP ,RFID. This was created just to know when an operator makes charging sessions through control center
        notes: { type: String }, // Notes that on operator can give when starting a chargign session through control center.
        b2bComissioned: { type: Boolean, default: false },
        network: { type: String, default: "EVIO" },
        //I'm creating the variables in snake casing because they're specific of the OCPI implementation
        country_code: { type: String },
        party_id: { type: String },
        cdr_token: { type: Object },
        auth_method: { type: String },
        response_url_start: { type: String },
        response_url_stop: { type: String },
        authorization_reference: { type: String },
        currency: { type: String, default: "EUR" },
        location_id: { type: String },
        evse_uid: { type: String },
        connector_id: { type: String },
        ocpiId: { type: String },
        operatorId: { type: String },
        cdrId: { type: String },
        plafondId: { type: String, default: "-1" },
        syncToPlafond: { type: Boolean, default: false },
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
        cpoTariffIds: [ cpoTariffIdsModel ],
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
    },
    {
        timestamps: true
    }
);

chargingSessionModel.index({ userCoordinates: "2dsphere", sparse: true });

chargingSessionModel.plugin(AutoIncrement, { id: 'order_seq', inc_field: 'sessionId' });

var ChargingSession = module.exports = mongoose.model('ChargingSession', chargingSessionModel);


module.exports.createChargingSession = function (newChargingSession, callback) {
    //console.log(newChargingSession);
    newChargingSession.save(callback);
};

module.exports.updateChargingSession = function (query, values, callback) {

    ChargingSession.findOneAndUpdate(query, values, { new: true }, callback);
};

module.exports.addReadPoint = function (query, values, callback) {

    ChargingSession.updateOne(query, values, callback);
};
