const Promise = require('promise');
const moment = require('moment');
const global = require('../global');
const Utils = require('../utils');
var context = "[StartTransaction] ";
const axios = require("axios");
const crypto = require('crypto');
const Sentry = require("@sentry/node");
const toggle = require('evio-toggle').default;

var host = global.charger_microservice_host;
var host_identity = global.identity_microservice_host;
const chargingSessionProxy = `${host}/api/private/chargingSession`;
const RFIDidTagProxy = `${host}/api/private/chargers/getTariff`;
const checkIdTagProxy = `${host_identity}/api/private/contracts/checkIdTag`;
const chargingSessionStartServiceProxy = `${host}/api/private/chargingSession/start`;

const tariffHost = global.tariff_microservice_host
const SalesTariffProxy = `${tariffHost}/api/private/salesTariff/byId`
const chargerServiceProxy = `${host}/api/private/chargers/status`;
const paymentHost = global.payment_microservice_host
const validatePaymentConditionsProxy = `${paymentHost}/api/private/payments/validatePaymentConditions`
const { saveSessionLogs } = require('../utils/save-session-logs');
const { Enums } = require('evio-library-commons').default;
const { SessionStatusesNumberTypes } = require('../v2/configs/constants')

let commandType = 'START_SESSION'

module.exports = {
    handle: function (data, payload) {
        return new Promise( async function (resolve, reject) {

            const hwId = data.chargeBoxIdentity;
            const transactionId = payload.transactionId;
            const idTag = payload.idTag;
            const timestamp = moment(payload.timestamp).utc();
            const baseDataToSaveLogs = {
                userId: idTag ? `--put session- TAG-${idTag}` : '--put session- TAG-UNKNOWN',
                hwId,
                plugId: payload.connectorId || '',
                stage: "[Handle PUT session OCPP]",
                action: 'start',
                status: Enums.SessionFlowLogsStatus.ERROR,
                errorType: Enums.SessionFlowLogsErrorTypes.VALIDATION_ERROR,
                payload
            }

            // Function to change previous charging session status from 70 to 40 
            changeChargingSessionStatus(
                chargingSessionProxy, 
                hwId, 
                payload.connectorId, 
                process.env.SessionStatusStoppedAndEvParked, 
                process.env.SessionStatusStopped
            )

            /////////////////////////////////////////////////////////////////////////////
            //Get sessionId for given idTag - Get also userId, idTag and sessionId
            let param = {
                idTag: idTag,
                status: {$in: [SessionStatusesNumberTypes.PENDING, SessionStatusesNumberTypes.PENDING_DELAY, SessionStatusesNumberTypes.PENDING_START]},
                hwId: hwId
            };
            const enableSendUid = await toggle.isEnable('charge-315-fix-session-cardnumber-associate_d');
            const idTagToPaymentCondition = enableSendUid ? idTag : ''

            const transactionIdEnabled = await toggle.isEnable('charge-328-ocpp-start-transaction-response');
            global.rejectedTransactionId = transactionIdEnabled ? global.rejectedTransactionId : undefined;

            Utils.getSession(chargingSessionProxy, param).then(async (session) => {
                if (session) {
                    const userId = session.userId;
                    const sessionId = session.sessionId;
                    const internalSessionId = session._id;
                    const fleetId = session.fleetId;

                    baseDataToSaveLogs.userId = userId;
                    baseDataToSaveLogs.sessionId = session._id;
                    /////////////////////////////////////////////////////////////////////////////
                    //Accept startTransaction

                    let params = {
                        userId: userId,
                        plugId: payload.connectorId,
                        hwId: hwId,
                        fleetId: fleetId
                    };

                    let chargingSessionBody = {
                        _id: internalSessionId,
                        status: process.env.SessionStatusRunning,
                        plugId: payload.connectorId,
                        meterStart: payload.meterStart,
                        startDate: timestamp,
                    }

                    if (session.userIdWillPay === "" || session.userIdWillPay === undefined) {

                        if (userId === "UNKNOWN") {
                            Utils.updateChargingSessionWithPlug(chargingSessionProxy, chargingSessionBody);
                            saveSessionLogs({
                                ...baseDataToSaveLogs,
                                status: Enums.SessionFlowLogsStatus.SUCCESS,
                                stage: baseDataToSaveLogs.stage += ' - Charging session updated on FreeCharge mode',
                            })
                            sendResponse(data, global.idTagStatusAccepted, sessionId, resolve, payload, 'StartTransaction on free charge mode', true, payload.connectorId);
                            console.log(`${context} Charging session updated on FreeCharge mode`)
                        } else {
                            Utils.getTariff(RFIDidTagProxy, params)
                                .then(async tariffId => {
                                    //Update charging session to running
                                    if (tariffId != '-1' && tariffId !== null) {
                                        params = {
                                            _id: tariffId
                                        }

                                        const tariff = await Utils.getSalesTariff(SalesTariffProxy, params)

                                        //Aqui, as fees já foram adicionadas as fees à sessão no remote start command
                                        let fees = { IEC: 0.001, IVA: 0.23 }
                                        if (session.fees) {
                                            fees = session.fees;
                                        }

                                        const validatePaymentConditionsData = {
                                            userId: userId,
                                            data: {
                                                hwId: hwId,
                                                plugId: payload.connectorId,
                                                evId: session.evId,
                                                tariffId: tariffId,
                                                chargerType: session.chargerType,
                                                tariff: tariff,
                                                fees: fees,
                                                idTag: idTagToPaymentCondition
                                            }
                                        }

                                        const paymentConditions = await Utils.validatePaymentConditions(validatePaymentConditionsProxy, validatePaymentConditionsData)

                                        if (paymentConditions && tariff) {
                                            chargingSessionBody = {
                                                ...chargingSessionBody,
                                                tariffId: tariffId,
                                                paymentId: paymentConditions.paymentId,
                                                paymentMethod: paymentConditions.paymentMethod,
                                                paymentMethodId: paymentConditions.paymentMethodId,
                                                walletAmount: paymentConditions.walletAmount,
                                                reservedAmount: paymentConditions.reservedAmount,
                                                confirmationAmount: paymentConditions.confirmationAmount,
                                                userIdWillPay: paymentConditions.userIdWillPay,
                                                adyenReference: paymentConditions.adyenReference,
                                                transactionId: paymentConditions.transactionId,
                                                clientType: paymentConditions.clientType,
                                                tariff: tariff,
                                                paymentType: paymentConditions.paymentType,
                                                billingPeriod: paymentConditions.billingPeriod,
                                                userIdToBilling: paymentConditions.userIdToBilling,
                                                plafondId: paymentConditions.plafondId,
                                                clientName: paymentConditions.clientName,
                                                cardNumber: paymentConditions.cardNumber
                                            }

                                            let {userIdInfo ,userIdWillPayInfo , userIdToBillingInfo} = await Utils.getAllUserInfo(userId , paymentConditions.userIdWillPay , paymentConditions.userIdToBilling)
                                            chargingSessionBody.userIdInfo = userIdInfo
                                            chargingSessionBody.userIdWillPayInfo = userIdWillPayInfo
                                            chargingSessionBody.userIdToBillingInfo = userIdToBillingInfo

                                            Utils.updateChargingSessionWithPlug(chargingSessionProxy, chargingSessionBody);
                                            saveSessionLogs({
                                                ...baseDataToSaveLogs,
                                                status: Enums.SessionFlowLogsStatus.SUCCESS,
                                                stage: baseDataToSaveLogs.stage += ' - Charging session updated with payment conditions',
                                            })
                                            sendResponse(data, global.idTagStatusAccepted, sessionId, resolve, payload, 'StartTransaction accepted', true, payload.connectorId);
                                            console.log(`${context} Charging session updated`)
                                        } else {
                                            Utils.updateChargingSessionWithPlug(chargingSessionProxy, { ...chargingSessionBody, status: process.env.SessionStatusFailed, tariffId: '-1' });
                                            saveSessionLogs({
                                                ...baseDataToSaveLogs,
                                                errorMessage: 'StartTransaction rejected due to failure on paymentConditions or tariff',
                                            })
                                            sendResponse(data, global.idTagStatusInvalid, sessionId, resolve, payload, 'StartTransaction rejected due to failure on paymentConditions or tariff', false, payload.connectorId);
                                            console.error(`${context} Charging session failed to update in paymentConditions or tariff`)
                                        }
                                    } else {

                                        if (session.chargerOwner === userId || session.freeOfCharge) {
                                            Utils.updateChargingSessionWithPlug(chargingSessionProxy, { ...chargingSessionBody, tariffId: '-1', userIdWillPay: session.chargerOwner, paymentMethod: process.env.PaymentMethodNotPay });
                                            saveSessionLogs({
                                                ...baseDataToSaveLogs,
                                                status: Enums.SessionFlowLogsStatus.SUCCESS,
                                                stage: baseDataToSaveLogs.stage += ' - Charging session updated with no tariff',
                                            })
                                            sendResponse(data, global.idTagStatusAccepted, sessionId, resolve, payload, 'StartTransaction accepted', true, payload.connectorId);
                                            console.log(`${context} Charging session updated`)
                                        } else {
                                            Utils.updateChargingSessionWithPlug(chargingSessionProxy, { ...chargingSessionBody, status: process.env.SessionStatusFailed, tariffId: '-1' });
                                            saveSessionLogs({
                                                ...baseDataToSaveLogs,
                                                errorMessage: 'StartTransaction rejected because userId is not the owner of CP nad tariff was not found',
                                            })
                                            sendResponse(data, global.idTagStatusInvalid, sessionId, resolve, payload, 'StartTransaction rejected because userId is not the owner of CP nad tariff was not found', false, payload.connectorId);
                                            console.error(`${context} Charging session failed to update. Not found tariff for CP and userId is not thw owner of CP`)
                                        }
                                    }
                                })
                                .catch(error => {
                                    Utils.updateChargingSessionWithPlug(chargingSessionProxy, { ...chargingSessionBody, status: process.env.SessionStatusFailed, tariffId: '-1' });
                                    saveSessionLogs({
                                        ...baseDataToSaveLogs,
                                        errorMessage: `${context} Charging session failed to update : ${error}`,
                                    })
                                    sendResponse(data, global.idTagStatusInvalid, sessionId, resolve, payload, JSON.stringify(error), false, payload.connectorId);
                                    console.error(`${context} Charging session failed to update : ${error}`)
                                })
                        }
                    }
                    else {

                        //Se o pedido vem do remote start transaction, é free charge, ou OCPI, já temos toda a informação necessária dos pagamentos. Não temos que a obter novamente
                        if (session.chargerOwner === userId || session.freeOfCharge || (session.createdWay !== null && session.createdWay !== undefined && session.createdWay.includes('OCPI'))) {
                            chargingSessionBody.tariffId = "-1";
                            chargingSessionBody.tariff = {};
                            chargingSessionBody.paymentMethod = process.env.PaymentMethodNotPay
                            session.status = process.env.SessionStatusRunning

                            if (session.createdWay === process.env.createdWayOcpiRfid) {
                                let evse_uid = `${session.location_id}-${payload.connectorId}`
                                let connector_id = `${evse_uid}-${payload.connectorId}`

                                chargingSessionBody.evse_uid = evse_uid
                                chargingSessionBody.connector_id = connector_id

                                session.evse_uid = evse_uid
                                session.connector_id = connector_id


                            }

                            let commandResultBody = {
                                response_url: session.response_url_start,
                                party_id: session.party_id,
                                network: session.network,
                                hwId: session.hwId,
                                plugId: payload.connectorId,
                                commandType,
                                operatorId: session.operatorId,
                            }

                            Utils.sendCommandResult(session.response_url_start, commandType, { ...commandResultBody, result: 'ACCEPTED', message: '' })
                            Utils.sendPutSession(JSON.parse(JSON.stringify(session)))
                        }
                        Utils.updateChargingSessionWithPlug(chargingSessionProxy, chargingSessionBody);
                        saveSessionLogs({
                            ...baseDataToSaveLogs,
                            stage: baseDataToSaveLogs.stage += ' - Charging session updated',
                            status: Enums.SessionFlowLogsStatus.SUCCESS,
                        })
                        sendResponse(data, global.idTagStatusAccepted, sessionId, resolve, payload, 'StartTransaction accepted', true, payload.connectorId);
                        console.log(`${context} Charging session updated`)

                    }
                } else {
                    /*
                        First, let's check if this transaction was already accepted for some reason. 
                        To do that, we query a session with a certain startDate and meterStart in a specific charger and specifig idTag
                    */
                    param = {
                        idTag: idTag,
                        hwId: hwId,
                        plugId: payload.connectorId,
                        startDate: timestamp.toISOString(),
                        meterStart: payload.meterStart,
                        offlineTransaction: true
                    };

                    Utils.getSession(chargingSessionProxy, param)
                        .then((session) => {
                            if (session) {
                                const sessionId = session.sessionId;
                                saveSessionLogs({
                                    ...baseDataToSaveLogs,
                                    errorMessage: `${context} Charging session already exists`,
                                    externalSessionId: sessionId
                                })
                                sendResponse(data, global.idTagStatusAccepted, sessionId, resolve, payload, 'StartTransaction accepted', true, payload.connectorId);
                                console.log(`${context} Charging session already exists`)
                            } else {
                                /*
                                    If the charging point doesn't have problems and it's not sending repeated transactions,
                                    this sould be a transaction that was autorized offline via local list
                                */
                                console.log(`${context} Offline transaction is being received on charger ${hwId} with idTag ${idTag}`)

                                Utils.chekIfChargerExists(chargerServiceProxy, { hwId })
                                    .then(async (charger) => {

                                        if (charger) {
                                            let chargerType = charger.chargerType ? charger.chargerType : global.OCPPJ_16_DeviceType

                                            let params = {
                                                idTag: idTag,
                                                hwId: hwId,
                                                chargerType
                                            };

                                            Utils.checkIdTagValidity(checkIdTagProxy, params)
                                                .then(async (contract) => {
                                                    let fees = await Utils.getFees(charger)
                                                    if (contract) {

                                                        const userId = contract.userId;
                                                        let evId = "-1";
                                                        if (contract.contractType === "fleet") {
                                                            evId = contract.evId;
                                                        }

                                                        let fleetId = "-1";
                                                        if (contract.contractType === "fleet") {
                                                            fleetId = contract.fleetId;
                                                        }

                                                        params = {
                                                            userId: userId,
                                                            plugId: payload.connectorId,
                                                            hwId: hwId,
                                                            fleetId: fleetId
                                                        };

                                                        let chargingSessionBody = {
                                                            'hwId': hwId,
                                                            'fleetId': fleetId,
                                                            'evId': evId,
                                                            'idTag': idTag,
                                                            'sessionPrice': -1,
                                                            'command': process.env.StartCommand,
                                                            'chargerType': chargerType,
                                                            'status': process.env.SessionStatusRunning,
                                                            'userId': userId,
                                                            'startDate': timestamp,
                                                            'authType': 'UNKNOWN',
                                                            'tariffId': -1,
                                                            "plugId": payload.connectorId,
                                                            "meterStart": payload.meterStart,
                                                            'address': charger.address,
                                                            'freeOfCharge': charger.accessType === process.env.ChargerAccessFreeCharge,
                                                            'operatorId': charger.operatorId,
                                                        }

                                                        Utils.getTariff(RFIDidTagProxy, params)
                                                            .then(async tariffId => {
                                                                //Update charging session to running
                                                                if (tariffId != '-1' && tariffId !== null) {
                                                                    params = {
                                                                        _id: tariffId
                                                                    }

                                                                    const tariff = await Utils.getSalesTariff(SalesTariffProxy, params)

                                                                    const validatePaymentConditionsData = {
                                                                        userId: userId,
                                                                        data: {
                                                                            hwId: hwId,
                                                                            plugId: payload.connectorId,
                                                                            evId: evId,
                                                                            tariffId: tariffId,
                                                                            chargerType,
                                                                            tariff: tariff,
                                                                            fees: fees,
                                                                            idTag: idTagToPaymentCondition
                                                                        }
                                                                    }
                                                                    const paymentConditions = await Utils.validatePaymentConditions(validatePaymentConditionsProxy, validatePaymentConditionsData)

                                                                    if (paymentConditions && tariff) {
                                                                        chargingSessionBody = {
                                                                            ...chargingSessionBody,
                                                                            tariffId: tariffId,
                                                                            paymentId: paymentConditions.paymentId,
                                                                            paymentMethod: paymentConditions.paymentMethod,
                                                                            paymentMethodId: paymentConditions.paymentMethodId,
                                                                            walletAmount: paymentConditions.walletAmount,
                                                                            reservedAmount: paymentConditions.reservedAmount,
                                                                            confirmationAmount: paymentConditions.confirmationAmount,
                                                                            userIdWillPay: paymentConditions.userIdWillPay,
                                                                            adyenReference: paymentConditions.adyenReference,
                                                                            transactionId: paymentConditions.transactionId,
                                                                            clientType: paymentConditions.clientType,
                                                                            tariff: tariff,
                                                                            paymentType: paymentConditions.paymentType,
                                                                            billingPeriod: paymentConditions.billingPeriod,
                                                                            userIdToBilling: paymentConditions.userIdToBilling,
                                                                            plafondId: paymentConditions.plafondId,
                                                                            clientName: paymentConditions.clientName,
                                                                            cardNumber: paymentConditions.cardNumber
                                                                        }

                                                                        let {userIdInfo ,userIdWillPayInfo , userIdToBillingInfo} = await Utils.getAllUserInfo(userId , paymentConditions.userIdWillPay , paymentConditions.userIdToBilling)
                                                                        chargingSessionBody.userIdInfo = userIdInfo
                                                                        chargingSessionBody.userIdWillPayInfo = userIdWillPayInfo
                                                                        chargingSessionBody.userIdToBillingInfo = userIdToBillingInfo
                                                                        chargingSessionBody.fees = await Utils.getFeesWithUser(charger, chargingSessionBody.userIdToBilling)
                                                                        
                                                                        axios.post(chargingSessionStartServiceProxy, chargingSessionBody)
                                                                            .then(function (chargingSession) {
                                                                                if (chargingSession) {
                                                                                    saveSessionLogs({
                                                                                        ...baseDataToSaveLogs,
                                                                                        status: Enums.SessionFlowLogsStatus.SUCCESS,
                                                                                        stage: baseDataToSaveLogs.stage += ' - Offline charging session created',
                                                                                    })
                                                                                    sendResponse(data, global.idTagStatusAccepted, chargingSession.data.sessionId, resolve, payload, 'Offline StartTransaction accepted', true, payload.connectorId);
                                                                                    console.log(`${context} Offline charging session created`)
                                                                                }
                                                                                else {
                                                                                    saveSessionLogs({
                                                                                        ...baseDataToSaveLogs,
                                                                                        errorMessage: `${context} Offline charging session creation failed`
                                                                                    })
                                                                                    sendResponse(data, global.idTagStatusInvalid, global.rejectedTransactionId, resolve, payload, 'Offline StartTransaction failed to create', false, payload.connectorId);
                                                                                    console.error(`${context} Offline charging session creation failed`)
                                                                                }
                                                                            })
                                                                            .catch(function (error, err) {
                                                                                if (!error) {
                                                                                    console.error(`${context} error - Check error 5554896124`);
                                                                                    saveSessionLogs({
                                                                                        ...baseDataToSaveLogs,
                                                                                        errorMessage: `${context} Charging session failed to create`,
                                                                                    })
                                                                                }
                                                                                else {
                                                                                    console.error(`${context} error: , ${JSON.stringify(error)}`);
                                                                                    saveSessionLogs({
                                                                                        ...baseDataToSaveLogs,
                                                                                        errorMessage: `${context} Charging session failed to create: ${JSON.stringify(error)}`,
                                                                                    })
                                                                                }
                                                                                
                                                                                sendResponse(data, global.idTagStatusInvalid, global.rejectedTransactionId, resolve, payload, JSON.stringify(error), false, payload.connectorId);
                                                                            });
                                                                    } else {
                                                                        saveSessionLogs({
                                                                            ...baseDataToSaveLogs,
                                                                            errorMessage: `${context} Offline StartTransaction rejected due to failure on paymentConditions or tariff`,
                                                                        })
                                                                        sendResponse(data, global.idTagStatusInvalid, global.rejectedTransactionId, resolve, payload, 'Offline StartTransaction rejected due to failure on paymentConditions or tariff', false, payload.connectorId);
                                                                        console.error(`${context} Charging session failed to create in paymentConditions or tariff`)
                                                                    }

                                                                } else {

                                                                    axios.post(chargingSessionStartServiceProxy, chargingSessionBody)
                                                                        .then(function (chargingSession) {
                                                                            if (chargingSession) {
                                                                                if (chargingSession.data.chargerOwner === userId || charger.accessType === process.env.ChargerAccessFreeCharge) {
                                                                                    Utils.updateChargingSessionWithPlug(chargingSessionProxy, { ...chargingSessionBody, _id: chargingSession.data._id, tariffId: '-1', paymentMethod: process.env.PaymentMethodNotPay });
                                                                                    saveSessionLogs({
                                                                                        ...baseDataToSaveLogs,
                                                                                        status: Enums.SessionFlowLogsStatus.SUCCESS,
                                                                                        stage: baseDataToSaveLogs.stage += ' - Offline StartTransaction accepted',
                                                                                    })
                                                                                    sendResponse(data, global.idTagStatusAccepted, chargingSession.data.sessionId, resolve, payload, 'Offline StartTransaction accepted', true, payload.connectorId);
                                                                                    console.log(`${context} Charging session updated`)
                                                                                } else {
                                                                                    Utils.updateChargingSessionWithPlug(chargingSessionProxy, { ...chargingSessionBody, _id: chargingSession.data._id, status: process.env.SessionStatusFailed, tariffId: '-1' });
                                                                                    saveSessionLogs({
                                                                                        ...baseDataToSaveLogs,
                                                                                        errorMessage: `${context} Offline StartTransaction rejected because userId is not the owner of CP nad tariff was not found`,
                                                                                    })
                                                                                    sendResponse(data, global.idTagStatusInvalid, chargingSession.data.sessionId, resolve, payload, 'Offline StartTransaction rejected because userId is not the owner of CP nad tariff was not found', false, payload.connectorId);
                                                                                    console.error(`${context} Charging session failed to update. Not found tariff for CP and userId is not thw owner of CP`)
                                                                                }
                                                                            }
                                                                            else {
                                                                                saveSessionLogs({
                                                                                    ...baseDataToSaveLogs,
                                                                                    errorMessage: `${context} Offline StartTransaction failed to create`,
                                                                                })
                                                                                sendResponse(data, global.idTagStatusInvalid, global.rejectedTransactionId, resolve, payload, 'Offline StartTransaction failed to create', false, payload.connectorId);
                                                                                console.log(`${context} Offline charging session with no tariffId creation failed`)
                                                                            }
                                                                        })
                                                                        .catch(function (error, err) {
                                                                            if (!error) {
                                                                                console.error(`${context} error - Check error 5554896124`);
                                                                                saveSessionLogs({
                                                                                    ...baseDataToSaveLogs,
                                                                                    errorMessage: `${context} Charging session failed to create`,
                                                                                })
                                                                            }
                                                                            else {
                                                                                saveSessionLogs({
                                                                                    ...baseDataToSaveLogs,
                                                                                    errorMessage: `${context} Charging session failed to create: ${JSON.stringify(error)}`,
                                                                                })
                                                                                console.error(`${context} error: , ${JSON.stringify(error)}`);
                                                                            }
                                                                            sendResponse(data, global.idTagStatusInvalid, global.rejectedTransactionId, resolve, payload, JSON.stringify(error), false, payload.connectorId);
                                                                        });
                                                                }
                                                            })
                                                            .catch(error => {
                                                                saveSessionLogs({
                                                                    ...baseDataToSaveLogs,
                                                                    errorMessage: `${context} Charging session failed on getTariff: ${error.message}`,
                                                                })
                                                                sendResponse(data, global.idTagStatusInvalid, global.rejectedTransactionId, resolve, payload, JSON.stringify(error), false, payload.connectorId);
                                                                console.error(`${context} Charging session failed on getTariff: ${error}`)
                                                            })
                                                    }
                                                    else {
                                                        console.error(`${context} Invalid id tag but we'll create it in offline mode with idTag `, idTag);

                                                        let chargingSessionBody = {}
                                                        if (charger.accessType === process.env.ChargerAccessPublic) {
                                                            console.log(`Public Charger on unknown idTag ${idTag}`)
                                                            //Check which networks are active on the charger
                                                            let networkMobiE = charger.networks.find(obj => obj.network === process.env.MobiePlatformCode && obj.activationRequest && obj.status === process.env.ChargerNetworkStatusActive)
                                                            let networkGireve = charger.networks.find(obj => obj.network === process.env.GirevePlatformCode && obj.activationRequest && obj.status === process.env.ChargerNetworkStatusActive)

                                                            // Check if MobiE is active
                                                            if (networkMobiE) {
                                                                console.log(`Network MobiE`)
                                                                //Check if token exists on MobiE 
                                                                const { location_id, evse_uids } = Utils.getChargerLocationEvses(charger, networkMobiE)
                                                                
                                                                let authorizedMobiE = await Utils.authorizeToken(networkMobiE.network, networkMobiE.party_id, idTag, process.env.tokenRFID, location_id, evse_uids)
                                                                if (authorizedMobiE) {
                                                                    console.log(`authorizedMobiE`, JSON.stringify(authorizedMobiE))
                                                                    chargingSessionBody = buildOfflineChargingSessionBody(hwId, idTag, chargerType, timestamp, payload, fees, charger, networkMobiE, process.env.MobiePlatformCode, process.env.authMethodRequest, authorizedMobiE, process.env.createdWayOcpiOffline)
                                                                } else {
                                                                    //Check if Gireve is active
                                                                    if (networkGireve) {
                                                                        //Check if token exists on Gireve 
                                                                        const { location_id, evse_uids } = Utils.getChargerLocationEvses(charger, networkGireve)
                                                                        let authorizedGireve = await Utils.authorizeToken(networkGireve.network, networkGireve.party_id, idTag, process.env.tokenRFID, location_id, evse_uids)
                                                                        if (authorizedGireve) {
                                                                            console.error(`authorizedGireve`, JSON.stringify(authorizedGireve))
                                                                            chargingSessionBody = buildOfflineChargingSessionBody(hwId, idTag, chargerType, timestamp, payload, fees, charger, networkGireve, process.env.GirevePlatformCode, process.env.authMethodRequest, authorizedGireve, process.env.createdWayOcpiOffline)
                                                                        } else {
                                                                            console.error(`Unknown idTag ${idTag} will be created on MobiE`)
                                                                            chargingSessionBody = buildOfflineChargingSessionBody(hwId, idTag, chargerType, timestamp, payload, fees, charger, networkMobiE, process.env.MobiePlatformCode, process.env.authMethodWhitelist, null, process.env.createdWayOcpiOfflineUnknown)
                                                                        }
                                                                    } else {
                                                                        console.error(`Unknown idTag ${idTag} will be created on MobiE`)
                                                                        chargingSessionBody = buildOfflineChargingSessionBody(hwId, idTag, chargerType, timestamp, payload, fees, charger, networkMobiE, process.env.MobiePlatformCode, process.env.authMethodWhitelist, null, process.env.createdWayOcpiOfflineUnknown)
                                                                    }
                                                                }
                                                            } else if (networkGireve) {
                                                                console.log(`Network Gireve`)
                                                                //Check if token exists on Gireve 
                                                                const { location_id, evse_uids } = Utils.getChargerLocationEvses(charger, networkGireve)
                                                                let authorizedGireve = await Utils.authorizeToken(networkGireve.network, networkGireve.party_id, idTag, process.env.tokenRFID, location_id, evse_uids)
                                                                if (authorizedGireve) {
                                                                    console.log(`authorizedGireve`, JSON.stringify(authorizedGireve))
                                                                    chargingSessionBody = buildOfflineChargingSessionBody(hwId, idTag, chargerType, timestamp, payload, fees, charger, networkGireve, process.env.GirevePlatformCode, process.env.authMethodRequest, authorizedGireve, process.env.createdWayOcpiOffline)


                                                                } else {
                                                                    console.error(`Unknown idTag ${idTag} will be created on EVIO`)
                                                                    chargingSessionBody = buildOfflineChargingSessionBody(hwId, idTag, chargerType, timestamp, payload, fees, charger, null, process.env.EvioNetwork, "", null, process.env.createdWayEvioOffline)
                                                                }
                                                            } else {
                                                                console.error(`Unknown idTag ${idTag} will be created on EVIO`)
                                                                chargingSessionBody = buildOfflineChargingSessionBody(hwId, idTag, chargerType, timestamp, payload, fees, charger, null, process.env.EvioNetwork, "", null, process.env.createdWayEvioOffline)
                                                            }
                                                        } else {
                                                            console.error(`Unknown idTag ${idTag} will be created on EVIO`)
                                                            chargingSessionBody = buildOfflineChargingSessionBody(hwId, idTag, chargerType, timestamp, payload, fees, charger, null, process.env.EvioNetwork, "", null, process.env.createdWayEvioOffline)
                                                        }

                                                        console.log(`chargingSessionBody`, JSON.stringify(chargingSessionBody))
                                                        axios.post(chargingSessionStartServiceProxy, chargingSessionBody)
                                                            .then(function (chargingSession) {
                                                                if (!chargingSession) {
                                                                    console.error(`${context} Offline charging session creation failed `,chargingSessionBody)
                                                                    saveSessionLogs({
                                                                        ...baseDataToSaveLogs,
                                                                        errorMessage: `Offline charging session creation failed for charger ${hwId}`,
                                                                    })
                                                                    Sentry.captureException(new Error(`Offline charging session creation failed for charger ${hwId}`));
                                                                }
                                                                else {                                                                    
                                                                    console.log(`${context} Offline charging session created`)
                                                                    saveSessionLogs({
                                                                        ...baseDataToSaveLogs,
                                                                        status: Enums.SessionFlowLogsStatus.SUCCESS,
                                                                        stage: baseDataToSaveLogs.stage += ' - Offline charging session created',
                                                                    })
                                                                }
                                                                Utils.sendPutSession(chargingSession.data)
                                                                if(charger.accessType === process.env.ChargerAccessFreeCharge){
                                                                    console.log(`${context} IdTag Accepted because ${hwId} is on Free Charge mode`);
                                                                    sendResponse(data, global.idTagStatusAccepted, chargingSession.data.sessionId, resolve, payload, 'Offline StartTransaction accepted', true, payload.connectorId);
                                                                }else{
                                                                    sendResponse(data, global.idTagStatusInvalid, chargingSession.data.sessionId, resolve, payload, 'Offline StartTransaction Rejected', true, payload.connectorId);
                                                                }
                                                               
                                                            })
                                                            .catch(function (error, err) {
                                                                if (!error) {
                                                                    console.error(`${context} error - Check error 5554896124`);
                                                                    saveSessionLogs({
                                                                        ...baseDataToSaveLogs,
                                                                        errorMessage: `${context} Charging session failed to create`,
                                                                    })
                                                                }
                                                                else {
                                                                    console.error(`${context} error: , ${JSON.stringify(error)}`);
                                                                    saveSessionLogs({
                                                                        ...baseDataToSaveLogs,
                                                                        errorMessage: `${context} Charging session failed to create: ${JSON.stringify(error)}`,
                                                                    })
                                                                }
                                                                sendResponse(data, global.idTagStatusInvalid, global.rejectedTransactionId, resolve, payload, JSON.stringify(error), false, payload.connectorId);
                                                            });
                                                    }
                                                })
                                                .catch(error => {
                                                    console.error(`${context} Session failed on checkIdTagValidity ${error.message}`)
                                                    saveSessionLogs({
                                                        ...baseDataToSaveLogs,
                                                        errorMessage: `${context} Session failed on checkIdTagValidity ${error.message}`,
                                                    })
                                                    sendResponse(data, global.idTagStatusInvalid, global.rejectedTransactionId, resolve, payload, JSON.stringify(error), false, payload.connectorId);
                                                });
                                        }
                                        else {
                                            console.error(`${context} Charger ${hwId} does not exists`)
                                            saveSessionLogs({
                                                ...baseDataToSaveLogs,
                                                errorMessage: `${context} Charger ${hwId} does not exists`,
                                            })
                                            sendResponse(data, global.idTagStatusInvalid, global.rejectedTransactionId, resolve, payload, `Charger ${hwId} does not exist`, false, payload.connectorId);
                                        }
                                    })
                                    .catch(error => {
                                        console.error(`${context} Session failed on chekIfChargerExists ${error.message}`)
                                        saveSessionLogs({
                                            ...baseDataToSaveLogs,
                                            errorMessage: `${context} Session failed on chekIfChargerExists ${error.message}`,
                                        })
                                        sendResponse(data, global.idTagStatusInvalid, global.rejectedTransactionId, resolve, payload, JSON.stringify(error), false, payload.connectorId);
                                    });
                            }
                        })
                        .catch(error => {
                            console.error(`${context} Error ${error.message}`)
                            saveSessionLogs({
                                ...baseDataToSaveLogs,
                                errorMessage: `${context} Error ${error.message}`,
                            })
                            sendResponse(data, global.idTagStatusInvalid, global.rejectedTransactionId, resolve, payload, JSON.stringify(error), false, payload.connectorId);
                        })
                }
            });
        });
    }
}

const sendResponse = (data, status, transactionId, resolve, payload, text, success, plugId) => {
    const StartTransactionResponse = [global.callResult, data.messageId, {
        idTagInfo: {
            status: status
        },
        transactionId: transactionId
    }];

    Utils.saveLog(data.chargeBoxIdentity, payload, StartTransactionResponse[2], success, 'StartTransaction', text, plugId, global.triggeredByCP)

    resolve(StartTransactionResponse);
};

function changeChargingSessionStatus(ServiceProxy, hwId, plugId, currentStatus, newStatus) {

    return new Promise((resolve, reject) => {
        let params = {
            hwId: hwId,
            plugId: plugId,
            status: currentStatus
        };
        // Fetching session with currentStatus
        Utils.getSession(ServiceProxy, params)
            .then((session) => {
                // if session exists, we want to update to a new status
                if (session) {
                    let body = {
                        _id: session._id,
                        status: newStatus
                    }
                    Utils.updateChargingSessionWithPlug(ServiceProxy, body)
                    console.log(`${context} Updated status ${currentStatus} to ${newStatus}`)
                    resolve(true)

                } else {
                    console.error(`${context} No charging session with status ${currentStatus} was found`)
                    resolve(false)
                }
            })
            .catch(error => {
                console.error(`${context} Failed fetching Session`)
                resolve(false)
            })
    });
}

function buildOfflineChargingSessionBody(hwId, idTag, chargerType, timestamp, payload, fees, charger, networkObj, network, auth_method, authorizedObj, createdWay) {
    const context = "Function buildChargingSessionBody"
    try {

        if (network && network !== process.env.EvioNetwork) {
            let cdr_token = authorizedObj ? Utils.buildCdrToken(network, authorizedObj.token, idTag) : Utils.buildCdrToken(network, null, idTag)
            return {
                'hwId': hwId,
                'fleetId': "-1",
                'evId': "-1",
                'idTag': idTag,
                'sessionPrice': -1,
                'command': process.env.StartCommand,
                'chargerType': chargerType,
                'status': process.env.SessionStatusRunning,
                'userId': "UNKNOWN",
                'plugId': payload.connectorId,
                'startDate': timestamp,
                'authType': 'UNKNOWN',
                'tariffId': "-1",
                'fees': fees,
                "meterStart": payload.meterStart,
                'address': charger.address,
                'userIdWillPay': charger.operatorId,
                'userIdToBilling': charger.operatorId,
                'operatorId': charger.operatorId,
                'freeOfCharge': charger.accessType === process.env.ChargerAccessFreeCharge,
                'paymentMethod': process.env.PaymentMethodNotPay,
                'createdWay': createdWay,
                'network': network,
                'country_code': networkObj.country_code,
                'party_id': networkObj.party_id,
                'cdr_token': cdr_token,
                // 'response_url': response_url,
                // 'authorization_reference': authorization_reference,
                'location_id': networkObj.id,
                'evse_uid': `${networkObj.id}-${payload.connectorId}`,
                'connector_id': `${networkObj.id}-${payload.connectorId}-${payload.connectorId}`,
                'ocpiId': crypto.randomUUID(),
                'auth_method': auth_method,
                'cpoTariffIds' : Utils.getCpoTariffIds(charger.plugs, network)

            }
        } else {
            return {
                'hwId': hwId,
                'fleetId': "-1",
                'evId': "-1",
                'idTag': idTag,
                'sessionPrice': -1,
                'command': process.env.StartCommand,
                'chargerType': chargerType,
                'status': process.env.SessionStatusRunning,
                'userId': 'UNKNOWN',
                'startDate': timestamp,
                'authType': 'UNKNOWN',
                'tariffId': -1,
                'fees': fees,
                "plugId": payload.connectorId,
                "meterStart": payload.meterStart,
                'address': charger.address,
                'userIdWillPay': charger.createUser,
                'paymentMethod': process.env.PaymentMethodNotPay,
                'userIdToBilling': charger.createUser,
                'operatorId': charger.operatorId,
                'freeOfCharge': charger.accessType === process.env.ChargerAccessFreeCharge,
                'createdWay': createdWay,
            }
        }

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return {}
    }
}
