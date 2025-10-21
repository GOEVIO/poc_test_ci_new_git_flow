const charger_microservice_host = 'http://chargers:3002'
const mongo_connection = String(process.env.DB_URI).replace('{database}', 'OCPPDB')
//const mongo_connection = 'mongodb://localhost:27017/OCPPDB'
const identity_microservice_host = 'http://identity:3003'
const tariff_microservice_host ='http://tariffs:3009'
const payment_microservice_host ='http://payments:3017'
var configsHost = 'http://configs:3028';

// const charger_microservice_host = 'http://localhost:3002'
// const identity_microservice_host = 'http://localhost:3003'
// const mongo_connection = 'mongodb://localhost:27017/OCPPDB'
// const tariff_microservice_host ='http://localhost:3009'
// const payment_microservice_host ='http://localhost:3017'
const feesConfigEndpoint = `${configsHost}/api/private/config/fees`;

const OCPPJ_16_DeviceType = '008'

//MEASURAND ENUMERATION
const ocppMeasTypeCE = 'Current.Export' //Instantaneous current flow from EV
const ocppMeasTypeCI = 'Current.Import' //Instantaneous current flow to EV
const ocppMeasTypeCO = 'Current.Offered' //Maximum current offered to EV
const ocppMeasTypeFREQ = 'Frequency' //Instantaneous reading of powerline frequency. NOTE: OCPP 1.6 does not have a UnitOfMeasure for frequency, the UnitOfMeasure for any SampledValue with measurand: Frequency is Hertz.
const ocppMeasTypePOWERFACT = 'Power.Factor' //Instantaneous power factor of total energy flow
const ocppMeasTypePOWEROFFER = 'Power.Offered' //Instantaneous power factor of total energy flow

const ocppMeasTypePRE = 'Power.Reactive.Export' //Instantaneous reactive power exported by EV. (var or kvar)
const ocppMeasTypePRI = 'Power.Reactive.Import' //Instantaneous reactive power imported by EV. (var or kvar)
const ocppMeasTypeRPM = 'RPM' //Fan speed in RPM
const ocppMeasTypeSoC = 'SoC' //State of charge of charging vehicle in percentage
const ocppMeasTypeTemperature = 'Temperature' //Temperature reading inside Charge Point
const ocppMeasTypeVoltage = 'Voltage' //Instantaneous AC RMS supply voltage

const ocppMeasTypeEAXR = 'Energy.Active.Export.Register' //Numerical value read from the "active electrical energy" (Wh or kWh) register of the (most authoritative) electrical meter measuring energy exported (to the grid).
const ocppMeasTypeEAIR = 'Energy.Active.Import.Register' //Numerical value read from the "active electrical energy" (Wh or kWh) register of the (most authoritative) electrical meter measuring energy imported (from the grid supply).
const ocppMeasTypeERER = 'Energy.Reactive.Export.Register' //Numerical value read from the "reactive electrical energy" (VARh or kVARh) register of the (most authoritative) electrical meter measuring energy exported (to the grid).
const ocppMeasTypeERIR = 'Energy.Reactive.Import.Register' //Numerical value read from the "reactive electrical energy" (VARh or kVARh) register of the (most authoritative) electrical meter measuring energy imported (from the grid supply).
const ocppMeasTypeEAEI = 'Energy.Active.Export.Interval' //Absolute amount of "active electrical energy" (Wh or kWh) exported (to the grid) during an associated time "interval", specified by a Metervalues ReadingContext, and applicable interval duration configuration values (in seconds) for "ClockAlignedDataInterval" and "MeterValueSampleInterval".
const ocppMeasTypeEAII = 'Energy.Active.Import.Interval' //Absolute amount of "active electrical energy" (Wh or kWh) imported (from the grid supply) during an associated time "interval", specified by a Metervalues ReadingContext, and applicable interval duration configuration values (in seconds) for "ClockAlignedDataInterval" and "MeterValueSampleInterval".
const ocppMeasTypeEREI = 'Energy.Reactive.Export.Interval' //Absolute amount of "reactive electrical energy" (VARh or kVARh) exported (to the grid) during an associated time "interval", specified by a Metervalues ReadingContext, and applicable interval duration configuration values (in seconds) for "ClockAlignedDataInterval" and "MeterValueSampleInterval".
const ocppMeasTypeERII = 'Energy.Reactive.Import.Interval' //Absolute amount of "reactive electrical energy" (VARh or kVARh) imported (from the grid supply) during an associated time "interval", specified by a Metervalues ReadingContext, and applicable interval duration configuration values (in seconds) for "ClockAlignedDataInterval" and "MeterValueSampleInterval".
const ocppMeasTypePAE = 'Power.Active.Export' //Instantaneous active power exported by EV. (W or kW)
const ocppMeasTypePAI = 'Power.Active.Import' //Instantaneous active power imported by EV. (W or kW)


//STATUS NOTIFICATION PLUG STATUS
const chargePointPlugStatusOCPPAvailable = "Available"
const chargePointPlugStatusOCPPPreparing = "Preparing"
const chargePointPlugStatusOCPPCharging = "Charging"
const chargePointPlugStatusOCPPSuspendedEVSE = "SuspendedEVSE"
const chargePointPlugStatusOCPPSuspendedEV = "SuspendedEV"
const chargePointPlugStatusOCPPFinishing = "Finishing"
const chargePointPlugStatusOCPPReserved = "Reserved"
const chargePointPlugStatusOCPPUnavailable = "Unavailable"
const chargePointPlugStatusOCPPFaulted = "Faulted"
const chargePointPlugStatusOCPPOccupied = "Occupied"

const chargePointStatusEVIOAvailable = "10"
const chargePointStatusEVIOInUse = "20"
const chargePointStatusEVIOBooked = "30"
const chargePointStatusEVIOUnavailable = "40"
const chargePointStatusEVIOFaulted = "50"
const chargePointStatusEVIOUnknown = "80"

//WEB SOCKET STATUS ENUM
const callRequest = 2;
const callResult = 3;
const callError = 4;

//BOOT NOTIFICATION STATUS ENUM
const bootNotificationStatusAccepted = "Accepted"
const bootNotificationStatusPending = "Pending"
const bootNotificationStatusRejected = "Rejected"

const defaultHeartBeatInterval = 60;
const defaultChargerTimeout = 60;

//ID TAG STATUS ENUM
const idTagStatusAccepted = "Accepted"
const idTagStatusBlocked = "Blocked"
const idTagStatusExpired = "Expired"
const idTagStatusInvalid = "Invalid"
const idTagStatusConcurrentTx = "ConcurrentTx"

//ID DATA TRANSFER STATUS ENUM
const idDataTransferStatusAccepted = "Accepted"
const idDataTransferStatusRejected = "Rejected"
const idDataTransferStatusUnknownMessageId = "UnknownMessageId"
const idDataTransferStatusUnknownVendorId = "UnknownVendorId"

//LOCAL AUTHORIZATION LIST UPDATE TYPES

const fullUpdate = "Full"
const diffUpdate = "Differential"

//CONFIGURATION KEYS ENUM

const ocppConnectionTimeOut = "ConnectionTimeOut"
const ocppLocalAuthListMaxLength = "LocalAuthListMaxLength"
const ocppSendLocalListMaxLength = "SendLocalListMaxLength"

const defaultSendLocalListLength = 20
const defaultLocalAuthListLength = 200

//Trigger transaltion variables
const triggeredByCS = 'server_ocpp_trigger_cs'
const triggeredByCP = 'server_ocpp_trigger_cp'

//Notifications history variables
const notificationsCleanHistoryDays = 7
const notificationsCleanHistoryCronTime = '0 5 * * *'

//Chargers
const getChargerModels = "/api/private/chargers/V2/models"

//Alarms
const getAlarms = "/api/private/chargers/V2/alarms"


const rejectedTransactionId = -1

module.exports = {
    callRequest: callRequest,
    callResult: callResult,
    callError: callError,
    defaultHeartBeatInterval: defaultHeartBeatInterval,
    idTagStatusAccepted: idTagStatusAccepted,
    idTagStatusBlocked: idTagStatusBlocked,
    idTagStatusExpired: idTagStatusExpired,
    idTagStatusInvalid: idTagStatusInvalid,
    idTagStatusConcurrentTx: idTagStatusConcurrentTx,
    idDataTransferStatusAccepted: idDataTransferStatusAccepted,
    idDataTransferStatusRejected: idDataTransferStatusRejected,
    idDataTransferStatusUnknownMessageId: idDataTransferStatusUnknownMessageId,
    idDataTransferStatusUnknownVendorId: idDataTransferStatusUnknownVendorId,
    bootNotificationStatusAccepted: bootNotificationStatusAccepted,
    bootNotificationStatusPending: bootNotificationStatusPending,
    bootNotificationStatusRejected: bootNotificationStatusRejected,
    charger_microservice_host: charger_microservice_host,
    identity_microservice_host: identity_microservice_host,
    tariff_microservice_host:tariff_microservice_host,
    payment_microservice_host:payment_microservice_host,
    OCPPJ_16_DeviceType: OCPPJ_16_DeviceType,
    mongo_connection: mongo_connection,
    chargePointStatusPlugOCPPAvailable: chargePointPlugStatusOCPPAvailable,
    chargePointPlugStatusOCPPOccupied: chargePointPlugStatusOCPPOccupied,
    chargePointPlugStatusOCPPFaulted: chargePointPlugStatusOCPPFaulted,
    chargePointPlugStatusOCPPUnavailable: chargePointPlugStatusOCPPUnavailable,
    chargePointPlugStatusOCPPReserved: chargePointPlugStatusOCPPReserved,
    chargePointPlugStatusOCPPCharging: chargePointPlugStatusOCPPCharging,
    chargePointPlugStatusOCPPSuspendedEV:chargePointPlugStatusOCPPSuspendedEV,
    chargePointPlugStatusOCPPSuspendedEVSE:chargePointPlugStatusOCPPSuspendedEVSE,
    chargePointPlugStatusOCPPPreparing : chargePointPlugStatusOCPPPreparing,
    chargePointPlugStatusOCPPFinishing : chargePointPlugStatusOCPPFinishing,
    chargePointStatusEVIOAvailable: chargePointStatusEVIOAvailable,
    chargePointStatusEVIOInUse: chargePointStatusEVIOInUse,
    chargePointStatusEVIOBooked: chargePointStatusEVIOBooked,
    chargePointStatusEVIOUnavailable: chargePointStatusEVIOUnavailable,
    chargePointStatusEVIOUnknown: chargePointStatusEVIOUnknown,
    chargePointStatusEVIOFaulted: chargePointStatusEVIOFaulted,
    ocppMeasTypeEAXR: ocppMeasTypeEAXR,
    ocppMeasTypeEAIR: ocppMeasTypeEAIR,
    ocppMeasTypeERER: ocppMeasTypeERER,
    ocppMeasTypeERIR: ocppMeasTypeERIR,
    ocppMeasTypeEAEI: ocppMeasTypeEAEI,
    ocppMeasTypeEAII: ocppMeasTypeEAII,
    ocppMeasTypeEREI: ocppMeasTypeEREI,
    ocppMeasTypeERII: ocppMeasTypeERII,
    ocppMeasTypePAE: ocppMeasTypePAE,
    ocppMeasTypePAI: ocppMeasTypePAI,
    ocppMeasTypeCE: ocppMeasTypeCE,
    ocppMeasTypeCI: ocppMeasTypeCI,
    ocppMeasTypeCO: ocppMeasTypeCO,
    ocppMeasTypeFREQ: ocppMeasTypeFREQ,
    ocppMeasTypePOWERFACT: ocppMeasTypePOWERFACT,
    ocppMeasTypePOWEROFFER: ocppMeasTypePOWEROFFER,
    ocppMeasTypePRE: ocppMeasTypePRE,
    ocppMeasTypePRI: ocppMeasTypePRI,
    ocppMeasTypeRPM: ocppMeasTypeRPM,
    ocppMeasTypeSoC: ocppMeasTypeSoC,
    ocppMeasTypeTemperature: ocppMeasTypeTemperature,
    ocppMeasTypeVoltage: ocppMeasTypeVoltage,
    feesConfigEndpoint: feesConfigEndpoint,
    defaultChargerTimeout: defaultChargerTimeout,
    fullUpdate: fullUpdate,
    diffUpdate: diffUpdate,
    ocppConnectionTimeOut: ocppConnectionTimeOut,
    ocppLocalAuthListMaxLength: ocppLocalAuthListMaxLength,
    ocppSendLocalListMaxLength: ocppSendLocalListMaxLength,
    defaultSendLocalListLength: defaultSendLocalListLength,
    defaultLocalAuthListLength: defaultLocalAuthListLength,
    triggeredByCS: triggeredByCS,
    triggeredByCP: triggeredByCP,
    notificationsCleanHistoryDays: notificationsCleanHistoryDays,
    notificationsCleanHistoryCronTime: notificationsCleanHistoryCronTime,
    rejectedTransactionId,
    getChargerModels,
    getAlarms
}
