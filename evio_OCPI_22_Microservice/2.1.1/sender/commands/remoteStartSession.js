var Platforms = require('../../../models/platforms');
const axios = require('axios');
var _ = require("underscore");
const Platform = require('../../../models/platforms');
const global = require('../../../global');
const Token = require('../../../models/tokens')
const Utils = require('../../../utils');
var versions = require('../versions/platformVersions');
const Session = require('../../../models/sessions')
const checkDigitMobility = require('../../../digitCalculation/digitCalculation')
const fs = require("fs");
const rawdata = fs.readFileSync('./digitCalculation/lists.json');
const checkDigitLists = JSON.parse(rawdata);
var managementToken = require('./../tokens/managementToken');
const { getUserCoordinates } = require('../../../functions/coordinates')
const vatService = require('../../../services/vat')
const { Enums } = require('evio-library-commons').default;
const { saveSessionLogs } = require('../../../functions/save-session-logs');

module.exports = {
    post: function (req, res) {
        const context = '[remoteStartSession]';
        const stageToLog = '[RemoteStartSession 2.1.1] - Route [POST /api/private/2.1.1/ocpi/start]';
        const actionToLog = 'start';

        return new Promise(async (resolve, reject) => {
            var data = req.body;
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

            var paymentType = "MONTHLY"; //By default user has contract with EVIO CEME, has the payment method is monthly

            var idTag = req.body.idTag;

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

            var billingPeriod = req.body.billingPeriod;
            if (!billingPeriod) {
                billingPeriod = "AD_HOC"
            }

            let ocpiVersion = req.params.version

            //if idTag == -1 user will charge with AD_HOC method. So we need to create token, before start charging with new token
            // if (idTag == "-1") {

            //     await createToken(userId, evId).then(result => {
            //         // paymentType = 'AD_HOC' //If user has not contract with EVIO CEME, he can start charging session with AD_HOC method
            //         idTag = result.token.uid;
            //         console.log(idTag)

            //     }).catch((e) => {
            //         sendRejectResponse(reject, "server_error_creating_token", "Error creating AD_HOC_USER Token", JSON.stringify(e), "No session created for this error", hwId, userId, "-1");
            //         return;
            //     });;;
            // }

            let query = { uid: idTag };
            Token.findOne(query, { _id: 0, evId: 0, __v: 0, createdAt: 0, updatedAt: 0, source: 0 }, (err, token) => {
                //console.log(token)

                if (typeof token !== 'undefined' && token !== null) {

                    var chargersEndpoint = global.publicNetworkChargersProxy + "/" + hwId;
                    axios.get(chargersEndpoint, data, {}).then(async function (response) {

                        if (typeof response.data !== 'undefined' && response.data !== '') {

                            var charger = response.data;
                            var plugs = charger.plugs;
                            var plug = _.where(plugs, { plugId: plugId });
                            if (typeof plug !== 'undefined' && plug.length > 0) {
                                var evse_uid = plug[0].uid;
                                var authorization_reference = Utils.generateToken(24);

                                // // this is just to keep the code more centralized as possible, maybe in future should be totaly separated
                                var platformCode = charger.network !== "Hubject" ? charger.network : "Gireve";

                                var tariffId;
                                let plugPower = 22
                                let plugVoltage = 400
                                
                                let tariffs = []
                                if (plug) {
                                    tariffId = plug[0].tariffId[0];
                                    plugPower = plug[0].power
                                    plugVoltage = plug[0].voltage
                                    tariffs = plug[0]?.serviceCost?.tariffs ?? []
                                }
                                var tariffOPC = {};
                                const { latitude, longitude } = Utils.getChargerLatitudeLongitude(charger.geometry)
                                // get the correct tarifID for hubject
                                if (charger.network == process.env.HubjectNetwork) {
                                    const tariff = await Utils.getHubjectTariff(
                                        charger,
                                        tariffs,
                                        latitude,
                                        longitude,
                                        plugPower,
                                        userId,
                                        req.body.evOwner
                                    ) 
                                    tariffId = tariff?.id ?? tariffId
                                    tariffOPC = tariff ?? await Utils.getTariffOPC(tariffId)
                                } else if (tariffId) {
                                    tariffOPC = await Utils.getTariffOPC(tariffId);
                                    if (Utils.isEmptyObject(tariffOPC)) {
                                        tariffOPC = await Utils.getDefaultOPCTariff() ?? {}
                                    }
                                } else {
                                    tariffOPC = await Utils.getDefaultOPCTariff() ?? {}
                                }
                                let currency = tariffOPC.currency ? tariffOPC.currency : "EUR"

                                // let roamingPlanParams = {
                                //     country: charger.countryCode,
                                //     region: charger.countryCode,
                                //     partyId: charger.partyId,
                                //     roamingType: charger.source,
                                //     evseGroup: plug[0].evseGroup
                                // }
                                // var currency = "EUR"
                                // let roamingPlanCpo = await Utils.getRoamingPlanTariff(roamingPlanParams)
                                // if (roamingPlanCpo.tariff) {
                                //     currency = roamingPlanCpo.currency
                                //     tariffOPC = Utils.createTariffOPCWithRoamingPlan(roamingPlanCpo)
                                // }

                                var tariffCEME = "";
                                // var currency = "EUR"
                                // changes to get Hubject Tariff
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
                                    // currency = ceme.currency
                                } else {
                                    // tariffCEME = await Utils.getTariffCEME(req.body.clientName);
                                    tariffCEME = await Utils.getTariffCEME(req.body.clientName);
                                    let tariffArray = Utils.getTariffCemeByDate(tariffCEME, new Date().toISOString())
                                    tariffCEME.tariff = tariffArray
                                }

                                let timeZone = charger.timeZone
                                if (!timeZone) {
                                    timeZone = Utils.getTimezone(latitude, longitude)
                                }              
                                
                                let fees = await vatService.getFees(charger, req?.body?.userIdToBilling)
                                console.debug(`${context} Fetched fees for charger`, fees, charger?.hwId);
                                let  ev;
                                let fleet;
                                if(evId !== '-1') {
                                    const getEVAllByEvId = await Utils.getEVAllByEvId(evId);
                                    ev = getEVAllByEvId.ev
                                    fleet = getEVAllByEvId.fleet
                                }

                                let { userIdInfo, userIdWillPayInfo, userIdToBillingInfo } = await Utils.getAllUserInfo(userId, req.body.userIdWillPay, req.body.userIdToBilling)

                                let invoiceType = ev?.invoiceType;
                                let invoiceCommunication = ev?.invoiceCommunication;

                                versions.getPlatformVersionsByPlatformCode(platformCode).then(platform => {

                                    if (charger.network !== process.env.HubjectNetwork) {

                                        //get Mobie Details
                                        var platformDetails = platform.platformDetails;

                                        //Get Mobie Endpoint to 2.2 OCPI versions
                                        var platformDetails22 = _.where(platformDetails, { version: ocpiVersion });
                                        var platformEndpoints22 = platformDetails22[0].endpoints
                                        var platformCommandsEndpointObject = _.where(platformEndpoints22, { identifier: "commands" });

                                        if (platformCommandsEndpointObject === undefined || platformCommandsEndpointObject.length == 0) {
                                            saveSessionLogs({
                                                ...baseDataToSaveLog,
                                                errorMessage: `Error during check platform commands - Charger does not allow remote commands`,
                                                stage: `[RemoteStartSession 2.1.1] - check platform commands`
                                            })
                                            reject({ auth: false, code: "server_charger_does_not_allow_remote_commands", message: 'Server does not allow remote commands' });
                                            return;
                                        }

                                        var platformCommandsEndpoint = platformCommandsEndpointObject[0].url;

                                        var platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: ocpiVersion })
                                        var platformToken = platformActiveCredentials[0].token;

                                        //Get platform Endpoint of commands
                                        var endpoint = platformCommandsEndpoint + '/START_SESSION';
                                        var response_url = platform.responseUrlSessionRemoteStart + '/START_SESSION/' + authorization_reference;

                                    }
                                    var auth_method = "WHITELIST";
                                    var token_type = token.type;

                                    if (req.body.clientType == "b2c")
                                        paymentType = "AD_HOC";


                                    var data = {
                                        userId: userId,
                                        evId: evId,
                                        operator: charger.partyId,
                                        source: charger.source,
                                        country_code: charger.countryCode,
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
                                        cdr_token: {
                                            uid: token.uid,
                                            type: token.type,
                                            contract_id: token.contract_id,
                                        },
                                        evse_uid: evse_uid,
                                        connector_id: plugId,
                                        voltageLevel: charger.voltageLevel,
                                        timeZone: timeZone,
                                        currency: currency,
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
                                        plugPower,
                                        plugVoltage,
                                        plafondId: req.body.plafondId,
                                        cardNumber: req.body.cardNumber,
                                        evDetails : ev,
                                        fleetDetails: fleet ,
                                        userIdInfo,
                                        userIdWillPayInfo,
                                        userIdToBillingInfo,
                                        updateKMs: false,
                                        acceptKMs: false
                                    };
                                    // set CO2 Param so it can be calculated further in the charging process
                                    if (charger.network == process.env.HubjectNetwork) {
                                        let plug = charger.plugs.find(e => e.plugId == plugId)
                                        // TODO - melhorar em caso de um EVSE tiver duas plugs
                                        if (plug.length > 1) {
                                            plug = plug[0]
                                        }
                                        if (plug.co2Emissions) data.roamingCO2 = plug.co2Emissions
                                    }

                                    // add km EVIO 1478
                                    if (ev && evId !== "-1") {
                                        if (ev.acceptKMs) data.acceptKMs = ev.acceptKMs
                                        if (ev.updateKMs) data.updateKMs = ev.updateKMs
                                    }

                                    const userCoordinates = getUserCoordinates(req.body)
                                    if (userCoordinates) {
                                        data.userCoordinates = userCoordinates
                                    }

                                    //Check if there is already a pending session
                                    let query = {
                                        location_id: hwId,
                                        evse_uid: evse_uid,
                                        status: "PENDING"
                                    };

                                    Session.find(query, (err, session) => {
                                        if (typeof session !== 'undefined' && session !== null && session.length > 0) {
                                            console.log("[RemoteStartTransaction] Charger occupied!")
                                            saveSessionLogs({
                                                ...baseDataToSaveLog,
                                                errorMessage: `Charger ${hwId} occupied by another session`,
                                                stage: `[RemoteStartSession 2.1.1] - Find by query ${JSON.stringify(query)}`
                                            })
                                            sendRejectResponse(reject, "server_charger_already_occupied", "EVSE occupied", "There is another session in Pending status", "No session created for this error", hwId, userId, "-1");
                                            return;
                                        }
                                        else {
                                            const new_session = new Session(data);
                                            Session.create(new_session, async (err, session) => {
                                                if (session) {

                                                    if (charger.network == process.env.HubjectNetwork) {
                                                        // call oicp microservice to send the start
                                                        let response = await Utils.sendStartHubject(session, charger.hwId)
                                                        if (response.status) {
                                                            // remote sent whith sucecss
                                                            let query = { _id: session._id };

                                                            let newValues = {
                                                                $set:
                                                                {
                                                                    id: response.sessionId,
                                                                    roamingTransactionID: response.sessionId,
                                                                    roamingOperatorID: charger.partyId,
                                                                    status: "PENDING",
                                                                    displayText: { language: "EN", text: 'Remote Start accepted' },
                                                                    responseTimeout: 70
                                                                }
                                                            };
                                                            baseDataToSaveLog.externalSessionId = response.sessionId

                                                            Session.updateSession(query, newValues, (err, result) => {
                                                                if (err) {
                                                                    console.error(`[update Session OCPI] Error `, err);
                                                                    // something Failed
                                                                    updateSession(session._id, hwId, "PENDING", global.SessionStatusFailed, response.message);
                                                                    console.log("[RemoteStartSession] Error: ", err);
                                                                    addChargerWrongBehavior(charger)
                                                                    Utils.updatePreAuthorize(data.transactionId, true)
                                                                    saveSessionLogs({
                                                                        ...baseDataToSaveLog,
                                                                        errorMessage: `Error during update Session ${err.message || ''}`,
                                                                        stage: `[RemoteStartSession 2.1.1][Hubject Network] - Error during update Session`,
                                                                        errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR,
                                                                        sessionId: session._id
                                                                    })
                                                                    sendRejectResponse(reject, "server_error_remote_start_failed", response.message, JSON.stringify(response.message), authorization_reference, hwId, userId, session._id);
                                                                }
                                                                else {
                                                                    console.log("[RemoteStartSession] Accepted. SessionId: " + session._id);
                                                                    saveSessionLogs({
                                                                        ...baseDataToSaveLog,
                                                                        stage: `[RemoteStartSession 2.1.1][Hubject Network] - Remote Start accepted`,
                                                                        sessionId: session._id,
                                                                        status: Enums.SessionFlowLogsStatus.SUCCESS
                                                                    })
                                                                    resolve({ auth: 'true', code: "", message: 'Remote Start accepted', sessionId: session._id, hwId: hwId, userId: userId, internalLog: "Accepted. SessionId: " + session._id, authorization_reference: authorization_reference });
                                                                }
                                                                return
                                                            });

                                                        } else {
                                                            // something Failed
                                                            updateSession(session._id, hwId, "INVALID", global.SessionStatusFailed, response.message);
                                                            console.log("[RemoteStartSession] Error: ", response);
                                                            addChargerWrongBehavior(charger)
                                                            Utils.updatePreAuthorize(data.transactionId, true)
                                                            saveSessionLogs({
                                                                ...baseDataToSaveLog,
                                                                errorMessage: `Error during update Session: ${response.message || ''}`,
                                                                stage: `[RemoteStartSession 2.1.1][Hubject Network] - Error during update Session`,
                                                                sessionId: session._id
                                                            })

                                                            sendRejectResponse(reject, "server_error_remote_start_failed", response.message, JSON.stringify(response.message), authorization_reference, hwId, userId, session._id);
                                                            return;
                                                        }
                                                    } else {
                                                        // TODO In this version, contract_id is auth_id
                                                        //Call mobie service and get session result - //Send request to mobie and Get result and if failed change session status
                                                        var request = { response_url: response_url, token: Utils.getTokenModelObj(token), location_id: hwId, evse_uid: evse_uid, authorization_id: authorization_reference };
                                                        //TODO save EV, userid e outros
                                                        callPlatformService(endpoint, platformToken, request).then(async (response) => {
                                                            const stageCallPlatformService = `[RemoteStartSession 2.1.1] - Call Platform Service`;
                                                            if (response) {

                                                                if (response.status_code) {

                                                                    if ((Math.round(response.status_code / 1000)) == 1) {

                                                                        console.log("CommandResponse received for session " + session._id + ". Result: " + response.data.result);
                                                                        if (response.data.result == "ACCEPTED") {
                                                                            console.log("[RemoteStartSession] Accepted. SessionId: " + session._id);
                                                                            updateSession(session._id, hwId, "PENDING", "PENDING", 'Remote Start accepted', 70);
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
                                                                            console.log("[RemoteStartSession] Error: ");
                                                                            addChargerWrongBehavior(charger)
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
                                                            const stageCallPlatformService = `[RemoteStartSession 2.1.1] - [Catch] Call Platform Service`;
                                                            if (e.response) {
                                                                if (e.response.data) {

                                                                    if (e.response.data.status_code) {

                                                                        if ((Math.round(e.response.data.status_code / 1000)) == 1) {

                                                                            if (e?.response?.data?.data?.result == "ACCEPTED") {

                                                                                updateSession(session._id, hwId, "PENDING", "PENDING", 'Remote Start accepted');
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
                                                                                let messageToSaveLog = `Error during call Platform Service: ${JSON.stringify(e.response.data) || ''}`;
                                                                                let message = "Unable to use the client’s API Versions"
                                                                                if (e?.response?.data?.data) {
                                                                                    if (e?.response?.data?.data?.message) {
                                                                                        if (e?.response?.data?.data?.message?.length > 0) {
                                                                                            if (e?.response?.data?.data?.message[0]?.text) {
                                                                                                message = e?.response?.data?.data?.message[0]?.text
                                                                                                messageToSaveLog = message || messageToSaveLog
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
                                                                                    errorMessage: messageToSaveLog,
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
                                                                            Utils.updatePreAuthorize(data.transactionId, true)

                                                                            var code = "server_error_remote_start_failed";
                                                                            let message = "Unable to use the client’s API Versions"
                                                                            if (e?.response?.data?.data?.message)
                                                                                if (e?.response?.data?.data?.message?.length > 0)
                                                                                    if (e?.response?.data?.data?.message[0]?.text.includes('offline'))
                                                                                        code = "server_error_remote_start_failed_offile_charger";
                                                                            if (e?.response?.data?.data?.message[0]?.text)
                                                                                message = e?.response?.data?.data?.message[0]?.text

                                                                            updateSession(session._id, hwId, "PENDING", global.SessionStatusFailed, message);
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

                                                    }
                                                } else {
                                                    console.log("Session not created ", err);
                                                    saveSessionLogs({
                                                        ...baseDataToSaveLog,
                                                        errorMessage: `Error during create Session ${err.message || ''}`,
                                                        stage: `[RemoteStartSession 2.1.1] - Session not created`,
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
                                        stage: "[RemoteStartSession 2.1.1] - Find getPlatformVersionsByPlatformCode"
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
                                    stage: "[RemoteStartSession 2.1.1] - Find Plug"
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
                                stage: "[RemoteStartSession 2.1.1] - GET [/api/private/chargers]"
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
                            stage: "[RemoteStartSession 2.1.1] - GET [/api/private/chargers]"
                        });
                        sendRejectResponse(reject, "server_charger_id_not_found", "Charger Id " + hwId + " not found", JSON.stringify(e), "No session created for this error", hwId, userId, "-1");
                        return;
                    });
                }
                else {
                    console.log("[RemoteStartSession] Invalid Token " + idTag);
                    saveSessionLogs({ ...baseDataToSaveLog, errorMessage: `Token not found ${idTag}`});
                    sendRejectResponse(reject, "server_invalid_token", "Token not found " + idTag, "[RemoteStartSession] Token not found " + idTag, "No session created for this error", hwId, userId, "-1", baseDataToSaveLog);
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
            "type": "OTHER",
            "contract_id": `${countryCode}-${partyId}-C${random8Int}-${checkDigit}`,
            "issuer": "EVIO - Electrical Mobility",
            "evId": evId,
            "valid": true,
            "last_updated": "",
            "source": "",
            "userId": userId,
            "whitelist": "NEVER",
        }

        await managementToken.createTokenLocal(global.girevePlatformCode, body).then(result => {

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

function updateSession(_id, hwId, oldstatus, status, message, responseTimeout = -1) {
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

    Session.findOneAndUpdate(query, body, (err, session) => { });
}

function callPlatformService(endpoint, token, body) {
    console.log("Calling Mobie Service to: ", endpoint);
    console.log(body);
    return new Promise((resolve, reject) => {
        console.log(endpoint, body, { headers: { 'Authorization': `Token ${token}` } });
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






