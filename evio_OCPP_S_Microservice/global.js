const charger_microservice_host = 'http://chargers:3002'
const mongo_connection = String(process.env.DB_URI).replace('{database}', 'OCPPDB')
const identity_microservice_host = 'http://identity:3003'
// const charger_microservice_host = 'http://localhost:3002'
// const identity_microservice_host = 'http://localhost:3003'
// const mongo_connection = 'mongodb://localhost:27017/OCPPDB'

//BOOT NOTIFICATION STATUS ENUM
const bootNotificationStatusAccepted = "Accepted"
const bootNotificationStatusPending = "Pending"
const bootNotificationStatusRejected = "Rejected"

const defaultHeartBeatInterval = 300;
const defaultMeterValuesInterval = 300;

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

//STATUS NOTIFICATION PLUG STATUS
const chargePointStatusOCPPAvailable = "Available"
const chargePointStatusOCPPOccupied = "Occupied"
const chargePointStatusOCPPFaulted = "Faulted"
const chargePointStatusOCPPUnavailable = "Unavailable"
const chargePointStatusOCPPReserved = "Reserved"
const chargePointStatusEVIOAvailable = "10"
const chargePointStatusEVIOInUse = "20"
const chargePointStatusEVIOBooked = "30"
const chargePointStatusEVIOUnavailable = "40"
const chargePointStatusEVIOFaulted = "50"

//MEASURAND ENUMERATION
const ocppMeasTypeEAXR = 'Energy.Active.Export.Register' //Energy exported by EV (Wh or kWh)
const ocppMeasTypeEAIR = 'Energy.Active.Import.Register' //Energy imported by EV (Wh or kWh)
const ocppMeasTypeERER = 'Energy.Reactive.Export.Register' //Reactive energy exported by EV (varh or kvarh)
const ocppMeasTypeERIR = 'Energy.Reactive.Import.Register' //Reactive energy imported by EV (varh or kvarh)
const ocppMeasTypeEAEI = 'Energy.Active.Export.Interval' //Energy exported by EV (Wh or kWh)
const ocppMeasTypeEAII = 'Energy.Active.Import.Interval' //Energy imported by EV (Wh or kWh)
const ocppMeasTypeEREI = 'Energy.Reactive.Export.Interval' //Reactive energy exported by EV. (varh or kvarh)
const ocppMeasTypeERII = 'Energy.Reactive.Import.Interval' //Reactive energy imported by EV. (varh or kvarh)
const ocppMeasTypePAE = 'Power.Active.Export' //Instantaneous active power exported by EV. (W or kW)
const ocppMeasTypePAI = 'Power.Active.Import' //Instantaneous active power imported by EV. (W or kW)


const OCPPS_15_DeviceType = '005'

module.exports = {
    charger_microservice_host: charger_microservice_host,
    identity_microservice_host: identity_microservice_host,
    defaultHeartBeatInterval: defaultHeartBeatInterval,
    defaultMeterValuesInterval: defaultMeterValuesInterval,
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
    OCPPS_15_DeviceType: OCPPS_15_DeviceType,
    mongo_connection: mongo_connection,
    chargePointStatusOCPPAvailable: chargePointStatusOCPPAvailable,
    chargePointStatusOCPPOccupied: chargePointStatusOCPPOccupied,
    chargePointStatusOCPPFaulted: chargePointStatusOCPPFaulted,
    chargePointStatusOCPPUnavailable: chargePointStatusOCPPUnavailable,
    chargePointStatusOCPPReserved: chargePointStatusOCPPReserved,
    chargePointStatusEVIOAvailable: chargePointStatusEVIOAvailable,
    chargePointStatusEVIOInUse: chargePointStatusEVIOInUse,
    chargePointStatusEVIOBooked: chargePointStatusEVIOBooked,
    chargePointStatusEVIOUnavailable: chargePointStatusEVIOUnavailable,
    ocppMeasTypeEAXR: ocppMeasTypeEAXR,
    ocppMeasTypeEAIR: ocppMeasTypeEAIR,
    ocppMeasTypeERER: ocppMeasTypeERER,
    ocppMeasTypeERIR: ocppMeasTypeERIR,
    ocppMeasTypeEAEI: ocppMeasTypeEAEI,
    ocppMeasTypeEAII: ocppMeasTypeEAII,
    ocppMeasTypeEREI: ocppMeasTypeEREI,
    ocppMeasTypeERII: ocppMeasTypeERII,
    ocppMeasTypePAE: ocppMeasTypePAE,
    ocppMeasTypePAI: ocppMeasTypePAI
}