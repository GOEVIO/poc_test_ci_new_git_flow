const mongoose = require('mongoose');
require("dotenv-safe").load();
var AutoIncrement = require('mongoose-sequence')(mongoose);


const { Schema } = mongoose;

const costByPowerModel = new Schema({
    id: { type: String },
    cost: { type: Number },
    uom: { type: String }
});

const costByTimeModel = new Schema({
    id: { type: String },
    minTime: { type: Number },
    maxTime: { type: Number },
    cost: { type: Number },
    uom: { type: String },
    description: { type: String }
});

const serviceCostModel = new Schema({
    id: { type: String },
    initialCost: { type: Number },
    costByTime: [{ type: costByTimeModel }],
    costByPower: { type: costByPowerModel },

});

const rangesModel = new Schema({
    startTime: { type: String },
    endTime: { type: String }
});

const dayModel = new Schema({
    isSelected: { type: Boolean },
    availabilityDay: { type: String },
    ranges: [
        rangesModel
    ]
});

const availabilityModel = new Schema({
    availabilityType: { type: String },
    monday: { type: dayModel },
    tuesday: { type: dayModel },
    wednesday: { type: dayModel },
    thursday: { type: dayModel },
    friday: { type: dayModel },
    saturday: { type: dayModel },
    sunday: { type: dayModel }
});

const tariffModel = new Schema({
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
});

const tariffIdsModel = new Schema({
    tariffId: { type: String },
    network: { type: String },
});

const balancingInfoSchema = new Schema({
    priority: { type: String },                                 // the priority of this plug in relation to the group plug he is in  (1 - VIP, 2 - Normal) (Used for OPC-UA)                                    
    electricalGroup: { type: Number },                          // the iD of the electrical group this plug is, ( used for OPC-UA -> this is fundamental to be able to do energy management
    //chargerGroup: { type: Number },
    operationalState: { type: String },                         // State of the plug (0 - communication fault, 1 - available, 2 - charging, 3 - fault) 
    setCurrentLimit: { type: Number },                          // Set Current limit (A) of this plug per phase
    currentLimit: { type: Number },                             // Current limit (A) of this plug per phase
    power: { type: Number },                                    // Power being measure by the plug (kW)
    powerMax: { type: Number },                                 // Max Power limit to the plug (kW)
    totalCurrent: { type: Number },                             // Current being measure by the plug (A)
    current1: { type: Number },                                 // Current being measure by the plug  on phase 1 (A)
    current2: { type: Number },                                 // Current being measure by the plug  on phase 2 (A)
    current3: { type: Number },                                 // Current being measure by the plug  on phase 3 (A)
    currentPerPhase: { type: Number },                          // Current being calculated to be pass in each charging phase.
    voltage1: { type: Number },                                 // Tension being measure by the plug on phase 1 (V)
    voltage2: { type: Number },                                 // Tension being measure by the plug on phase 2 (V)
    voltage3: { type: Number },                                 // Tension being measure by the plug on phase 3 (V)
    voltage: { type: Number },                                  // Average Tension being measure by the plug (V)
    dailyEnergy: { type: Number },                              // Energy consumed that day
    energy: { type: Number },                                   // Energy consumed kW/h
    browseName: { type: String },                               //  is used to store the name attribute to this plug (used in OPC-UA)
    isWithError: { type: Boolean, default: false },             // Flag to indicate if the plug has some error
    isOnline: { type: Boolean, default: false },                // Flag to indicate if the plug is communicating with the controller
    lastMeasurement: { type: Date },                            // Last time the plug was measured
    controlType: { type: String },                              // Type of control (Auto, Manual, Off and Boost)
    minActivePower: { type: Number },                           // Min Active Power limit to the plug (kW)
    numberOfPhases: { type: Number },                           // Number of phases being used in the charging session
});

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


const plugsModel = new Schema({
    plugId: { type: String },
    qrCodeId: { type: String },
    //tariff: { type: String },
    tariff: [
        {
            groupName: { type: String },
            groupId: { type: String },
            tariffId: { type: String },
            fleetName: { type: String },
            fleetId: { type: String },
            tariff: { type: tariffModel },
            tariffType: { type: String },
            name: { type: String },
            type: { type: String },
            currency: { type: String },
            min_price: { type: PriceSchema },
            max_price: { type: PriceSchema },
            elements: { type: [TariffElementSchema]},
        }
    ],
    connectorType: { type: String },
    voltage: { type: Number },
    amperage: { type: Number },
    power: { type: Number },
    active: { type: Boolean },
    status: { type: String, default: process.env.ChargePointStatusEVIO },
    statusChangeDate: { type: Date },
    statusTime: { type: Number },
    subStatus: { type: String },
    serviceCost: { type: serviceCostModel },
    canBeNotified: { type: Boolean },
    canBeAutomaticallyBooked: { type: Boolean },
    mySession: { type: String },
    lastUsed: { type: String },
    internalRef: { type: String },
    connectorFormat: { type: String },
    hasRemoteCapabilities: { type: Boolean, default: true },   // this flag will indicate that this plug has or not the abilitie to accept start/stop remote commands
    powerType: { type: String },
    tariffIds: { type: [tariffIdsModel], default: [] },
    evseStatus: [
        {
            network: { type: String },
            status: { type: String },
        }
    ],
    balancingInfo: { type: balancingInfoSchema },
},
    { timestamps: true }
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

const networkModel = new Schema({
    name: { type: String },
    network: { type: String },
    networkName: { type: String },
    status: { type: String },
    id: { type: String },
    activationRequest: { type: Boolean, default: false },
    publish: { type: Boolean, default: true },
    party_id: { type: String },
    country_code: { type: String },
});

const filesModel = new Schema({
    name: { type: String },
    type: { type: String },
    content: { type: String },
    lastUpdated: { type: String }
});

const diagnosticsModel = new Schema({
    content: { type: String },
    lastUpdated: { type: String },
});

const chargerModel = new Schema(
    {
        id: { type: String, index: true },
        hwId: { type: String },
        serialNumber: { type: String },
        endpoint: { type: String },
        meterValueSampleInterval: { type: String },
        chargePointSerialNumber: { type: String },
        firmwareVersion: { type: String },
        iccid: { type: String },
        imsi: { type: String },
        meterSerialNumber: { type: String },
        meterType: { type: String },
        vendor: { type: String },
        model: { type: String },
        name: { type: String, index: true },
        parkingType: { type: String },
        vehiclesType: [
            {
                vehicle: { type: String }
            }
        ],
        timeZone: { type: String },
        address: { type: addressModel },
        facilitiesTypes: [],
        geometry: {
            type: { type: String, default: "Point" },
            coordinates: { type: [Number], index: "2dsphere" },
        },
        instantBooking: { type: Boolean },
        availability: { type: availabilityModel },
        plugs: [{ type: plugsModel }],
        accessType: { type: String, default: process.env.ChargerAccessPrivate },
        listOfGroups: [
            {
                groupName: { type: String },
                groupId: { type: String }
            }
        ],
        active: { type: Boolean, default: false },
        rating: { type: Number, default: 0 },
        numberOfSessions: { type: Number, default: 0 },
        chargerType: { type: String },
        status: { type: String, default: process.env.ChargePointStatusEVIOFaulted },
        substatus: { type: String },//new - AVAILABLE/OCCUPIED/REMOVED/PLLANED
        operationalStatus: { type: String },//new - APPROVED/WAITINGAPROVAL/REMOVED
        netStatus: { type: Boolean, default: false },
        infrastructure: { type: String },
        hasInfrastructure: { type: Boolean, default: true },
        chargingDistance: { type: String, default: "1000" },
        imageContent: [{ type: String }],
        defaultImage: { type: String },
        createUser: { type: String },
        createdBy: { type: String },
        operatorId: { type: String },
        modifyUser: { type: String },
        infoPoints: { type: String },
        heartBeat: { type: Date, default: Date.now },
        heartBeatInterval: { type: Number, default: 300 },
        bookings: { type: Array },
        requireConfirmation: { type: Boolean },
        allowRFID: { type: Boolean, default: false },
        wifiPairingName: { type: String },
        parkingSessionAfterChargingSession: { type: Boolean, default: true },
        network: { type: String, default: "EVIO" },
        partyId: { type: String },
        operator: { type: String },
        stationIdentifier: { type: String },
        manufacturer: { type: String },
        listOfFleets: [
            {
                fleetName: { type: String },
                fleetId: { type: String }
            }
        ],
        offlineNotification: { type: Boolean },
        offlineEmailNotification: { type: String },
        mapVisibility: { type: Boolean, default: true },
        wrongBehaviorStation: { type: Boolean, default: false },
        purchaseTariff: { type: purchaseTariffModel, default: null},
        internalInfo: { type: String },
        CPE: { type: String },
        clientName: { type: String, default: "EVIO" },
        networks: [{ type: networkModel }],
        voltageLevel: { type: String, default: "BTN" },
        locationType: { type: String },
        energyOwner: { type: String },
        CSE: { type: String },
        energyNotes: { type: String },
        supplyDate: { type: String },
        installationDate: { type: String },
        goLiveDate: { type: String },
        warranty: { type: String },
        expiration: { type: String },
        preCheck: { type: String },
        generateAction: { type: String },
        acquisitionNotes: { type: String },
        expectedLife: { type: String },
        MTBF: { type: String },
        workedHours: { type: String },
        lifeCycleStatus: { type: String },
        notify: { type: String },
        lifeCycleNotes: { type: String },
        siteLicense: { type: String },
        legalLicenseDate: { type: String },
        legalLicenseExpiry: { type: String },
        legalSiteReminder: { type: String },
        legalSiteNotes: { type: String },
        inspection: { type: String },
        lastInspection: { type: String },
        nextInspection: { type: String },
        legalInspectionReminder: { type: String },
        legalInspectionNotes: { type: String },
        connectionType: { type: String },
        connectionOperator: { type: String },
        connectionAPN: { type: String },
        connectionLastLocationUpdate: { type: String },
        connectionIpAddress: { type: String },
        connectionDeviceId: { type: String },
        connectionIMEILock: { type: String },
        connectionIMEINumber: { type: String },
        connectionDataComunicationChart: { type: String },
        connectionStatus: { type: String },
        connectionBlockedOperators: { type: String },
        connectionConnectedNetwork: { type: String },
        connectionTAGs: { type: String },
        connectionIMSI: { type: String },
        connectionMSISDN: { type: String },
        connectionICCID: { type: String },
        connectionStats: { type: String },
        connectionDataTotal: { type: String },
        connectivity: { type: String },
        files: [{ type: filesModel }],
        diagnostics: [{ type: diagnosticsModel }],
        energyManagementEnable: { type: Boolean },              // flag to indicate if the management algorithm is active in this chargers
        energyManagementInterface: { type: String },            // The communication protocol used to do this Management (MQTT)
        switchBoardId: { type: String },                         // id of corresponding switchBoard that this charger belongs
        controllerId: { type: String },                          // id of corresponding controller that this charger belongs
        originalCoordinates: {
            type: { type: String, default: "Point" },
            coordinates: { type: [Number], default: [0, 0] },
        },
        updatedCoordinates: {
            date: {type: Date},
            source: {
                type: String,
                enum: ['algorithm', 'user', 'evio']
            }
        }
    },
    {
        timestamps: true
    }
);

chargerModel.index({ geometry: "2dsphere" });
chargerModel.index({ originalCoordinates: "2dsphere" });
chargerModel.index({ name: 1 });

var Charger = module.exports = mongoose.model('Charger', chargerModel);

//Charger.ensureIndexes({ name: 1 }, (err) => {
Charger.createIndexes({ name: 1 }, (err) => {
    if (err)
        console.error(err);
    else
        console.log('create name index successfully');
});


module.exports.createCharger = function (newCharger, callback) {
    newCharger.save(callback);
};

module.exports.updateCharger = function (query, values, callback) {
    Charger.findOneAndUpdate(query, values, callback);
};

module.exports.updateChargerFilter = function (query, values, filter, callback) {
    Charger.findOneAndUpdate(query, values, filter, callback);
};

module.exports.removeCharger = function (query, callback) {
    Charger.findOneAndRemove(query, callback);
};