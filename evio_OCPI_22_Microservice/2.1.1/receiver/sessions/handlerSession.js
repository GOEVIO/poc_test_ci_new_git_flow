const { Constants } = require("evio-library-commons").default;
const toggle = require('evio-toggle').default

var VersionsDetails = require('../../../models/evio_versions_details');
const Utils = require('../../../utils');
const Session = require('../../../models/sessions')
const Token = require('../../../models/tokens')
const global = require('../../../global')
const { sendSessionToHistoryQueue } = require('../../../functions/sendSessionToHistoryQueue')
const vatService = require('../../../services/vat');
const { Enums } = require('evio-library-commons').default;
const { saveSessionLogs } = require('../../../functions/save-session-logs');
const InvalidCountryService = require('../../../services/invalidCountry.service');
const { TariffsService } = require('evio-library-ocpi');
const { getAllUserInfo, getEmspTariffWithIdTag } = require('evio-library-identity').default;

module.exports = {
    startSession: async function (req, res) {
        const context = `2.1.1 [handlerSession.startSession] ${req.method || ''} ${req.originalUrl || ''}`;
        //Get Token, sent previously to partner
        var token = req.headers.authorization.split(' ')[1];

        //Validate if sent data is valid JSON to process
        var data = req.body;

        const baseDataToSaveLogs = {
            userId: '--put session--',
            hwId: '',
            plugId: '',
            stage: `[PutSession 2.1.1] - Route [PUT ${req.originalUrl || ''}]`,
            action: 'start',
            status: Enums.SessionFlowLogsStatus.ERROR,
            errorType: Enums.SessionFlowLogsErrorTypes.VALIDATION_ERROR
        }

        if (Utils.isEmptyObject(data)){
            saveSessionLogs({
                ...baseDataToSaveLogs,
                errorMessage: 'Empty request body',
            })
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));
        }
        baseDataToSaveLogs.payload = data

        const sessionId = data.id;
        if (!sessionId){
            saveSessionLogs({
                ...baseDataToSaveLogs,
                errorMessage: 'Empty sessionId',
            })
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));
        }

        

        let ocpiVersion = req.params.version
        let party_id = req.params.party_id
        let country_code = req.params.country_code
        // data.country_code = country_code
        data.party_id = party_id
        let sessionModel = Utils.getSessionModelObj(data)
        baseDataToSaveLogs.externalSessionId = sessionModel?.id || sessionId
        baseDataToSaveLogs.hwId = sessionModel?.location_id || ''
        baseDataToSaveLogs.plugId = sessionModel?.connector_id || ''

        var contract_id = sessionModel.contract_id

        try {

            var query = {
                location_id: sessionModel.location_id,
                evse_uid: sessionModel.evse_uid,
                "$or": [
                    {
                        "id": sessionId
                    },
                    {
                        "authorization_reference": sessionModel.authorization_reference
                    },
                    {status: {$in: [
                                Enums.SessionStatusesTextTypes.PENDING_START, 
                                Enums.SessionStatusesTextTypes.PENDING,
                                Enums.SessionStatusesTextTypes.PENDING_DELAY,
                            ]}
                    }
                ]
            };

            /**
             * This function guarantees that we don't update a session that is already stopped or 
             * another existing session in the same location with the same token.
             */
            await Utils.validateSessionUpdate(query, data);

            Session.updateSession(query, { $set: sessionModel }, async (err, doc) => {
                if (doc != null) {
                    //TODO
                    if (doc.cdrId === "-1") {
                        if (sessionModel.status === "COMPLETED") {
                            Utils.updateSessionStopMeterValuesRoaming(doc)
                            sendSessionToHistoryQueue(doc._id, context)
                            saveSessionLogs({
                                ...baseDataToSaveLogs,
                                userId: doc?.userId || '',
                                status: Enums.SessionFlowLogsStatus.SUCCESS,
                                sessionId: doc._id,
                                stage: "COMPLETED Session 2.1.1",
                            }, true)
                        } else {
                            saveSessionLogs({
                                ...baseDataToSaveLogs,
                                userId: doc?.userId || '',
                                status: Enums.SessionFlowLogsStatus.SUCCESS,
                                stage: `UPDATE session in PUT session 2.1.1 to status ${doc?.status || ''}`,
                                sessionId: doc._id,
                            }, true)
                            Utils.updateSessionMeterValuesRoaming(doc, sessionModel, true);
                        }
                    }

                    console.log("Updated Session " + sessionId);
                    return res.status(200).send(Utils.response(null, 1000, "Updated Session " + sessionId + ""));
                } else {
                    // (async function () {
                    Utils.getPlatformInfo(token, ocpiVersion).then(async (platform) => {
                        // TODO: We don't receive the uid, so we're fetching the token with the contract_id. Is it always RFID here?
                        var tokenUid = await Utils.getUserIdToken(contract_id);
                        var result = await Utils.getCharger(sessionModel.location_id, sessionModel.connector_id);

                        let evOwner = "-1"
                        let evId = "-1"
                        let invoiceType = "-1"
                        let invoiceCommunication = "-1"
                        let evDetails,fleetDetails
                        let userId = "Unknown"

                        if (tokenUid) {
                            //evOwner = tokenUid.evId != "-1" ? await Utils.getEVByEvId(tokenUid.evId) : "-1"
                            evId = tokenUid.evId;
                            userId = tokenUid.userId
                            if (tokenUid.evId != "-1") {
                                const evInfo = await Utils.getEvInfo(evId, userId)
                                evOwner = evInfo?.evOwner;
                                invoiceType = evInfo?.invoiceType;
                                invoiceCommunication = evInfo?.invoiceCommunication;
                                evDetails = evInfo?.evDetails;
                                fleetDetails = evInfo?.fleetDetails;
                                userId = evInfo?.userId;
                            }
                        }
                        baseDataToSaveLogs.userId = userId

                        var fees = { IEC: 0.001, IVA: 0.23 }
                        let timeZone = ""
                        let address = ""
                        let cpoCountryCode = ""

                        let countryCode = ""
                        let partyId = ""
                        let source = ""
                        let evseGroup = ""
                        let geometry = {}
                        if (result) {
                            var plug = result.plug;
                            fees = await vatService.getFees(result.charger)
                            timeZone = result.charger.timeZone;
                            address = result.charger.address
                            cpoCountryCode = result.charger.cpoCountryCode
                            countryCode = result.charger.countryCode
                            partyId = result.charger.partyId
                            source = result.charger.source
                            geometry = result.charger.geometry
                            if (!timeZone) {
                                let { latitude, longitude } = Utils.getChargerLatitudeLongitude(geometry)
                                timeZone = Utils.getTimezone(latitude, longitude)
                            }
                            // evseGroup = result.charger.evseGroup
                        }
                        else
                            fees = { IEC: 0.001, IVA: 0.23 }

                        var plugId = "";
                        var tariffId;
                        let plugPower = 22
                        let plugVoltage = 400
                        if (plug) {
                            tariffId = plug.tariffId[0];
                            plugId = plug.plugId;
                            evseGroup = plug.evseGroup
                            plugPower = plug.power
                            plugVoltage = plug.voltage
                        }

                        var tariffOPC = await TariffsService.getOcpiCpoTariff(
                            result?.charger,
                            plug?.serviceCost?.tariffs,
                            '',
                            result?.charger?.geometry?.coordinates?.[1],
                            result?.charger?.geometry?.coordinates?.[0],
                            plug?.power,
                            userId,
                            evOwner
                        ) ?? await Utils.getDefaultOPCTariff();

                        // let currency = tariffOPC.currency ? tariffOPC.currency : "EUR"

                        // let roamingPlanParams = {
                        //     country: countryCode,
                        //     region: countryCode,
                        //     partyId: partyId,
                        //     roamingType: source,
                        //     evseGroup: evseGroup
                        // }
                        // var currency = "EUR"
                        // let roamingPlanCpo = await Utils.getRoamingPlanTariff(roamingPlanParams)
                        // if (roamingPlanCpo.tariff) {
                        //     currency = roamingPlanCpo.currency
                        //     tariffOPC = Utils.createTariffOPCWithRoamingPlan(roamingPlanCpo)
                        // }
                        // var tariffCEME = await Utils.getTariffCEME("EVIO");

                        /* 
                            I was saying that country code was the CPO country code, but I think a CPO can have chargers in multiple countries, right? 
                            That being said, it's better to use the chargers country code
                        
                        */
                        sessionModel.country_code = result ? result.charger.countryCode : country_code

                        let chargerType = Utils.getChargerTypeByPlatformCode(platform.source)
                        const new_session = new Session(sessionModel);
                        new_session.source = platform.source;
                        new_session.chargerType = chargerType
                        new_session.evId = evId;
                        if (invoiceType != "-1")
                            new_session.invoiceType = invoiceType
                        if (invoiceCommunication != "-1")
                            new_session.invoiceCommunication = invoiceCommunication
                        new_session.evOwner = evOwner
                        new_session.evDetails = evDetails
                        new_session.fleetDetails = fleetDetails
                        new_session.userId = userId
                        new_session.tariffOPC = tariffOPC;
                        // new_session.tariffCEME = tariffCEME;
                        new_session.timeZone = timeZone;
                        new_session.address = address;
                        new_session.cpoCountryCode = cpoCountryCode;
                        new_session.fees = fees;
                        new_session.cdrId = "-1"
                        // new_session.currency = currency
                        new_session.plugPower = plugPower
                        new_session.plugVoltage = plugVoltage
                        
                        if(data.start_date_time && new_session.timeZone)
                            new_session.local_start_date_time = moment(data.start_date_time).tz(new_session.timeZone).format("YYYY-MM-DDTHH:mm:ss");

                        if(data.end_date_time && new_session.timeZone)
                            new_session.local_end_date_time = moment(data.end_date_time).tz(new_session.timeZone).format("YYYY-MM-DDTHH:mm:ss");

                        if (sessionModel.authorization_reference === null || typeof sessionModel.authorization_reference === 'undefined') {
                            var authorization_reference = Utils.generateToken(24);
                            new_session.authorization_reference = authorization_reference;
                        }

                        if (tokenUid) {
                            new_session.token_uid = tokenUid.uid
                            new_session.token_type = tokenUid.type
                            new_session.cdr_token = {
                                uid: tokenUid.uid,
                                type: tokenUid.type,
                                contract_id: tokenUid.contract_id,
                            }
                        } else {
                            new_session.token_uid = "Unknown"
                            new_session.token_type = "Unknown"
                            new_session.cdr_token = {
                                uid: "Unknown",
                                type: "Unknown",
                                contract_id: contract_id
                            }
                        }

                        //Get Conditions Payment
                        var paymentConditionsInit = {
                            paymentType: "AD_HOC",
                            paymentMethod: "Unknown",
                            paymentMethodId: "-1",
                            walletAmount: -1,
                            reservedAmount: -1,
                            confirmationAmount: -1,
                            userIdWillPay: "Unknown",
                            userIdToBilling: "Unknown",
                            adyenReference: "-1",
                            transactionId: "-1",
                            clientType: "b2b",
                            clientName: "EVIO"
                        };

                        var paymentConditions = {};

                        let userIdWillPay = ""
                        let userIdToBilling = ""

                        if (tokenUid) {
                            const idTagToPaymentCondition = await Utils.verifyFlagIsActiveToSendIdTagToPaymentConditions(new_session?.token_uid)

                            paymentConditions = await Utils.getPaymentConditions(new_session.userId, evId, sessionModel.location_id, plugId, chargerType, fees, idTagToPaymentCondition).catch((e) => {
                                console.log("Get payment conditions failed. Reason ", e)
                                new_session.notes = "Get payment conditions failed - " + JSON.stringify(e.message)
                                userIdWillPay = e.userIdWillPay ? e.userIdWillPay : ""
                                userIdToBilling = e.userIdToBilling ? e.userIdToBilling : ""
                            });

                            // new_session.userId = tokenUid.userId;

                            if (!paymentConditions) {
                                // let userInfo = await Utils.getUserInfo(new_session.userId)
                                // if (userInfo) {
                                //     paymentConditionsInit.clientType = userInfo.clientType
                                //     paymentConditionsInit.clientName = userInfo.clientName
                                // }

                                if (userIdWillPay && userIdToBilling) {
                                    paymentConditionsInit.userIdWillPay = userIdWillPay;
                                    paymentConditionsInit.userIdToBilling = userIdToBilling;
                                } else {
                                    let evValidation = await Utils.validateEV(evId, new_session.userId, new_session.evDetails);
                                    if (evValidation.userIdWillPay && evValidation.userIdToBilling) {
                                        paymentConditionsInit.userIdWillPay = evValidation.userIdWillPay
                                        paymentConditionsInit.userIdToBilling = evValidation.userIdToBilling
                                    } else {
                                        paymentConditionsInit.userIdWillPay = new_session.userId;
                                        paymentConditionsInit.userIdToBilling = new_session.userId;
                                    }

                                }

                                let {userIdInfo ,userIdWillPayInfo , userIdToBillingInfo} = await getAllUserInfo({userId, userIdWillPay: paymentConditionsInit.userIdWillPay, userIdToBilling: paymentConditionsInit.userIdToBilling})
                                new_session.userIdInfo = userIdInfo
                                new_session.userIdWillPayInfo = userIdWillPayInfo
                                new_session.userIdToBillingInfo = userIdToBillingInfo
                                // let userInfo = await Utils.getUserInfo(paymentConditionsInit.userIdWillPay)
                                if (userIdWillPayInfo) {
                                    paymentConditionsInit.clientType = userIdWillPayInfo?.clientType
                                    paymentConditionsInit.clientName = userIdWillPayInfo?.clientName
                                    paymentConditionsInit.paymentType = userIdWillPayInfo?.paymentPeriod ?? "AD_HOC"
                                }
                                paymentConditions = paymentConditionsInit;
                            } else {
                                let {userIdInfo ,userIdWillPayInfo , userIdToBillingInfo} = await getAllUserInfo({userId, userIdWillPay: paymentConditions.userIdWillPay, userIdToBilling: paymentConditions.userIdToBilling})
                                new_session.userIdInfo = userIdInfo
                                new_session.userIdWillPayInfo = userIdWillPayInfo
                                new_session.userIdToBillingInfo = userIdToBillingInfo
                            }
                        }
                        else {
                            paymentConditions = paymentConditionsInit;
                            new_session.userId = "Unknown";
                        }

                        // if (evId != "-1") {
                        //     var obj = await Utils.getEvDriverId(tokenUid.evId);
                        //     console.log(obj);
                        //     if (obj) {
                        //         var evDriverId = obj.userId;
                        //         new_session.userId = evDriverId;
                        //         if (!evDriverId) {
                        //             new_session.userId = tokenUid.userId
                        //         }
                        //     }
                        //     else
                        //         new_session.userId = tokenUid.userId
                        // }

                        new_session.operator = partyId;
                        new_session.chargeOwnerId = partyId;


                        console.log("handler session:", paymentConditions);


                        //Check if payment will be done at the end of charging session or end of the month. if user is b2c, he MUST to pay at the end of session, if user is b2b ,monthly.
                        if (paymentConditions.clientType) {

                            new_session.paymentType = paymentConditions.paymentType;
                            /*
                            if (paymentConditions.clientType == "b2c")
                                new_session.paymentType = "AD_HOC";
                            else
                                new_session.paymentType = "MONTHLY";
                            */

                        }
                        else {
                            new_session.paymentType = paymentConditionsInit.paymentType;
                        }

                        if (paymentConditions.clientName) {
                            new_session.clientName = paymentConditions.clientName;
                        } else {
                            new_session.clientName = paymentConditionsInit.clientName;
                        }

                        if (paymentConditions.cardNumber) {
                            new_session.cardNumber = paymentConditions.cardNumber;
                        }

                        // Check if tariffCEME is sent
                        let tariffCEME = "";
                        if (paymentConditions.ceme) {
                            if (paymentConditions.ceme.plan) {
                                // new_session.tariffCEME = paymentConditions.ceme.plan
                                tariffCEME = paymentConditions.ceme.plan
                                let tariffArray = Utils.getTariffCemeByDate(tariffCEME, sessionModel.start_date_time)
                                tariffCEME.tariff = tariffArray
                                new_session.tariffCEME = tariffCEME
                            } else {
                                // new_session.tariffCEME = await Utils.getTariffCEME(new_session.clientName);
                                tariffCEME = await getEmspTariffWithIdTag(tokenUid?.uid, Enums.ChargerNetworks.Gireve);
                                if (!tariffCEME) tariffCEME = await Utils.getTariffCEME(new_session.clientName);
                                let tariffArray = Utils.getTariffCemeByDate(tariffCEME, sessionModel.start_date_time)
                                tariffCEME.tariff = tariffArray
                                new_session.tariffCEME = tariffCEME
                            }
                            // new_session.currency = paymentConditions.ceme.currency
                        } else {
                            //Default value for now
                            // new_session.tariffCEME = await Utils.getTariffCEME(new_session.clientName);
                            tariffCEME = await getEmspTariffWithIdTag(tokenUid?.uid, Enums.ChargerNetworks.Gireve);
                            if (!tariffCEME) tariffCEME = await Utils.getTariffCEME(new_session.clientName);
                            let tariffArray = Utils.getTariffCemeByDate(tariffCEME, sessionModel.start_date_time)
                            tariffCEME.tariff = tariffArray
                            new_session.tariffCEME = tariffCEME
                        }

                        if (paymentConditions.billingPeriod) {
                            new_session.billingPeriod = paymentConditions.billingPeriod;
                        } else {
                            new_session.billingPeriod = new_session?.userIdToBillingInfo?.billingPeriod
                        }

                        new_session.paymentMethod = paymentConditions.paymentMethod;
                        new_session.paymentMethodId = paymentConditions.paymentMethodId;
                        new_session.walletAmount = paymentConditions.walletAmount;
                        new_session.reservedAmount = paymentConditions.reservedAmount;
                        new_session.confirmationAmount = paymentConditions.confirmationAmount;
                        paymentConditions.plafondId && (new_session.plafondId = paymentConditions.plafondId);

                        new_session.viesVAT = paymentConditions.viesVAT

                        if (paymentConditions.userIdWillPay)
                            new_session.userIdWillPay = paymentConditions.userIdWillPay;
                        else
                            new_session.userIdWillPay = paymentConditionsInit.userIdWillPay;

                        if (paymentConditions.userIdToBilling)
                            new_session.userIdToBilling = paymentConditions.userIdToBilling;
                        else
                            new_session.userIdToBilling = paymentConditionsInit.userIdToBilling;

                        if (result)
                            new_session.fees = await vatService.getFees(result.charger, new_session.userIdToBilling)
                        new_session.adyenReference = paymentConditions.adyenReference;
                        new_session.transactionId = paymentConditions.transactionId;
                        new_session.paymentStatus = "UNPAID"
                        new_session.createdWay = "PUT_SESSION"

                        if (evDetails) {
                            if (evDetails.acceptKMs) new_session.acceptKMs = evDetails.acceptKMs
                            if (evDetails.updateKMs) new_session.updateKMs = evDetails.updateKMs
                        }

                        Session.create(new_session, async (err, result) => {
                            if (result) {
                                saveSessionLogs({
                                    ...baseDataToSaveLogs,
                                    status: Enums.SessionFlowLogsStatus.SUCCESS,
                                    sessionId: result._id,
                                })
                                const stopInvalidCountryFlag = await toggle.isEnable('charge-26')
                                // if invalid country, stop
                                if (
                                    stopInvalidCountryFlag
                                    && result.address?.countryCode
                                    && !Constants.AllowedCountries.includes(result.address.countryCode)
                                ) {
                                    await InvalidCountryService.stopSession(result)
                                }

                                return res.status(200).send(Utils.response(null, 1000, "Created Session " + sessionId + ""));
                            } else {
                                console.log("Session not created ", err);
                                saveSessionLogs({
                                    ...baseDataToSaveLogs,
                                    stage: `[PutSession 2.1.1] - [create session]`,
                                    errorMessage: `Session not created ${err.message || ''}`,
                                })
                                return res.status(200).send(Utils.response(null, 2000, "Generic client error "));
                            }
                        })


                    }).catch((e) => {
                        let status = ""
                        let text = ""
                        if (e.response) {
                            status = e.response.status
                            text = e.response.statusText
                        } else {
                            if (e.message) {
                                status = "500",
                                    text = e.message
                            }
                        }
                        console.log("[handlerSession.startSession.getPlatformInfo] Generic client error " + status + "- " + text);
                        saveSessionLogs({
                            ...baseDataToSaveLogs,
                            errorMessage: `Generic client error ${status} - ${text}`,
                            errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR,
                            status: Enums.SessionFlowLogsStatus.ERROR,
                            externalSessionId: sessionId,
                            stage: `[PutSession 2.1.1] - [getPlatformInfo]`,
                        })
                        return res.status(200).send(Utils.response(null, 2000, "Generic client error " + status + " - " + text));
                    });


                    // })

                }
            });



        }
        catch (e) {
            console.log("[handlerSession.startSession] Generic client error. ", e);
            saveSessionLogs({
                ...baseDataToSaveLogs,
                errorMessage: `Generic client error - ${e.message || ''}`,
                errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR,
                status: Enums.SessionFlowLogsStatus.ERROR,
                externalSessionId: sessionId,
            })
            return res.status(200).send(Utils.response(null, 2000, "Generic client error"));
        }
    },
    updateSession: async function (req, res) {
        const context = `2.1.1 [handlerSession.updateSession] ${req.method || ''} ${req.originalUrl || ''}`;

        //Get Token, sent previously to partner
        var token = req.headers.authorization.split(' ')[1];

        //Validate if sent data is valid JSON to process
        var data = req.body;

        const baseDataToSaveLogs = {
            userId: '--patch session--',
            hwId: '',
            plugId: '',
            stage: `[UpdateSession 2.1.1] - Route [PATCH ${req.originalUrl || ''}]`,
            action: 'stop',
            status: Enums.SessionFlowLogsStatus.ERROR,
            errorType: Enums.SessionFlowLogsErrorTypes.VALIDATION_ERROR
        }


        if (Utils.isEmptyObject(data)){
            saveSessionLogs({
                ...baseDataToSaveLogs,
                errorMessage: 'Empty request body',
            })
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));
        }
        baseDataToSaveLogs.payload = data

        var sessionId = data.id;
        if (!sessionId) {
            sessionId = req.params.sessionId;

            if (!sessionId){
                saveSessionLogs({
                    ...baseDataToSaveLogs,
                    errorMessage: 'Empty sessionId',
                })
                return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));
            }
        }

        baseDataToSaveLogs.externalSessionId = sessionId || '';
        let party_id = req.params.party_id
        let country_code = req.params.country_code
        // data.country_code = country_code
        data.party_id = party_id
        try {

            let query = {
                id: sessionId,
                status: {$nin: [global.SessionStatusStopped, global.SessionStatusSuspended]}
            };

            let sessionModel = Utils.getSessionModelObj(data);
            baseDataToSaveLogs.hwId = sessionModel?.location_id || ''
            baseDataToSaveLogs.plugId = sessionModel?.connector_id || ''

            // let query = {
            //     $or: [{ id: sessionId }, { authorization_reference: data.authorization_reference }],
            // };


            Session.updateSession(query, { $set: sessionModel }, async (err, doc) => {
                if (doc != null) {
                    if (doc.cdrId === "-1") {
                        if (sessionModel.status === "COMPLETED") {
                            Utils.updateSessionStopMeterValuesRoaming(doc)
                            sendSessionToHistoryQueue(doc._id, context)
                            saveSessionLogs({
                                ...baseDataToSaveLogs,
                                userId: doc?.userId || '',
                                status: Enums.SessionFlowLogsStatus.SUCCESS,
                                sessionId: doc._id,
                                stage: "COMPLETED Session 2.1.1",
                            }, true)
                        } else {
                            Utils.updateSessionMeterValuesRoaming(doc, sessionModel, true);
                        }
                    }

                    console.log("Updated Session " + sessionId);

                    const stopInvalidCountryFlag = await toggle.isEnable('charge-26')
                    // if invalid country, stop session
                    if (
                        stopInvalidCountryFlag
                        && doc.address.countryCode
                        && !Constants.AllowedCountries.includes(doc.address.countryCode)
                    ) {
                        await InvalidCountryService.stopSession(doc);
                    }

                    return res.status(200).send(Utils.response(null, 1000, "Updated Session " + sessionId + ""));
                } else {
                    if (sessionModel.status === "COMPLETED") {
                        saveSessionLogs({
                            ...baseDataToSaveLogs,
                            errorMessage: `Session ${sessionId} not found or already stopped`,
                            status: Enums.SessionFlowLogsStatus.ERROR
                        });
                    }
                    return res.status(400).send(Utils.response(null, 2000, "Session " + sessionId + " does not exists"));
                }
            });
        }
        catch (e) {
            console.log("[handlerSession.updateSession] Generic client error. ", e);
            saveSessionLogs({
                ...baseDataToSaveLogs,
                errorMessage: `Generic client error - ${e.message || ''}`,
                errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR,
                status: Enums.SessionFlowLogsStatus.ERROR,
            })
            return res.status(200).send(Utils.response(null, 2000, "Generic client error"));
        }
    },
    getUserId: function (idTag) {
        return new Promise(async (resolve, reject) => {
            let query = { uid: idTag };
            Token.findOne(query, { _id: 0, __v: 0, createdAt: 0, updatedAt: 0, source: 0 }, (err, token) => {
                if (token) {
                    console.log("token 2", token)
                    resolve(token);
                    //(chargingSessionFound.bookingId === undefined) || (chargingSessionFound.bookingId === "")
                }
                else
                    reject();
            }).catch(function (e) {
                console.log(e);
                reject();
                return;
            });;
        });
    }


}

