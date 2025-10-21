const axios = require('axios');
const _ = require("underscore");
const global = require('../../../global');
const Token = require('../../../models/tokens')
const Utils = require('../../../utils');
const versions = require('../versions/platformVersions');
const Session = require('../../../models/sessions')
const checkDigitMobility = require('../../../digitCalculation/digitCalculation')
const fs = require("fs");
const rawdata = fs.readFileSync('./digitCalculation/lists.json');
const checkDigitLists = JSON.parse(rawdata);
var managementToken = require('./../tokens/managementToken');
const Sentry = require("@sentry/node");
const vatService = require('../../../services/vat')

const { getUserCoordinates } = require('../../../functions/coordinates');
const { Enums } = require('evio-library-commons').default;
const { saveSessionLogs } = require('../../../functions/save-session-logs');


module.exports = {
    post: function (req, res) {
        const context = '[remoteStartSession]';
        const stageToLog = '[RemoteStartSession 2.2] - Route [POST /api/private/2.2/ocpi/start]';
        const actionToLog = 'start';

        return new Promise(async (resolve, reject) => {

            const data = req.body;
            if (Utils.isEmptyObject(data)) {
                saveSessionLogs({
                    userId: req.headers['userid'] || '',
                    hwId: '',
                    plugId: '',
                    stage: stageToLog,
                    action: actionToLog,
                    status: Enums.SessionFlowLogsStatus.ERROR,
                    errorType: Enums.SessionFlowLogsErrorTypes.VALIDATION_ERROR,
                    errorMessage: 'Empty request body',
                })
                reject({ auth: false, code: "server_data_required", message: 'Data required' });
                return;
            }

            let paymentType = "MONTHLY"; //By default user has contract with EVIO CEME, has the payment method is monthly

            let idTag = req.body.idTag;

            const { hwId = '', evId = '', plugId = '', ceme = '' } = req.body;
            const userId = req.headers['userid'];
            const baseDataToSaveLog = {
                userId,
                hwId,
                plugId,
                stage: stageToLog,
                action: actionToLog,
                status: Enums.SessionFlowLogsStatus.ERROR,
                payload: req.body,
                errorType: Enums.SessionFlowLogsErrorTypes.VALIDATION_ERROR,
            }

            if (!hwId) {
                saveSessionLogs({ ...baseDataToSaveLog, errorMessage: 'HwId is required'})
                reject({ auth: false, code: "server_hw_required", message: 'HwId required' });
                return;
            }

            if (!evId) {
                saveSessionLogs({ ...baseDataToSaveLog, errorMessage: 'EV ID is required'})
                reject({ auth: false, code: "server_ev_id_required", message: 'EV ID required' });
                return;
            }

            if (!plugId) {
                saveSessionLogs({ ...baseDataToSaveLog, errorMessage: 'Plug ID is required'})
                reject({ auth: false, code: "server_plug_id_required", message: 'Plug ID required' });
                return;
            }

            if (!ceme) {
                saveSessionLogs({ ...baseDataToSaveLog, errorMessage: 'Ceme is required'})
                reject({ auth: false, code: "server_ceme_required", message: 'ceme required' });
                return;
            }

            let billingPeriod = req.body.billingPeriod;
            if (!billingPeriod) {
                billingPeriod = "AD_HOC"
            }


            //if idTag == -1, it indicates that a valid token could not be found or created.
            if (idTag == "-1") {
                saveSessionLogs({ ...baseDataToSaveLog, errorMessage: 'idTag cannot be -1', errorType: Enums.SessionFlowLogsErrorTypes.AUTHENTICATION_ERROR })
                Sentry.captureMessage(`Error creating Token: ${hwId}, ${userId}`);
                sendRejectResponse(reject, "server_error_token_not_found", "Error creating Token", 'idTag == -1', "No session created for this error", hwId, userId, "-1");
                return;

                /*await createToken(userId, evId).then(result => {
                    // paymentType = 'AD_HOC' //If user has not contract with EVIO CEME, he can start charging session with AD_HOC method
                    idTag = result.token.uid;
                    console.log(idTag)

                }).catch((e) => {
                    sendRejectResponse(reject, "server_error_creating_token", "Error creating AD_HOC_USER Token", JSON.stringify(e), "No session created for this error", hwId, userId, "-1");
                    return;
                })*/
            }

            let query = { uid: idTag };
            Token.findOne(query, { _id: 0, userId: 0, __v: 0, createdAt: 0, updatedAt: 0, source: 0 }, (err, token) => {
                //console.log(token)

                if (typeof token !== 'undefined' && token !== null) {

                    const chargersEndpoint = global.publicNetworkChargersProxy + "/" + hwId;
                    axios.get(chargersEndpoint, data, {}).then(async function (response) {

                        if (typeof response.data !== 'undefined' && response.data !== '') {

                            const charger = response.data;
                            const plugs = charger.plugs;

                            const plug = _.where(plugs, { plugId: plugId });
                            if (typeof plug !== 'undefined' && plug.length > 0) {
                                const evse_uid = plug[0].uid;
                                const authorization_reference = Utils.generateToken(24);
                                const platformCode = charger.network;

                                let tariffId;
                                let plugPower = 22
                                let plugVoltage = 400
                                if (plug) {
                                    tariffId = plug[0].tariffId[0];
                                    plugPower = plug[0].power
                                    plugVoltage = plug[0].voltage
                                }
                                let tariffOPC = {};
                                if (tariffId) {
                                    tariffOPC = await Utils.getTariffOPC(tariffId);
                                }

                                let tariffCEME = "";
                                /*
                                    When charging in MobiE, ceme is an object with the keys plan,schedule and tar
                                */
                                if (ceme) {
                                    // tariffCEME = ceme.plan;
                                    if (!Utils.isEmptyObject(ceme.plan)) {
                                        // tariffCEME = ceme.plan
                                        tariffCEME = ceme.plan
                                        let tariffArray = Utils.getTariffCemeByDate(tariffCEME, new Date().toISOString())
                                        tariffCEME.tariff = tariffArray
                                    } else {
                                        // tariffCEME = await Utils.getTariffCEME(req.body.clientName);
                                        tariffCEME = await Utils.getTariffCEME(req.body.clientName);
                                        let tariffArray = Utils.getTariffCemeByDate(tariffCEME, new Date().toISOString())
                                        tariffCEME.tariff = tariffArray
                                    }
                                } else {
                                    // tariffCEME = await Utils.getTariffCEME(req.body.clientName);
                                    tariffCEME = await Utils.getTariffCEME(req.body.clientName);
                                    let tariffArray = Utils.getTariffCemeByDate(tariffCEME, new Date().toISOString())
                                    tariffCEME.tariff = tariffArray
                                }

                                // GET TAR AND SCHEDULES
                                let timeZone = charger.timeZone
                                if (!timeZone) {
                                    let { latitude, longitude } = Utils.getChargerLatitudeLongitude(charger.geometry)
                                    timeZone = Utils.getTimezone(latitude, longitude)
                                }
                                let { tariffTAR, TAR_Schedule } = await Utils.getCEMEandTar(tariffCEME._id, timeZone, charger.source, req.body.clientName)


                                const fees = await vatService.getFees(charger, req.body.userIdToBilling)
                                console.debug(`${context} Fetched fees for charger`, fees, charger?.hwId);
                                let  ev;
                                let fleet;
                                if( evId !=='-1'){
                                    const getEVAllByEvId = await Utils.getEVAllByEvId(evId);
                                    ev = getEVAllByEvId.ev
                                    fleet = getEVAllByEvId.fleet
                                }

                                let { userIdInfo, userIdWillPayInfo, userIdToBillingInfo } = await Utils.getAllUserInfo(userId, req.body.userIdWillPay, req.body.userIdToBilling)

                                let invoiceType = ev?.invoiceType;
                                let invoiceCommunication = ev?.invoiceCommunication;

                                versions.getPlatformVersionsByPlatformCode(platformCode).then(platform => {

                                    //get Mobie Details
                                    const platformDetails = platform.platformDetails;

                                    //Get Mobie Endpoint to 2.2 OCPI versions
                                    const platformDetails22 = _.where(platformDetails, { version: "2.2" });
                                    const platformEndpoints22 = platformDetails22[0].endpoints

                                    const platformCommandsEndpointObject = _.where(platformEndpoints22, { identifier: "commands", role: "RECEIVER" });
                                    if (platformCommandsEndpointObject === undefined || platformCommandsEndpointObject.length == 0) {
                                        saveSessionLogs({
                                            ...baseDataToSaveLog,
                                            errorMessage: `Error during check platform commands - Charger does not allow remote commands`,
                                            stage: `[RemoteStartSession 2.2] - check platform commands`
                                        })
                                        reject({ auth: false, code: "server_charger_does_not_allow_remote_commands", message: 'Server does not allow remote commands' });
                                        return;
                                    }

                                    const platformCommandsEndpoint = platformCommandsEndpointObject[0].url;

                                    const platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: "2.2" })
                                    const mobieToken = platformActiveCredentials[0].token;

                                    //Get platform Endpoint of commands SENDER
                                    const endpoint = platformCommandsEndpoint + '/START_SESSION';
                                    const response_url = platform.responseUrlSessionRemoteStart + '/START_SESSION/' + authorization_reference;

                                    console.log("response_url", response_url);
                                    const auth_method = "WHITELIST";
                                    const token_type = token.type;

                                    if (req.body.clientType == "b2c")
                                        paymentType = "AD_HOC";

                                    const data = {
                                        userId: userId,
                                        evId: evId,
                                        operator: charger.partyId,
                                        source: charger.source,
                                        country_code: "PT",
                                        party_id: charger.partyId,
                                        chargeOwnerId: charger.partyId,
                                        //start_date_time: new Date().toISOString(),
                                        token_uid: idTag,
                                        token_type: token_type,
                                        auth_method: auth_method,
                                        paymentStatus: "UNPAID",
                                        paymentMethod: req.body.paymentMethod,
                                        chargerType: req.body.chargerType,
                                        paymentType: req.body.paymentType,
                                        paymentMethodId: req.body.paymentMethodId,
                                        walletAmount: req.body.walletAmount,
                                        reservedAmount: req.body.reservedAmount,
                                        clientName: req.body.clientName,
                                        confirmationAmount: req.body.confirmationAmount,
                                        userIdWillPay: req.body.userIdWillPay,
                                        adyenReference: req.body.adyenReference,
                                        transactionId: req.body.transactionId,
                                        evOwner: req.body.evOwner,
                                        invoiceType: invoiceType,
                                        invoiceCommunication: invoiceCommunication,
                                        userIdToBilling: req.body.userIdToBilling,
                                        location_id: hwId,
                                        evse_uid: evse_uid,
                                        connector_id: plugId,
                                        voltageLevel: charger.voltageLevel,
                                        currency: "EUR",
                                        status: "PENDING",
                                        command: "START_SESSION",
                                        autoStop: req.body.autoStop,
                                        last_updated: new Date().toISOString(),
                                        authorization_reference: authorization_reference,
                                        tariffOPC: tariffOPC,
                                        tariffCEME: tariffCEME,
                                        fees: fees,
                                        cdrId: "-1",
                                        viesVAT: req.body.viesVAT,
                                        address: charger.address,
                                        cpoCountryCode: charger.cpoCountryCode,
                                        billingPeriod: billingPeriod,
                                        createdWay: "REMOTE_START_SESSION",
                                        schedulesCEME: TAR_Schedule,
                                        tariffTAR: tariffTAR,
                                        timeZone: timeZone,
                                        plugPower,
                                        plugVoltage,
                                        plafondId: req.body.plafondId,
                                        cardNumber: req.body.cardNumber,
                                        evDetails: ev,
                                        fleetDetails: fleet,
                                        userIdInfo,
                                        userIdWillPayInfo,
                                        userIdToBillingInfo,
                                        updateKMs: false,
                                        acceptKMs: false
                                    };


                                    //Check if there is already a pending session
                                    let query = {
                                        location_id: hwId,
                                        evse_uid: evse_uid,
                                        status: "PENDING"

                                    };

                                    // add km EVIO 1478
                                    if (ev && evId !== "-1") {
                                        if (ev.acceptKMs) data.acceptKMs = ev.acceptKMs
                                        if (ev.updateKMs) data.updateKMs = ev.updateKMs
                                    }

                                    const userCoordinates = getUserCoordinates(req.body);
                                    if (userCoordinates) {
                                        data.userCoordinates = userCoordinates
                                    }

                                    Session.find(query, (err, session) => {

                                        if (typeof session !== 'undefined' && session !== null && session.length > 0) {

                                            console.log("[RemoteStartTransaction] Charger occupied!")
                                            saveSessionLogs({
                                                ...baseDataToSaveLog,
                                                errorMessage: `Charger ${hwId} occupied by another session`,
                                                stage: `[RemoteStartSession 2.2] - Find by query ${JSON.stringify(query)}`
                                            })
                                            sendRejectResponse(reject, "server_charger_already_occupied", "EVSE occupied", "There is another session in Pending status", "No session created for this error", hwId, userId, "-1");
                                            return;
                                        }
                                        else {
                                            const new_session = new Session(data);
                                            Session.create(new_session, (err, session) => {
                                                if (session) {

                                                    // delete token.energy_contract._id

                                                    let tokenObj = {
                                                        country_code: token.country_code,
                                                        type: token.type,
                                                        valid: token.valid,
                                                        whitelist: token.whitelist,
                                                        party_id: token.party_id,
                                                        uid: token.uid,
                                                        contract_id: token.contract_id,
                                                        issuer: token.issuer,
                                                        last_updated: token.last_updated,
                                                        energy_contract: {
                                                          supplier_name: token?.energy_contract?.supplier_name,
                                                          contract_id: token?.energy_contract?.contract_id
                                                        }
                                                      }
                                                    //Call mobie service and get session result - //Send request to mobie and Get result and if failed change session status
                                                    const request = { response_url: response_url, token: tokenObj, location_id: hwId, evse_uid: evse_uid, authorization_reference };
                                                    //TODO save EV, userid e outros
                                                    callPlatformService(endpoint, mobieToken, request).then(async (response) => {
                                                        const stageCallPlatformService = `[RemoteStartSession 2.2] - Call Platform Service`;
                                                        if (response) {

                                                            if (response.status_code) {

                                                                if ((Math.round(response.status_code / 1000)) == 1) {

                                                                    console.log("CommandResponse received for session " + session._id + ". Result: " + response.data.result);
                                                                    if (response.data.result == "ACCEPTED") {
                                                                        console.log("[RemoteStartSession] Accepted. SessionId: " + session._id);
                                                                        updateSession(session._id, hwId, "PENDING", "PENDING", response.data.message, response.data.timeout);
                                                                        saveSessionLogs({
                                                                            ...baseDataToSaveLog,
                                                                            stage: stageCallPlatformService,
                                                                            sessionId: session._id,
                                                                            status: Enums.SessionFlowLogsStatus.SUCCESS
                                                                        })
                                                                        resolve({ auth: 'true', code: "", message: 'Remote Start accepted', sessionId: session._id, hwId: hwId, userId: userId, internalLog: JSON.stringify(response.data), authorization_reference: authorization_reference });
                                                                        return;
                                                                    }
                                                                    else {
                                                                        //Update session Failed
                                                                        console.log("[RemoteStartSession] Error: ");
                                                                        addChargerWrongBehavior(charger)
                                                                        let messaToSaveLog = `Error during call Platform Service device result: ${response.data.result} `
                                                                        let message = "Unable to use the client’s API Versions"
                                                                        if (response.data) {
                                                                            if (response.data.message) {
                                                                                if (response.data.message.length > 0) {
                                                                                    if (response.data.message[0].text) {
                                                                                        message = response.data.message[0].text
                                                                                        messaToSaveLog += message
                                                                                    }
                                                                                }
                                                                            }
                                                                        }
                                                                        updateSession(session._id, hwId, "PENDING", global.SessionStatusFailed, message);
                                                                        Utils.updatePreAuthorize(data.transactionId, true)
                                                                        saveSessionLogs({
                                                                            ...baseDataToSaveLog,
                                                                            stage: stageCallPlatformService,
                                                                            sessionId: session._id,
                                                                            errorMessage: messaToSaveLog,
                                                                            errorType: Enums.SessionFlowLogsErrorTypes.DEVICE_COMMUNICATION_ERROR
                                                                        })
                                                                        sendRejectResponse(reject, "server_error_remote_start_failed", message, JSON.stringify(response.data), authorization_reference, hwId, userId, session._id);
                                                                        return;
                                                                    }

                                                                }
                                                                else {
                                                                    console.log('Unable to use the client’s API Versions. Unable to retrieve status_code', response);
                                                                    updateSession(session._id, hwId, "PENDING", global.SessionStatusFailed, "Unable to use the client’s API Versions. Unable to retrieve status_code");
                                                                    addChargerWrongBehavior(charger)
                                                                    Utils.updatePreAuthorize(data.transactionId, true)

                                                                    var code = "server_error_remote_start_failed";
                                                                    if (response.data.message)
                                                                        if (response.data.message.length > 0)
                                                                            if (response.data.message[0].text.includes('offline'))
                                                                                code = "server_error_remote_start_failed_offile_charger";

                                                                    saveSessionLogs({
                                                                        ...baseDataToSaveLog,
                                                                        stage: stageCallPlatformService,
                                                                        sessionId: session._id,
                                                                        errorMessage: `Error during call Platform Service invalid response.status_code: ${response.status_code} - code: ${code}`,
                                                                        errorType: Enums.SessionFlowLogsErrorTypes.DEVICE_COMMUNICATION_ERROR
                                                                    });
                                                                    sendRejectResponse(reject, code, "Unable to use the client’s API Versions", JSON.stringify(response.data), authorization_reference, hwId, userId, session._id);
                                                                    return;
                                                                }

                                                            }
                                                            else {
                                                                console.log('Unable to use the client’s API Versions. Unable to retrieve status_code', response);
                                                                updateSession(session._id, hwId, "PENDING", global.SessionStatusFailed, "Unable to use the client’s API Versions. Unable to retrieve status_code");
                                                                addChargerWrongBehavior(charger)
                                                                Utils.updatePreAuthorize(data.transactionId, true)
                                                                saveSessionLogs({
                                                                    ...baseDataToSaveLog,
                                                                    stage: stageCallPlatformService,
                                                                    sessionId: session._id,
                                                                    errorMessage: `Error during call Platform Service invalid response.status_code: ${response.status_code}`,
                                                                    errorType: Enums.SessionFlowLogsErrorTypes.DEVICE_COMMUNICATION_ERROR
                                                                })
                                                                sendRejectResponse(reject, "server_error_remote_start_failed", "Unable to use the client’s API Versions. Unable to retrieve status_code", JSON.stringify(response), authorization_reference, hwId, userId, session._id);
                                                                return;
                                                            }
                                                        } else {
                                                            console.log("Unable to use the client’s API Versions.", response);
                                                            updateSession(session._id, hwId, "PENDING", global.SessionStatusFailed, "Unable to use the client’s API Versions.");
                                                            addChargerWrongBehavior(charger)
                                                            Utils.updatePreAuthorize(data.transactionId, true)
                                                            saveSessionLogs({
                                                                ...baseDataToSaveLog,
                                                                stage: stageCallPlatformService,
                                                                sessionId: session._id,
                                                                errorMessage: `Error during call Platform Service empty response`,
                                                                errorType: Enums.SessionFlowLogsErrorTypes.DEVICE_COMMUNICATION_ERROR
                                                            })
                                                            sendRejectResponse(reject, "server_error_remote_start_failed", "Unable to use the client’s API Versions. ", JSON.stringify(response), authorization_reference, hwId, userId, session._id);
                                                        }
                                                    }).catch((e) => {
                                                        const stageCallPlatformService = `[RemoteStartSession 2.2] - [Catch] Call Platform Service`;
                                                        if (e.response) {
                                                            if (e.response.data) {

                                                                if (e.response.data.status_code) {

                                                                    if ((Math.round(e.response.data.status_code / 1000)) == 1) {

                                                                        if (e?.response?.data?.data?.result == "ACCEPTED") {
                                                                            updateSession(session._id, hwId, "PENDING", "PENDING", e?.response?.data?.data?.message, e?.response?.data?.data?.timeout);
                                                                            saveSessionLogs({
                                                                                ...baseDataToSaveLog,
                                                                                stage: stageCallPlatformService,
                                                                                sessionId: session._id,
                                                                                status: Enums.SessionFlowLogsStatus.SUCCESS
                                                                            })
                                                                            resolve({ auth: 'true', code: "", message: 'Remote Start accepted', sessionId: session._id, internalLog: JSON.stringify(e?.response?.data?.data?.message), authorization_reference: authorization_reference });
                                                                            return;
                                                                        }
                                                                        else {
                                                                            //Update session Failed
                                                                            let message = "Unable to use the client’s API Versions"
                                                                            if (e?.response?.data?.data) {
                                                                                if (e?.response?.data?.data?.message) {
                                                                                    if (e?.response?.data?.data?.message?.length > 0) {
                                                                                        if (e?.response?.data?.data?.message[0]?.text) {
                                                                                            message = e?.response?.data?.data?.message[0]?.text
                                                                                        }
                                                                                    }
                                                                                }
                                                                            }
                                                                            console.log("[RemoteStartSession] Error: ", message);
                                                                            updateSession(session._id, hwId, "PENDING", global.SessionStatusFailed, message);
                                                                            addChargerWrongBehavior(charger)
                                                                            Utils.updatePreAuthorize(data.transactionId, true)
                                                                            saveSessionLogs({
                                                                                ...baseDataToSaveLog,
                                                                                errorMessage: message,
                                                                                errorType: Enums.SessionFlowLogsErrorTypes.DEVICE_COMMUNICATION_ERROR,
                                                                                stage: stageCallPlatformService,
                                                                                sessionId: session._id
                                                                            })
                                                                            sendRejectResponse(reject, "server_error_remote_start_failed", message, JSON.stringify(e?.response?.data?.data?.message), authorization_reference, hwId, userId, session._id);
                                                                            return;
                                                                        }
                                                                    }
                                                                    else {
                                                                        console.log('Unable to use the client’s API Versions.', e.response.data);
                                                                        addChargerWrongBehavior(charger)

                                                                        var code = "server_error_remote_start_failed";
                                                                        let message = "Unable to use the client’s API Versions"
                                                                        if (e?.response?.data?.data?.message)
                                                                            if (e?.response?.data?.data?.message?.length > 0)
                                                                                if (e?.response?.data?.data?.message[0]?.text.includes('offline'))
                                                                                    code = "server_error_remote_start_failed_offile_charger";
                                                                        if (e?.response?.data?.data?.message[0]?.text)
                                                                            message = e?.response?.data?.data?.message[0]?.text

                                                                        updateSession(session._id, hwId, "PENDING", global.SessionStatusFailed, message);
                                                                        Utils.updatePreAuthorize(data.transactionId, true)
                                                                        saveSessionLogs({
                                                                            ...baseDataToSaveLog,
                                                                            errorMessage: `Error during call Platform Service: ${JSON.stringify(e.response.data) || ''} - code: ${code}`,
                                                                            errorType: Enums.SessionFlowLogsErrorTypes.DEVICE_COMMUNICATION_ERROR,
                                                                            stage: stageCallPlatformService,
                                                                            sessionId: session._id
                                                                        })
                                                                        sendRejectResponse(reject, code, message, JSON.stringify(e.response.data), authorization_reference, hwId, userId, session._id);
                                                                        return;
                                                                    }

                                                                }
                                                                else {
                                                                    console.log('Unable to use the client’s API Versions. Unable to retrieve status_code', e.response.data);
                                                                    updateSession(session._id, hwId, "PENDING", global.SessionStatusFailed, "Unable to use the client’s API Versions. Unable to retrieve status_code");
                                                                    addChargerWrongBehavior(charger)
                                                                    Utils.updatePreAuthorize(data.transactionId, true)
                                                                    saveSessionLogs({
                                                                        ...baseDataToSaveLog,
                                                                        errorMessage: `Error during call Platform Service: ${JSON.stringify(e.response.data) || ''}`,
                                                                        stage: stageCallPlatformService,
                                                                        sessionId: session._id,
                                                                        errorType: Enums.SessionFlowLogsErrorTypes.DEVICE_COMMUNICATION_ERROR
                                                                    })
                                                                    sendRejectResponse(reject, "server_error_remote_start_failed", "Unable to use the client’s API Versions", JSON.stringify(e.response.data), authorization_reference, hwId, userId, session._id);
                                                                    return;
                                                                }

                                                            }
                                                            else {
                                                                console.log("Error starting session ", e.message)
                                                                updateSession(session._id, hwId, "PENDING", global.SessionStatusFailed, e.message);
                                                                addChargerWrongBehavior(charger)
                                                                Utils.updatePreAuthorize(data.transactionId, true)
                                                                saveSessionLogs({
                                                                    ...baseDataToSaveLog,
                                                                    errorMessage: `Error during call Platform Service: ${e.message || ''}`,
                                                                    stage: stageCallPlatformService,
                                                                    sessionId: session._id,
                                                                    errorType: Enums.SessionFlowLogsErrorTypes.DEVICE_COMMUNICATION_ERROR
                                                                })
                                                                sendRejectResponse(reject, "server_error_remote_start_failed", "Error starting session. " + e.message, JSON.stringify(e.response), authorization_reference, hwId, userId, session._id);
                                                                return;
                                                            }
                                                        }
                                                        else {
                                                            console.log("Error starting session ", e.message)
                                                            updateSession(session._id, hwId, "PENDING", global.SessionStatusFailed, e.message);
                                                            addChargerWrongBehavior(charger)
                                                            Utils.updatePreAuthorize(data.transactionId, true)
                                                            saveSessionLogs({
                                                                ...baseDataToSaveLog,
                                                                errorMessage: `Error during call Platform Service: ${e.message || ''}`,
                                                                stage: stageCallPlatformService,
                                                                sessionId: session._id,
                                                                errorType: Enums.SessionFlowLogsErrorTypes.DEVICE_COMMUNICATION_ERROR
                                                            })
                                                            sendRejectResponse(reject, "server_error_remote_start_failed", "Error starting session. " + e.message, JSON.stringify(e), authorization_reference, hwId, userId, session._id);
                                                            return;
                                                        }
                                                    });
                                                } else {
                                                    console.log("Session not created ", err);
                                                    saveSessionLogs({
                                                        ...baseDataToSaveLog,
                                                        errorMessage: `Error during create Session ${err.message || ''}`,
                                                        stage: `[RemoteStartSession 2.2] - Session not created`,
                                                        errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR
                                                    })
                                                    sendRejectResponse(reject, "server_error_remote_start_failed", "Error starting session", JSON.stringify(err), "No session created for this error", hwId, userId, session._id);
                                                    return;
                                                    //return res.status(200).send(Utils.response(null, 2000, "Generic client error "));
                                                }
                                            })
                                        }
                                    });

                                }).catch((e) => {
                                    console.log("Error getting platform versions ", e);
                                    saveSessionLogs({
                                        ...baseDataToSaveLog,
                                        errorMessage: `Error getting platform versions: ${e.message || ''}`,
                                        errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR,
                                        stage: "[RemoteStartSession 2.2] - Find getPlatformVersionsByPlatformCode"
                                    });
                                    sendRejectResponse(reject, "server_error_remote_start_failed", "Error getting platform versions", JSON.stringify(e), "No session created for this error", hwId, userId, "-1");
                                    return;
                                });
                            }
                            else {
                                console.log("[RemoteStartSession] - Plug Id " + plugId + " not found")
                                saveSessionLogs({ 
                                    ...baseDataToSaveLog, 
                                    errorMessage: `Plug Id ${plugId} not found`,
                                    stage: "[RemoteStartSession 2.2] - Find Plug"
                                });
                                sendRejectResponse(reject, "server_plug_id_not_found", "Plug Id " + plugId + " not found", "Plug Id " + plugId + " not found", "No session created for this error", hwId, userId, "-1");
                                return;
                            }
                        }
                        else {
                            console.log("[RemoteStartSession] - Charger Id " + hwId + " not found")
                            saveSessionLogs({ 
                                ...baseDataToSaveLog, 
                                errorMessage: `Charger ${hwId} not found`, 
                                stage: "[RemoteStartSession 2.2] - GET [/api/private/chargers]"
                            });
                            sendRejectResponse(reject, "server_charger_id_not_found", "Charger Id " + hwId + " not found", "Charger Id " + hwId + " not found", "No session created for this error", hwId, userId, "-1");
                            return;
                        }

                    }).catch(function (e) {
                        console.log("[RemoteStartSession]", JSON.stringify(e));
                        saveSessionLogs({ 
                            ...baseDataToSaveLog, 
                            errorMessage: `Error during get charger ${hwId} error: ${e.message || ''}`, 
                            errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR,
                            stage: "[RemoteStartSession 2.2] - GET [/api/private/chargers]"
                        });
                        sendRejectResponse(reject, "server_charger_id_not_found", "Charger Id " + hwId + " not found", JSON.stringify(e), "No session created for this error", hwId, userId, "-1");
                        return;
                    });
                }
                else {
                    console.log("[RemoteStartSession] Invalid Token " + idTag);
                    saveSessionLogs({ ...baseDataToSaveLog, errorMessage: `Token not found ${idTag}`});
                    sendRejectResponse(reject, "server_invalid_token", "Token not found " + idTag, "[RemoteStartSession] Token not found " + idTag, "No session created for this error", hwId, userId, "-1");
                    return;
                }
            }).catch(function (e) {
                console.log("[RemoteStartSession]", e);
                saveSessionLogs({ 
                    ...baseDataToSaveLog, 
                    errorMessage: `Error during find token ${idTag} error: ${e.message || ''}`,
                    errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR
                });
                sendRejectResponse(reject, "server_invalid_token", "Invalid token " + idTag, JSON.stringify(e), "No session created for this error", hwId, userId, "-1");
                return;
            });;
        });
    }
}

//NOTE: With the introduction of the new data model AD_HOC_USER, we cannot have the creation of tokens with this type as the default.
function createToken(userId, evId) {
    return new Promise(async (resolve, reject) => {
        let countryCode = "PT"
        let partyId = "EVI"
        let random8Int = getRandomInt(10000000, 99999999)
        let appUserUid = getRandomInt(100000000000, 999999999999)
        let checkDigit = checkDigitMobility(countryCode + partyId + "C" + random8Int, checkDigitLists)
        console.log(random8Int);
        console.log(appUserUid);

        let body = {
            "country_code": countryCode,
            "party_id": partyId,
            "uid": appUserUid,
            "type": "AD_HOC_USER",
            "contract_id": `${countryCode}-${partyId}-C${random8Int}-${checkDigit}`,
            "issuer": "EVIO - Electrical Mobility",
            "evId": evId,
            "valid": true,
            "last_updated": "",
            "source": "",
            "userId": userId,
            "whitelist": "ALWAYS",
            "energy_contract": {
                "supplier_name": process.env.EnergyContractSupplierName,
                "contract_id": process.env.NODE_ENV === 'production' ? process.env.ProdEnergyContractDiaBi : process.env.PreProdEnergyContractDiaBi
            },
        }

        await managementToken.createTokenLocal(process.env.MobiePlatformCode, body).then(result => {

            resolve(result);
            //return res.status(200).send(result);

        }).catch((e) => {
            //console.log("HERE 2 ", e);
            reject(e)
            //return res.status(400).send(e);
        });;

    });
};

function getTokenIdTag(obj, networkName, tokenType) {
    for (let network of obj.networks) {
        if (network.name === networkName) {
            for (let token of network.tokens) {
                if (token.tokenType === tokenType) {
                    return token.idTagDec
                }
            }
        }
    }

}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
};

function updateSession(_id, hwId, oldstatus, status, message, responseTimeout = -1, evKms = null) {
    // let query = {
    //     location_id: hwId,
    //     status: oldstatus
    // };

    let query = {
        _id: _id
    }

    let body = {
        status: status,
        displayText: { language: "EN", text: message },
        responseTimeout: responseTimeout
    };
    if (evKms) body.evKms = evKms
    Session.findOneAndUpdate(query, body, (err, session) => { });
}

function callPlatformService(endpoint, token, body) {
    return new Promise((resolve, reject) => {
        axios.post(endpoint, body, { headers: { 'Authorization': `Token ${token}` } }).then(function (response) {

            if (typeof response.data !== 'undefined') {
                resolve(response.data);
            }
            else
                resolve(response);

        }).catch(function (error) {

            reject(error);
        });
    });
};

function sendRejectResponse(reject, code, message, internalLog, authorization_reference, hwId, userId, sessionId) {

    reject(
        {
            auth: false,
            code: code,
            message: message,
            internalLog: internalLog,
            authorization_reference: authorization_reference,
            hwId: hwId,
            userId: userId,
            sessionId: sessionId
        });

}

function addChargerWrongBehavior(charger) {
    let chargerInfo = {
        hwId: charger.hwId,
        source: charger.source,
        wrongBehaviorStation: true
    }
    Utils.updateChargerInfo(chargerInfo)
}


