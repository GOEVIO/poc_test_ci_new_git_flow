const OcppJsonCall = require("../OcppJsonCall")
const global = require('../global');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const Utils = require('../utils');
const axios = require("axios");
const moment = require('moment');
const Sentry = require("@sentry/node");
const constants = require('../utils/constants')
const { getUserCoordinates } = require('../utils/coordinates') 
const { saveSessionLogs } = require('../utils/save-session-logs')
const { Enums } = require('evio-library-commons').default;


const host = global.charger_microservice_host;
const chargingSessionServiceProxy = `${host}/api/private/chargingSession`;
const chargerServiceProxy = `${host}/api/private/chargers/status`;
const chargingSessionStartServiceProxy = `${host}/api/private/chargingSession/start`;
const trigger = global.triggeredByCS

module.exports = {
    handle: function (req, res, wss, eventEmitter) {
        const context = "[Remote Start Transaction]";
        const action = 'RemoteStartTransaction';

        const chargerId = req.body.hwId;

        const baseDataToSaveLog = {
            userId: req?.body?.userId || req.headers['userid'] || '',
            hwId: chargerId,
            plugId: req?.body?.plugId || '',
            stage: '[RemoteStartSession OCPP] - Route [POST /api/private/connectionstation/ocppj/start]',
            action: 'start',
            status: Enums.SessionFlowLogsStatus.ERROR,
            payload: req?.body || '',
            errorType: Enums.SessionFlowLogsErrorTypes.VALIDATION_ERROR,
        }

        const clients = Array.from(wss.clients);
        const client = clients.filter(a => a.id == chargerId)[0];

        if (req.body.freeStartTransaction) {
            // Remote start sent from control center operator
            freeStartTransaction(req, res, eventEmitter , client, baseDataToSaveLog)
        } else {
            let messageError = ""
            const evId = req.body.evId;
            if (!evId){
                messageError = 'EV ID required'
                saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError })
                return res.status(400).send({ auth: 'true', code: "server_ev_id_required", message: messageError });
            }

            const plugId = req.body.plugId;
            if (!plugId){
                messageError = 'Plug ID required'
                saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError })
                return res.status(400).send({ auth: 'true', code: "server_plug_id_required", message: messageError });
            }
            baseDataToSaveLog.plugId = plugId;

            const idTag = req.body.idTag;
            if (!idTag){
                messageError = 'IdTag required'
                saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError })
                return res.status(400).send({ auth: 'true', code: "server_id_tag_required", message: messageError });
            }
            const chargingProfile = req.body.chargingProfile;

            if(chargingProfile){

                const requiredFields = ["chargingProfileId", "stackLevel", "chargingProfilePurpose", "chargingProfileKind", "chargingSchedule"];
                for (const field of requiredFields) {
                    if (chargingProfile[field] === undefined) {
                        messageError = `${field} is required in chargingProfile`
                        saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError })
                        return res.status(400).send({ auth: 'true', code: `${field}_required`, message: messageError });
                    }
                }
    
                if (!Number.isInteger(chargingProfile.chargingProfileId)) {
                    messageError = 'chargingProfileId must be an integer'
                    saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError })
                    return res.status(400).send({ auth: 'true', code: "invalid_chargingProfileId", message: messageError });
                }
    
                if (chargingProfile.transactionId && !Number.isInteger(chargingProfile.transactionId)) {
                    messageError = 'TransactionId must be an integer'
                    saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError })
                    return res.status(400).send({ auth: 'true', code: "invalid_transactionId", message: messageError });
                }
    
                if (!Number.isInteger(chargingProfile.stackLevel)) {
                    messageError = 'stackLevel must be an integer'
                    saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError })
                    return res.status(400).send({ auth: 'true', code: "invalid_stackLevel", message: messageError });
                }
    
                if (!["ChargePointMaxProfile", "TxDefaultProfile", "TxProfile"].includes(chargingProfile.chargingProfilePurpose)) {
                    messageError = 'Invalid value for chargingProfilePurpose'
                    saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError })
                    return res.status(400).send({ auth: 'true', code: "invalid_chargingProfilePurpose", message: messageError });
                }
    
                if (!["Absolute", "Recurring", "Relative"].includes(chargingProfile.chargingProfileKind)) {
                    messageError = 'Invalid value for chargingProfileKind'
                    saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError })
                    return res.status(400).send({ auth: 'true', code: "invalid_chargingProfileKind", message: messageError });
                }
    
                if (chargingProfile.recurrencyKind && !["Daily", "Weekly"].includes(chargingProfile.recurrencyKind)) {
                    messageError = 'Invalid value for recurrencyKind'
                    saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError })
                    return res.status(400).send({ auth: 'true', code: "invalid_recurrencyKind", message: messageError });
                }
    
                if (chargingProfile.validFrom && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(chargingProfile.validFrom)) {
                    messageError = 'Invalid format for validFrom'
                    saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError })
                    return res.status(400).send({ auth: 'true', code: "invalid_validFrom", message: messageError });
                }
    
                if (chargingProfile.validTo && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(chargingProfile.validTo)) {
                    messageError = 'Invalid format for validTo'
                    saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError })
                    return res.status(400).send({ auth: 'true', code: "invalid_validTo", message: messageError });
                }
    
                const chargingSchedule = chargingProfile.chargingSchedule;
                if (!chargingSchedule) {
                    messageError = 'chargingSchedule is required in chargingProfile'
                    saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError })
                    return res.status(400).send({ auth: 'true', code: "chargingSchedule_required", message: messageError });
                }
    
                if (chargingSchedule.duration && !Number.isInteger(chargingSchedule.duration)) {
                    messageError = 'duration must be an integer'
                    saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError })
                    return res.status(400).send({ auth: 'true', code: "invalid_duration", message: messageError });
                }
    
                if (chargingSchedule.startSchedule && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(chargingSchedule.startSchedule)) {
                    messageError = 'Invalid format for startSchedule'
                    saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError })
                    return res.status(400).send({ auth: 'true', code: "invalid_startSchedule", message: messageError });
                }
    
                if (!["A", "W"].includes(chargingSchedule.chargingRateUnit)) {
                    messageError = 'Invalid value for chargingRateUnit'
                    saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError })
                    return res.status(400).send({ auth: 'true', code: "invalid_chargingRateUnit", message: messageError });
                }
    
                const chargingSchedulePeriod = chargingSchedule.chargingSchedulePeriod;
                if (!chargingSchedulePeriod || !Array.isArray(chargingSchedulePeriod) || chargingSchedulePeriod.length === 0) {
                    messageError = 'chargingSchedulePeriod is required and must be a non-empty array'
                    saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError })
                    return res.status(400).send({ auth: 'true', code: "invalid_chargingSchedulePeriod", message: messageError });
                }
    
                for (const period of chargingSchedulePeriod) {
                    if (!Number.isInteger(period.startPeriod) || period.startPeriod < 0) {
                        messageError = 'startPeriod must be a non-negative integer'
                        saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError })
                        return res.status(400).send({ auth: 'true', code: "invalid_startPeriod", message: messageError });
                    }
    
                    if (typeof period.limit !== "number" || period.limit < 0 || !isValidDecimalNumber(period.limit.toString())) {
                        messageError = 'Limit must be a non-negative decimal number'
                        saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError })
                        return res.status(400).send({ auth: 'true', code: "invalid_limit", message: messageError });
                    }
    
                    if (period.numberPhases && !Number.isInteger(period.numberPhases) || period.numberPhases < 0) {
                        messageError = 'NumberPhases must be a non-negative integer'
                        saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError })
                        return res.status(400).send({ auth: 'true', code: "invalid_numberPhases", message: messageError });
                    }
                }
    
                if (chargingProfile.minChargingRate && (typeof chargingProfile.minChargingRate !== "number" || !isValidDecimalNumber(chargingProfile.minChargingRate.toString()))) {
                    messageError = 'MinChargingRate must be decimal number'
                    saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError })
                    return res.status(400).send({ auth: 'true', code: "invalid_minChargingRate", message: messageError });
                }
            }

            const hwId = req.body.hwId;
            if (!hwId){
                messageError = 'HwId required'
                saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError })
                return res.status(400).send({ auth: 'true', code: "server_hw_required", message: messageError });
            }

            const tariffId = req.body.tariffId;
            if (!tariffId){
                messageError = 'Tariff Id required'
                saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError })
                return res.status(400).send({ auth: 'true', code: "server_tariff_id_required", message: messageError });
            }
            let billingPeriod = req.body.billingPeriod;
            if (!billingPeriod) {
                billingPeriod = "AD_HOC"
            }

            const userId = req.headers['userid'];
            const autoStop = req.body.autoStop;

            if (client) {
                if (client.readyState === WebSocket.OPEN) {
                    /////////////////////////////////////////////////////////////////////////////
                    //Check if charger exists on EVIO Network and get data of charger
                    const params = {
                        hwId: hwId
                    };

                    Utils.chekIfChargerExists(chargerServiceProxy, params).then(async (charger) => {

                        if (charger) {

                            let {userIdInfo ,userIdWillPayInfo , userIdToBillingInfo} = await Utils.getAllUserInfo(userId , req.body.userIdWillPay , req.body.userIdToBilling)

                            const dateNow = moment(new Date().toISOString()).utc();
                            const body = {
                                'hwId': hwId,
                                'evId': evId,
                                'idTag': idTag,
                                'tariffId': tariffId,
                                'command': process.env.StartCommand,
                                'chargerType': charger.chargerType ? charger.chargerType : global.OCPPJ_16_DeviceType,
                                'status': process.env.SessionStatusToStart,
                                'userId': userId,
                                'plugId': plugId,
                                'startDate': dateNow,
                                'authType': 'APP_USER',
                                'autoStop': autoStop,
                                'paymentMethod': req.body.paymentMethod,
                                'paymentMethodId': req.body.paymentMethodId,
                                'walletAmount': req.body.walletAmount,
                                'reservedAmount': req.body.reservedAmount,
                                'confirmationAmount': req.body.confirmationAmount,
                                'userIdWillPay': req.body.userIdWillPay,
                                'adyenReference': req.body.adyenReference,
                                'transactionId': req.body.transactionId,
                                'address': req.body.address,
                                'fees': req.body.fees,
                                'tariff': req.body.tariff,
                                'cardNumber': req.body.cardNumber,
                                'clientType': req.body.clientType,
                                'paymentType': req.body.paymentType,
                                'billingPeriod': billingPeriod,
                                'clientName': req.body.clientName,
                                'userIdToBilling': req.body.userIdToBilling,
                                'freeOfCharge': charger.accessType === process.env.ChargerAccessFreeCharge,
                                'operatorId' :  charger.operatorId,
                                'plafondId':req.body.plafondId,
                                userIdInfo,
                                userIdWillPayInfo,
                                userIdToBillingInfo,
                            }

                            if (userId == charger.createUser || charger.accessType === process.env.ChargerAccessFreeCharge) {
                                body.tariffId = "-1";
                                body.tariff = {};
                                body.paymentMethod = process.env.PaymentMethodNotPay
                            }
                             
                            const userCoordinates = getUserCoordinates(req.body);
                            if (userCoordinates) {
                                body.userCoordinates = userCoordinates
                            }
                            
                            axios.post(chargingSessionStartServiceProxy, body)
                                .then(function (chargingSession) {

                                    console.log(`${context} Trying start remote transaction: ChargerId: ${hwId}; PlugId: ${plugId}; userIdTag: ${idTag}; Endpoint: ${charger.endpoint} `);
                                    const messageId = uuidv4();

                                    let data = new Object;
                                    data.idTag = idTag;
                                    data.connectorId = parseInt(plugId);


                                    //const call = new OcppJsonCall(messageId, global.callRequest, action, data);
                                    const call = [global.callRequest, messageId, action, data];
                                    console.log(JSON.stringify(call))
                                    console.log(`Message sent to ${client.id}, ${action}`)

                                    client.send(JSON.stringify(call), function (temp) {
                                        eventEmitter.on(messageId, function (result) {

                                            const remoteStartTransactionStatus = result.status;
                                            if (remoteStartTransactionStatus === constants.responseStatus.Accepted) {
                                                Utils.saveLog(hwId, call[3], data, true, 'RemoteStartTransaction', 'RemoteStartTransaction accepted', plugId, trigger)
                                                saveSessionLogs({ 
                                                    ...baseDataToSaveLog,
                                                    status: Enums.SessionFlowLogsStatus.SUCCESS,
                                                    sessionId: chargingSession.data._id
                                                });
                                                return res.status(200).send({ auth: 'true', code: "", message: 'Remote Start accepted', sessionId: chargingSession.data._id });
                                            } else {
                                                if (remoteStartTransactionStatus !== constants.responseStatus.Rejected) {
                                                    console.error(`${context} Error - Unknown response status`, result)
                                                    saveSessionLogs({ 
                                                        ...baseDataToSaveLog, 
                                                        errorMessage: `${context} Error - Unknown response status: ${remoteStartTransactionStatus}`,
                                                        errorType: Enums.SessionFlowLogsErrorTypes.EXTERNAL_SERVICE_ERROR,
                                                    });
                                                    Utils.saveLog(hwId, call[3], result, false, 'RemoteStartTransaction', 'Unknown remoteStart response status', plugId, trigger);
                                                    Sentry.captureException(new Error(`Unknown remoteStart response status response ${hwId}`));
                                                } else {
                                                    saveSessionLogs({ 
                                                        ...baseDataToSaveLog, 
                                                        errorMessage: `${context} RemoteStartTransaction rejected: ${remoteStartTransactionStatus}`,
                                                        errorType: Enums.SessionFlowLogsErrorTypes.EXTERNAL_SERVICE_ERROR,
                                                    });
                                                    Utils.saveLog(hwId, call[3], data, false, 'RemoteStartTransaction', 'RemoteStartTransaction rejected', plugId, trigger)
                                                }
                                                const error = {
                                                    reasonCode: "other",
                                                    reasonText: "Communication not established between the Central System and the Charging Station"
                                                }
                                                stopChargingSession(hwId, plugId, error);
                                                return res.status(400).send({ auth: 'true', code: "server_error_connecting_charging_station", message: `Communication not established between the CS and the charging station ${chargerId}`, sessionId: chargingSession.data._id });
                                            }
                                        });
                                    });
                                })
                                .catch(function (error, err) {
                                    if (!error)
                                        console.error(`${context} error - Check error 45648431`);
                                    else
                                        console.error(`${context} error: , ${JSON.stringify(error)}`);
                                    
                                    if (error) {
                                        if (error.response) {
                                            saveSessionLogs({ 
                                                ...baseDataToSaveLog, 
                                                errorMessage: error.response.data.message,
                                                errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_SERVER_ERROR,
                                            });
                                            Utils.saveLog(hwId, req.body , {} , false , 'RemoteStartTransaction' , error.response.data.message , plugId , trigger)
                                            return res.status(500).send({ auth: true, status: false, message: error.response.data.message });
                                        } else {
                                            saveSessionLogs({ 
                                                ...baseDataToSaveLog, 
                                                errorMessage: error.message,
                                                errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_SERVER_ERROR,
                                            });
                                            Utils.saveLog(hwId, req.body , {} , false , 'RemoteStartTransaction' , error.message , plugId , trigger)
                                            return res.status(500).send({ auth: true, status: false, message: error.message });
                                        }
                                    } else {
                                        saveSessionLogs({ 
                                            ...baseDataToSaveLog, 
                                            errorMessage: `Communication not established between the CS and the charging station ${chargerId}`,
                                            errorType: Enums.SessionFlowLogsErrorTypes.DEVICE_COMMUNICATION_ERROR,
                                        });
                                        Utils.saveLog(hwId, req.body , {} , false , 'RemoteStartTransaction' , `Communication not established between the CS and the charging station ${chargerId}` , plugId , trigger)
                                        return res.status(500).send({ auth: true, status: false, message: `Communication not established between the CS and the charging station ${chargerId}` });
                                    }

                                });

                        }
                        else {
                            console.error(`Charger ${hwId} does not exists`);
                            saveSessionLogs({ 
                                ...baseDataToSaveLog, 
                                errorMessage: `Error during get charger ${hwId} does not exists`,
                            });
                            Utils.saveLog(hwId, req.body , {} , false , 'RemoteStartTransaction' ,`Charger ${hwId} does not exist` , plugId , trigger)
                            return res.status(500).send({ auth: true, status: false, message: `Charger ${hwId} does not exists` });
                        }
                    });

                }
            }
            else {
                const message = `${context} Communication not established between the CS and the charging station ${chargerId}`;
                console.error(message);
                saveSessionLogs({ 
                    ...baseDataToSaveLog, 
                    errorMessage: message,
                    errorType: Enums.SessionFlowLogsErrorTypes.DEVICE_COMMUNICATION_ERROR
                });
                Utils.saveLog(hwId, req.body , {} , false , 'RemoteStartTransaction' ,`Communication not established between the CS and the charging station ${chargerId}` , plugId , trigger)
                return res.status(400).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
            }
        }

    }
}

//Function to stop transaction notification when user does not connects the plug
const stopChargingSession = (hwId, connectorId, error) => {
    //Check if there is any charging session running to specific connector id
    const params = {
        hwId: hwId,
        plugId: connectorId,
        status: process.env.SessionStatusToStart
    };

    Utils.checkIfHasChargingSession(chargingSessionServiceProxy, params).then((chargingSession) => {
        if (chargingSession) {
            //Update charging Session with failed
            updateChargingSession(chargingSessionServiceProxy, process.env.SessionStatusFailed, chargingSession, error);
            console.log(`[StatusNotification] A charging session ${chargingSession.sessionId} was canceled for charge station ${hwId} and connectorId  ${connectorId}`)
        }

    }).catch(function (error) {
        console.error(`${context} error checking if has any charging session`, error)

    });

};

const updateChargingSession = (ServiceProxy, status, chargingSession, error) => {
    const body = {
        _id: chargingSession._id,
        status: status,
        stopReason: error,
    }

    axios.patch(ServiceProxy, { body })
        .then(function (response) {
            // console.log("Success");
        })
        .catch(function (error) {
            console.error(error);
        });
};


async function freeStartTransaction(req, res, eventEmitter , client,  baseDataToSaveLog = {}) {
    try {
        baseDataToSaveLog.stage = '[RemoteStartSession OCPP] - [freeStartTransaction]';
        const context = "[Remote Start Transaction]";
        const action = 'RemoteStartTransaction';

        const chargerId = req.body.hwId;

        const plugId = req.body.plugId;
        if (!plugId){
            saveSessionLogs({ ...baseDataToSaveLog, errorMessage: 'PlugId is required'})
            return res.status(400).send({ auth: 'true', code: "server_plug_id_required", message: 'Plug ID required' });
        }
        baseDataToSaveLog.plugId = plugId;

        const hwId = req.body.hwId;
        if (!hwId){
            saveSessionLogs({ ...baseDataToSaveLog, errorMessage: 'HwId is required'})
            return res.status(400).send({ auth: 'true', code: "server_hw_required", message: 'HwId required' });
        }
        baseDataToSaveLog.hwId = hwId;

        const userId = req.body.userId;
        if (!userId){
            saveSessionLogs({ ...baseDataToSaveLog, errorMessage: 'UserId is required'})
            return res.status(400).send({ auth: 'true', code: "server_userId_required", message: 'userId required' });
        }
        baseDataToSaveLog.userId = userId;

        const idTag = getRandomInt(1_000_000_000, 9_999_999_999).toString()
        if (!idTag)
            return res.status(400).send({ auth: 'true', code: "server_idTag_required", message: 'IdTag required' });

        const chargingProfile = req.body.chargingProfile;
        if(chargingProfile){

            const requiredFields = ["chargingProfileId", "stackLevel", "chargingProfilePurpose", "chargingProfileKind", "chargingSchedule"];
            let messageError = ""
            for (const field of requiredFields) {
                if (chargingProfile[field] === undefined) {
                    messageError = `${field} is required in chargingProfile`;
                    saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError})
                    return res.status(400).send({ auth: 'true', code: `${field}_required`, message: messageError });
                }
            }

            if (!Number.isInteger(chargingProfile.chargingProfileId)) {
                messageError = 'chargingProfileId must be an integer';
                saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError})
                return res.status(400).send({ auth: 'true', code: "invalid_chargingProfileId", message: messageError });
            }

            if (chargingProfile.transactionId && !Number.isInteger(chargingProfile.transactionId)) {
                messageError = 'TransactionId must be an integer';
                saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError})
                return res.status(400).send({ auth: 'true', code: "invalid_transactionId", message: messageError });
            }

            if (!Number.isInteger(chargingProfile.stackLevel)) {
                messageError = 'stackLevel must be an integer';
                saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError})
                return res.status(400).send({ auth: 'true', code: "invalid_stackLevel", message: messageError });
            }

            if (!["ChargePointMaxProfile", "TxDefaultProfile", "TxProfile"].includes(chargingProfile.chargingProfilePurpose)) {
                messageError = 'Invalid value for chargingProfilePurpose';
                saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError})
                return res.status(400).send({ auth: 'true', code: "invalid_chargingProfilePurpose", message: messageError });
            }

            if (!["Absolute", "Recurring", "Relative"].includes(chargingProfile.chargingProfileKind)) {
                messageError = 'Invalid value for chargingProfileKind';
                saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError})
                return res.status(400).send({ auth: 'true', code: "invalid_chargingProfileKind", message: messageError });
            }

            if (chargingProfile.recurrencyKind && !["Daily", "Weekly"].includes(chargingProfile.recurrencyKind)) {
                messageError = 'Invalid value for recurrencyKind';
                saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError})
                return res.status(400).send({ auth: 'true', code: "invalid_recurrencyKind", message: messageError });
            }

            if (chargingProfile.validFrom && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(chargingProfile.validFrom)) {
                messageError = 'Invalid format for validFrom';
                saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError})
                return res.status(400).send({ auth: 'true', code: "invalid_validFrom", message: messageError });
            }

            if (chargingProfile.validTo && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(chargingProfile.validTo)) {
                messageError = 'Invalid format for validTo';
                saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError})
                return res.status(400).send({ auth: 'true', code: "invalid_validTo", message: messageError });
            }

            const chargingSchedule = chargingProfile.chargingSchedule;
            if (!chargingSchedule) {
                messageError = 'chargingSchedule is required in chargingProfile';
                saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError})
                return res.status(400).send({ auth: 'true', code: "chargingSchedule_required", message: messageError });
            }

            if (chargingSchedule.duration && !Number.isInteger(chargingSchedule.duration)) {
                messageError = 'duration must be an integer';
                saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError})
                return res.status(400).send({ auth: 'true', code: "invalid_duration", message: messageError });
            }

            if (chargingSchedule.startSchedule && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(chargingSchedule.startSchedule)) {
                messageError = 'Invalid format for startSchedule';
                saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError})
                return res.status(400).send({ auth: 'true', code: "invalid_startSchedule", message: messageError });
            }

            if (!["A", "W"].includes(chargingSchedule.chargingRateUnit)) {
                messageError = 'Invalid value for chargingRateUnit';
                saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError})
                return res.status(400).send({ auth: 'true', code: "invalid_chargingRateUnit", message: messageError });
            }

            const chargingSchedulePeriod = chargingSchedule.chargingSchedulePeriod;
            if (!chargingSchedulePeriod || !Array.isArray(chargingSchedulePeriod) || chargingSchedulePeriod.length === 0) {
                messageError = 'chargingSchedulePeriod is required and must be a non-empty array';
                saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError})
                return res.status(400).send({ auth: 'true', code: "invalid_chargingSchedulePeriod", message: messageError });
            }

            for (const period of chargingSchedulePeriod) {
                if (!Number.isInteger(period.startPeriod) || period.startPeriod < 0) {
                    messageError = 'startPeriod must be a non-negative integer';
                    saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError})
                    return res.status(400).send({ auth: 'true', code: "invalid_startPeriod", message: messageError });
                }

                if (typeof period.limit !== "number" || period.limit < 0 || !isValidDecimalNumber(period.limit.toString())) {
                    messageError = 'Limit must be a non-negative decimal number';
                    saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError})
                    return res.status(400).send({ auth: 'true', code: "invalid_limit", message: messageError });
                }

                if (period.numberPhases && !Number.isInteger(period.numberPhases) || period.numberPhases < 0) {
                    messageError = 'NumberPhases must be a non-negative integer';
                    saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError})
                    return res.status(400).send({ auth: 'true', code: "invalid_numberPhases", message: messageError });
                }
            }

            if (chargingProfile.minChargingRate && (typeof chargingProfile.minChargingRate !== "number" || !isValidDecimalNumber(chargingProfile.minChargingRate.toString()))) {
                messageError = 'MinChargingRate must be decimal number';
                saveSessionLogs({ ...baseDataToSaveLog, errorMessage: messageError})
                return res.status(400).send({ auth: 'true', code: "invalid_minChargingRate", message: messageError });
            }
        }

        let notes = req.body.notes ? req.body.notes : ""

        if (client) {
            if (client.readyState === WebSocket.OPEN) {

                /////////////////////////////////////////////////////////////////////////////
                //Check if charger exists on EVIO Network and get data of charger
                const params = {
                    hwId: hwId
                };

                Utils.chekIfChargerExists(chargerServiceProxy, params).then(async (charger) => {

                    if (charger) {

                        if (userId !== charger.operatorId) {
                            Utils.saveLog(hwId, req.body , {} , false , 'RemoteStartTransaction' , `RemoteStartTransaction failed because userId ${userId} has not permission to charge in this charging station via free mode` , plugId , trigger)
                            saveSessionLogs({ 
                                ...baseDataToSaveLog, 
                                errorMessage: `RemoteStartTransaction failed because userId ${userId} has not permission to charge in this charging station via free mode`,
                            });
                            return res.status(500).send({ auth: 'true', code: "server_userId_required", message: 'userId has not permission to charge in this charging station via free mode' });
                        }

                        const fees = req?.body?.fees ?? await Utils.getFeesWithUser(charger, req?.body?.userIdToBilling) ;

                       

                        let evId = "-1";
                        let fleetId = "-1";
                        const dateNow = moment(new Date().toISOString()).utc();
                        const body = {
                            'hwId': hwId,
                            'fleetId':fleetId,
                            'evId': evId,
                            'idTag': idTag,
                            'sessionPrice': -1,
                            'command': process.env.StartCommand,
                            'chargerType': charger.chargerType ? charger.chargerType : global.OCPPJ_16_DeviceType,
                            'status': process.env.SessionStatusToStart,
                            'userId': userId,
                            'plugId': plugId,
                            'startDate': dateNow,
                            'authType': 'APP_USER',
                            'tariffId': "-1",
                            'fees': fees,
                            'address': charger.address,
                            'userIdWillPay' :  charger.createUser,
                            'paymentMethod': process.env.PaymentMethodNotPay,
                            'freeOfCharge': true,
                            'createdWay' : process.env.createdWayControlCenter,
                            "notes" : notes,
                            'operatorId' :  charger.operatorId,
                        }

                        axios.post(chargingSessionStartServiceProxy, body)
                            .then(function (chargingSession) {

                                console.log(`${context} Trying start FREE remote transaction: ChargerId: ${hwId}; PlugId: ${plugId}; userIdTag: ${idTag}; Endpoint: ${charger.endpoint} `);
                                const messageId = uuidv4();

                                let data = new Object;
                                data.idTag = idTag;
                                data.connectorId = parseInt(plugId);


                                //const call = new OcppJsonCall(messageId, global.callRequest, action, data);
                                const call = [global.callRequest, messageId, action, data];
                                console.log(JSON.stringify(call))
                                console.log(`Message sent to ${client.id}, ${action}`)

                                client.send(JSON.stringify(call), function (temp) {
                                    eventEmitter.on(messageId, function (result) {

                                        const remoteStartTransactionStatus = result.status;
                                        if (remoteStartTransactionStatus === constants.responseStatus.Accepted) {
                                            Utils.saveLog(hwId, call[3], data, true, 'RemoteStartTransaction', 'RemoteStartTransaction accepted', plugId, trigger)
                                            saveSessionLogs({ 
                                                ...baseDataToSaveLog,
                                                status: Enums.SessionFlowLogsStatus.SUCCESS,
                                                sessionId: chargingSession.data._id
                                            });
                                            return res.status(200).send({ auth: 'true', code: "", message: 'Remote Start accepted', sessionId: chargingSession.data._id });
                                        } else {

                                            if (remoteStartTransactionStatus !== constants.responseStatus.Rejected) {
                                                console.error(`${context} Error - Unknown response status`, result)
                                                saveSessionLogs({ 
                                                    ...baseDataToSaveLog, 
                                                    errorMessage: `${context} Error - Unknown response status: ${remoteStartTransactionStatus}`,
                                                    errorType: Enums.SessionFlowLogsErrorTypes.EXTERNAL_SERVICE_ERROR,
                                                });
                                                Utils.saveLog(hwId, call[3], result, false, 'RemoteStartTransaction', 'Unknown remoteStart response status', plugId, trigger);
                                                Sentry.captureException(new Error(`Unknown remoteStart response status response ${hwId}`));
                                            } else {
                                                saveSessionLogs({ 
                                                    ...baseDataToSaveLog, 
                                                    errorMessage: `${context} RemoteStartTransaction rejected: ${remoteStartTransactionStatus}`,
                                                    errorType: Enums.SessionFlowLogsErrorTypes.EXTERNAL_SERVICE_ERROR,
                                                });
                                                Utils.saveLog(hwId, call[3], data, false, 'RemoteStartTransaction', 'RemoteStartTransaction rejected', plugId, trigger)
                                            }
                                            const error = {
                                                reasonCode: "other",
                                                reasonText: "Communication not established between the Central System and the Charging Station"
                                            }
                                            stopChargingSession(hwId, plugId, error);
                                            return res.status(400).send({ auth: 'true', code: "server_error_connecting_charging_station", message: `Communication not established between the CS and the charging station ${chargerId}`, sessionId: chargingSession.data._id });
                                        }
                                    });
                                });
                            })
                            .catch(function (error, err) {
                                if (!error)
                                    console.error(`${context} error - Check error 45648431`);
                                else
                                    console.error(`${context} error: , ${JSON.stringify(error)}`);

                                // Utils.saveLog(hwId, req.body , {} , false , 'RemoteStartTransaction' , JSON.stringify(error) , plugId , trigger)

                                if (error) {
                                    if (error.response) {
                                        Utils.saveLog(hwId, req.body , {} , false , 'RemoteStartTransaction' , error.response.data.message , plugId , trigger)
                                        saveSessionLogs({ 
                                            ...baseDataToSaveLog, 
                                            errorMessage: error.response.data.message,
                                            errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_SERVER_ERROR,
                                        });
                                        return res.status(500).send({ auth: true, status: false, message: error.response.data.message });
                                    } else {
                                        Utils.saveLog(hwId, req.body , {} , false , 'RemoteStartTransaction' , error.message , plugId , trigger)
                                        saveSessionLogs({ 
                                            ...baseDataToSaveLog, 
                                            errorMessage: error.message,
                                            errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_SERVER_ERROR,
                                        });
                                        return res.status(500).send({ auth: true, status: false, message: error.message });
                                    }
                                } else {
                                    Utils.saveLog(hwId, req.body , {} , false , 'RemoteStartTransaction' , `Communication not established between the CS and the charging station ${chargerId}` , plugId , trigger)
                                    saveSessionLogs({ 
                                        ...baseDataToSaveLog, 
                                        errorMessage: `Communication not established between the CS and the charging station ${chargerId}`,
                                        errorType: Enums.SessionFlowLogsErrorTypes.DEVICE_COMMUNICATION_ERROR,
                                    });
                                    return res.status(500).send({ auth: true, status: false, message: `Communication not established between the CS and the charging station ${chargerId}` });
                                }

                            });

                    }
                    else {
                        console.error(`Charger ${hwId} does not exists`);
                        saveSessionLogs({ 
                            ...baseDataToSaveLog, 
                            errorMessage: `Error during get charger ${hwId} does not exists`,
                        });
                        Utils.saveLog(hwId, req.body , {} , false , 'RemoteStartTransaction' ,`Charger ${hwId} does not exist` , plugId , trigger)
                        return res.status(500).send({ auth: true, status: false, message: `Charger ${hwId} does not exists` });
                    }
                });

            }
        }
        else {
            const message = `${context} Communication not established between the CS and the charging station ${chargerId}`;
            console.error(message);
            saveSessionLogs({ 
                ...baseDataToSaveLog, 
                errorMessage: message,
                errorType: Enums.SessionFlowLogsErrorTypes.DEVICE_COMMUNICATION_ERROR
            });
            Utils.saveLog(hwId, req.body , {} , false , 'RemoteStartTransaction' ,`Communication not established between the CS and the charging station ${chargerId}` , plugId , trigger)
            return res.status(400).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
        }
        
    } catch (error) {
        const chargerId = req.body.hwId;
        const plugId = req.body.plugId;
        const message = `${context} Communication not established between the CS and the charging station ${chargerId}`;
        console.error(message);
        saveSessionLogs({ 
            ...baseDataToSaveLog, 
            errorMessage: `Error in freeStartTransaction: ${error.message || ''}`,
            errorType: Enums.SessionFlowLogsErrorTypes.DEVICE_COMMUNICATION_ERROR,
            hwId: chargerId,
            plugId: plugId,
            userId: req.body.userId || '',
        });
        Utils.saveLog(req.body.hwId, req.body , {} , false , 'RemoteStartTransaction' ,`Communication not established between the CS and the charging station ${chargerId}` , plugId , trigger)
        return res.status(400).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
    }
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
};