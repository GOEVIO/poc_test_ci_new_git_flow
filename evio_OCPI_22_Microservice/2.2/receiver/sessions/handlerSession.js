const Utils = require('../../../utils');
const RESPONSE_CODES = require('../../../utils/statusCode.OCPI');
const Session = require('../../../models/sessions')
const global = require('../../../global')
const { StatusCodes } = require('http-status-codes');
const moment = require('moment');
const { sendSessionToHistoryQueue } = require('../../../functions/sendSessionToHistoryQueue')
const vatService = require('../../../services/vat');
const { Enums } = require('evio-library-commons').default;
const { saveSessionLogs } = require('../../../functions/save-session-logs');
const { TariffsService } = require('evio-library-ocpi');
const { getAllUserInfo, getEmspTariffWithIdTag } = require('evio-library-identity').default;

module.exports = {
    startSession: async function (req, res) {
        const context = `2.2 [handlerSession.startSession] - ${req.method || ''} ${req.originalUrl || ''}`;
        const baseDataToSaveLogs = {
            userId: '--put session--',
            hwId: '',
            plugId: '',
            stage: `[PutSession 2.2] - Route [PUT ${req.originalUrl || ''}]`,
            action: 'start',
            status: Enums.SessionFlowLogsStatus.ERROR,
            errorType: Enums.SessionFlowLogsErrorTypes.VALIDATION_ERROR
        }
        try {
            const data = req.body;

            if (Utils.isEmptyObject(data)) {
                saveSessionLogs({
                    ...baseDataToSaveLogs,
                    errorMessage: 'Empty request body',
                })
                return res.status(StatusCodes.OK).send(Utils.response(null, RESPONSE_CODES.INVALID_PARAMS, "Invalid or missing parameters"));
            }

            const sessionId = data.id;
            if (!sessionId) {
                saveSessionLogs({
                    ...baseDataToSaveLogs,
                    errorMessage: 'Empty sessionId',
                })
                return res.status(StatusCodes.OK).send(Utils.response(null, RESPONSE_CODES.INVALID_PARAMS, "Invalid or missing parameters"));
            }

            baseDataToSaveLogs.externalSessionId = sessionId;
            baseDataToSaveLogs.hwId = data?.location_id || '';
            baseDataToSaveLogs.plugId  = data?.connector_id || '';

            const idTag = data.cdr_token !== undefined && data.cdr_token !== null ? data.cdr_token.uid : data.token_uid;

            // Build query
            let query = {};
            if (data.status === Enums.SessionStatusesTextTypes.ACTIVE) {
                query = {
                    "$or": [
                        { id: sessionId },
                        {
                            "$and": [
                                { location_id: data.location_id },
                                { evse_uid: data.evse_uid },
                                { token_uid: idTag },
                                { status: { $in: [
                                    Enums.SessionStatusesTextTypes.PENDING_START,
                                    Enums.SessionStatusesTextTypes.PENDING,
                                    Enums.SessionStatusesTextTypes.ACTIVE,
                                    Enums.SessionStatusesTextTypes.PENDING_DELAY
                                ] } }
                            ]
                        }
                    ]
                };
                if (data.authorization_reference) { // Only add authorization_reference if sent
                    query["$or"].push({ authorization_reference: data.authorization_reference })
                }
            } else if (data.authorization_reference) {
                query = {
                    "$or": [
                        { id: sessionId },
                        { authorization_reference: data.authorization_reference }
                    ]
                };
            } else {
                query = {
                    id: sessionId
                };
            }

            /**
             * This function guarantees that we don't update a session that is already stopped or 
             * another existing session in the same location with the same token.
             */
            await Utils.validateSessionUpdate(query, data);

            // Update or create session based on query
            Session.updateSession(query, { $set: data }, async (err, doc) => {
                if (err) {
                    console.log("[startSession] Error updating session:", err);
                    return res.status(StatusCodes.OK).send(Utils.response(null, RESPONSE_CODES.CLIENT_ERROR, "Generic client error"));
                }

                if (doc) {
                    if (doc.cdrId === "-1") {
                        if (data.status === 'COMPLETED') {
                            Utils.updateStopSessionMeterValues(doc);
                            sendSessionToHistoryQueue(doc._id, context)
                            saveSessionLogs({
                                ...baseDataToSaveLogs,
                                userId: doc?.userId || '',
                                status: Enums.SessionFlowLogsStatus.SUCCESS,
                                stage: "COMPLETED Session 2.2",
                                sessionId: doc._id,
                            }, true)
                        } else {
                            saveSessionLogs({
                                ...baseDataToSaveLogs,
                                userId: doc?.userId || '',
                                status: Enums.SessionFlowLogsStatus.SUCCESS,
                                stage: `UPDATE session in PUT session 2.2 to status ${data?.status || ''}`,
                                sessionId: doc._id,
                            }, true)
                            Utils.updateMeterValues(doc, data, true);
                        }
                    }
                    return res.status(StatusCodes.OK).send(Utils.response(null, RESPONSE_CODES.GENERIC_SUCCESS, "Updated Session " + sessionId));
                } else {
                    // Prepare new session data if session was not found
                    await this.prepareNewSession(data, sessionId, idTag, query, res, baseDataToSaveLogs);
                }
            });
        } catch (e) {
            console.log("[startSession] Error:", e);
            saveSessionLogs({
                ...baseDataToSaveLogs,
                userId: req?.body?.cdr_token?.uid || '-- user not defined --',
                externalSessionId: req?.body?.id || '',
                status: Enums.SessionFlowLogsStatus.ERROR,
                errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR,
                errorMessage: `Error d ${e?.message ? e.message : JSON.stringify(e || '') }`,
            })
            return res.status(StatusCodes.OK).send(Utils.response(null, RESPONSE_CODES.CLIENT_ERROR, "Generic client error"));
        }
    },

    updateSession: async function (req, res) {
        const context = `2.2 [handlerSession.updateSession] - ${req.method || ''} ${req.originalUrl || ''}`;
        try {

            // Validate if sent data is valid JSON to process
            var data = req.body;

            const baseDataToSaveLogs = {
                userId: '--patch session--',
                hwId: '',
                plugId: '',
                stage: `[UpdateSession 2.2] - Route [PATCH ${req.originalUrl || ''}]`,
                action: 'stop',
                status: Enums.SessionFlowLogsStatus.ERROR,
                errorType: Enums.SessionFlowLogsErrorTypes.VALIDATION_ERROR
            }

            if (Utils.isEmptyObject(data)) {
                saveSessionLogs({
                    ...baseDataToSaveLogs,
                    errorMessage: 'Empty request body',
                })
                return res.status(StatusCodes.OK).send(Utils.response(null, RESPONSE_CODES.INVALID_PARAMS, "Invalid or missing parameters"));
            }

            var sessionId = data.id;
            if (!sessionId) {
                sessionId = req.params.sessionId;

                if (!sessionId) {
                    saveSessionLogs({
                        ...baseDataToSaveLogs,
                        errorMessage: 'Empty sessionId',
                    })
                    return res.status(StatusCodes.OK).send(Utils.response(null, RESPONSE_CODES.INVALID_PARAMS, "Invalid or missing parameters"));
                }
            }

            let query = {
                id: sessionId,
                status: {$nin: [global.SessionStatusStopped, global.SessionStatusSuspended]}
            };

            let session = await Session.findOne(query)

            if(data.start_date_time && session?.timeZone)
                data.local_start_date_time = moment(data.start_date_time).tz(session.timeZone).format("YYYY-MM-DDTHH:mm:ss");

            if(data.end_date_time && session?.timeZone)
                data.local_end_date_time = moment(data.end_date_time).tz(session.timeZone).format("YYYY-MM-DDTHH:mm:ss");

            baseDataToSaveLogs.externalSessionId = sessionId;
            baseDataToSaveLogs.hwId = session?.location_id || '';
            baseDataToSaveLogs.plugId  = session?.connector_id || '';
            baseDataToSaveLogs.userId = session?.userId || '';

            // Update session based on session id
            Session.updateSession(query, { $set: data }, async (err, doc) => {
                if (err) {
                    console.log("[updateSession] Error updating session:", err);
                    saveSessionLogs({
                        ...baseDataToSaveLogs,
                        errorMessage: `Error during update session ${sessionId} : ${err?.message ? err.message : JSON.stringify(err || '')}`,
                        status: Enums.SessionFlowLogsStatus.ERROR,
                    });
                    return res.status(StatusCodes.OK).send(Utils.response(null, RESPONSE_CODES.CLIENT_ERROR, "Generic client error"));
                }

                if (doc) {
                    if (doc.cdrId === "-1") {
                        if (data.status === 'COMPLETED') {
                            Utils.updateStopSessionMeterValues(doc);
                            sendSessionToHistoryQueue(doc._id, context)
                            saveSessionLogs({
                                ...baseDataToSaveLogs,
                                userId: doc?.userId || '',
                                status: Enums.SessionFlowLogsStatus.SUCCESS,
                                sessionId: doc._id,
                                stage: "COMPLETED Session 2.2",
                            }, true)
                        } else {
                            Utils.updateMeterValues(doc, data, true);
                        }
                    }

                    console.log("Updated Session " + sessionId);
                    return res.status(StatusCodes.OK).send(Utils.response(null, RESPONSE_CODES.GENERIC_SUCCESS, "Updated Session " + sessionId));
                } else {
                    if (data.status === "COMPLETED") {
                        saveSessionLogs({
                            ...baseDataToSaveLogs,
                            errorMessage: `Session ${sessionId} not found or already stopped`,
                            status: Enums.SessionFlowLogsStatus.ERROR,
                        });
                    }
                    return res.status(StatusCodes.BAD_REQUEST).send(Utils.response(null, RESPONSE_CODES.CLIENT_ERROR, "Session " + sessionId + " does not exist"));
                }
            });
        } catch (e) {
            console.error("[updateSession] Error:", e);
            saveSessionLogs({
                ...baseDataToSaveLogs,
                errorMessage: `Generic client error - ${e?.message ? e.message : JSON.stringify(e || '') }`,
                errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR,
                status: Enums.SessionFlowLogsStatus.ERROR,
            })
            return res.status(StatusCodes.OK).send(Utils.response(null, RESPONSE_CODES.CLIENT_ERROR, "Generic client error"));
        }
    },

    prepareNewSession: async function (data, sessionId, idTag, query, res, baseDataToSaveLogs = {}) {
        // Prepare and create a new session
        const tokenUid = await Utils.getUserId(idTag);
        const { charger = undefined, plug = undefined } = await Utils.getCharger(data.location_id, data.connector_id);
        let evDetails, fleetDetails;
        let userId = "Unknown";
        let evId = "-1";
        let evOwner = "-1";
        let invoiceType = "-1";
        let invoiceCommunication = "-1";

        if (tokenUid) {
            evId = tokenUid.evId;
            userId = tokenUid.userId;
            if (tokenUid.evId !== "-1") {
                const evInfo = await Utils.getEvInfo(evId, userId)
                evOwner = evInfo?.evOwner;
                invoiceType = evInfo?.invoiceType;
                invoiceCommunication = evInfo?.invoiceCommunication;
                evDetails = evInfo?.evDetails;
                fleetDetails = evInfo?.fleetDetails;
                userId = evInfo?.userId;
            }
        }
        

        const fees = charger ? await vatService.getFees(charger) : { IEC: 0.001, IVA: 0.23 };
        const voltageLevel = charger?.voltageLevel || "BTN";
        const address = charger?.address || "";
        const cpoCountryCode = charger?.cpoCountryCode || "";
        //getTimezoneFromGeometry commented because not found implementation in Utils or in another place
        //const geometry = charger?.geometry || {};
        const timeZone = charger?.timeZone //|| await Utils.getTimezoneFromGeometry(geometry);
        const source = charger?.source || "MobiE";
        const plugId = plug?.plugId || data.connector_id;
        const tariffId = plug?.tariffId?.[0]
        const plugPower = plug?.power ?? 22
        const plugVoltage = plug?.voltage ?? 400
        const tariffOPC = await TariffsService.getOcpiCpoTariff(
            charger,
            plug?.serviceCost?.tariffs,
            '',
            charger?.geometry?.coordinates?.[1],
            charger?.geometry?.coordinates?.[0],
            plug?.power,
            userId,
            evOwner
        ) ?? await Utils.getDefaultOPCTariff();
        data.token_uid = idTag;

        const newSession = this.createSessionObject(
            data, 
            evId, 
            evOwner, 
            invoiceType, 
            invoiceCommunication, 
            evDetails, 
            fleetDetails, 
            userId, 
            fees, 
            voltageLevel, 
            address, 
            cpoCountryCode, 
            timeZone, 
            plugId, 
            source,
            tariffId,
            plugPower,
            plugVoltage,
            tariffOPC,
        );

        if(newSession.start_date_time && timeZone)
            newSession.local_start_date_time = moment(newSession.start_date_time).tz(timeZone).format("YYYY-MM-DDTHH:mm:ss");

        if(newSession.end_date_time && timeZone)
            newSession.local_end_date_time = moment(newSession.end_date_time).tz(timeZone).format("YYYY-MM-DDTHH:mm:ss");

        await this.paymentConditions(newSession, data, plugId, tokenUid, res);

        if(charger)
            newSession.fees = await vatService.getFees(charger, newSession.userIdToBilling)

        Session.create(newSession, (err, result) => {
            if (result) {
                Utils.sendStartNotification(result);
                return res.status(StatusCodes.OK).send(Utils.response(null, RESPONSE_CODES.GENERIC_SUCCESS, "Created Session " + sessionId + ""));
            } else {
                saveSessionLogs({
                    ...baseDataToSaveLogs,
                    userId: result?.userId || '',
                    status: Enums.SessionFlowLogsStatus.ERROR,
                    stage: `[PutSession 2.2] - [handlerSession.prepareNewSession]`,
                    errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR,
                    errorMessage: `Session not created, generic error ${err?.message ? err.message : JSON.stringify(err || '')}`,
                })
                return res.status(StatusCodes.OK).send(Utils.response(null, RESPONSE_CODES.CLIENT_ERROR, "Generic client error "));
            }
        });
    },

    createSessionObject: function (data, evId, evOwner, invoiceType, invoiceCommunication, evDetails, fleetDetails,
                                   userId, fees, voltageLevel, address, cpoCountryCode, timeZone, plugId, source , tariffId, plugPower, plugVoltage, tariffOPC) {
        const sessionData = {
            ...data,
            source,
            tariffId,
            plugPower,
            plugVoltage,
            tariffOPC,
            evId,
            evOwner,
            invoiceType,
            invoiceCommunication,
            evDetails,
            fleetDetails,
            userId,
            fees,
            voltageLevel,
            address,
            cpoCountryCode,
            timeZone,
            plugId,
            updatedAt: new Date(),
            createdAt: new Date(),
            acceptKMs: evDetails?.acceptKMs ?? false,
            updateKMs: evDetails?.updateKMs ?? false,
        };

        return new Session(sessionData);
    },

    async populateSessionDetails(new_session, tokenUid, result) {
        if (tokenUid) {
            new_session.evId = tokenUid.evId;
            var { ev, fleet } = await Utils.getEVAllByEvId(tokenUid.evId);
            new_session.evOwner = ev?.userId || "-1";
            new_session.evDetails = ev;
            new_session.fleetDetails = fleet;
            new_session.userId = Utils.getUserIdByEv(ev) ?? tokenUid.userId;

            if (result) {
                var plug = result.plug;
                new_session.voltageLevel = result.charger.voltageLevel;
                new_session.address = result.charger.address;
                new_session.cpoCountryCode = result.charger.cpoCountryCode;
                new_session.geometry = result.charger.geometry;
                new_session.timeZone = result.charger.timeZone;

                if (!new_session.timeZone) {
                    var { latitude, longitude } = Utils.getChargerLatitudeLongitude(new_session.geometry);
                    new_session.timeZone = Utils.getTimezone(latitude, longitude);
                }
            }

            if (plug) {
                new_session.plugId = plug.plugId;
                new_session.plugPower = plug.power || 22;
                new_session.plugVoltage = plug.voltage || 400;
                new_session.plugId = plug.plugId;
                var tariffId = plug.tariffId[0];
                new_session.tariffOPC = tariffId ? await Utils.getTariffOPC(tariffId) : {};
            }
        }

        new_session.operator = new_session.party_id;
        new_session.chargeOwnerId = new_session.party_id;
    },

    async paymentConditions(new_session, data, plugId, tokenUid, res) {
        var paymentConditions = {};

        try {
            const idTagToPaymentCondition = await Utils.verifyFlagIsActiveToSendIdTagToPaymentConditions(tokenUid?.uid)
            paymentConditions = await Utils.getPaymentConditions(new_session.userId, new_session.evId, data.location_id, plugId, process.env.chargerTypeMobie, new_session.fees, idTagToPaymentCondition);
        } catch (e) {

            paymentConditions.userIdWillPay = e.userIdWillPay || ( (await Utils.validateEV(new_session.evId, new_session.userId, new_session?.evDetails))?.userIdWillPay || new_session.userId);
            paymentConditions.userIdToBilling = e.userIdToBilling || ( (await Utils.validateEV(new_session.evId, new_session.userId, new_session?.evDetails))?.userIdToBilling || new_session.userId);

            console.log("[paymentConditions] Get payment conditions failed. Reason:", e);
            new_session.notes = "Get payment conditions failed - " + JSON.stringify(e.message);
        }

        try {
            var { userIdInfo, userIdWillPayInfo, userIdToBillingInfo } = await getAllUserInfo({userId: new_session.userId, userIdWillPay: paymentConditions.userIdWillPay, userIdToBilling: paymentConditions.userIdToBilling});
        } catch (e) {
            console.log("[paymentConditions] Get payment conditions failed. Reason:", e);
            new_session.notes = "Get getAllUserInfo conditions failed - " + JSON.stringify(e.message);
        }


        new_session.userIdInfo = userIdInfo;
        new_session.userIdWillPayInfo = userIdWillPayInfo;
        new_session.userIdToBillingInfo = userIdToBillingInfo;
        new_session.chargerType = process.env.chargerTypeMobie 
        new_session.authorization_reference = data?.authorization_reference ?? Utils.generateToken(24);
        new_session.operator = data.party_id;
        new_session.chargeOwnerId = data.party_id;
        new_session.createdWay = "PUT_SESSION";

        console.log("Handler session:", paymentConditions);

        new_session.clientName = paymentConditions.clientName || userIdWillPayInfo?.clientName
        paymentConditions.cardNumber && (new_session.cardNumber = paymentConditions.cardNumber);

        var tariffCEME = "";
        if (paymentConditions.ceme) {
            if (!Utils.isEmptyObject(paymentConditions.ceme.plan)) {
                tariffCEME = paymentConditions.ceme.plan;
                var tariffArray = Utils.getTariffCemeByDate(tariffCEME, data.start_date_time);
                tariffCEME.tariff = tariffArray;
                new_session.tariffCEME = tariffCEME;
            } else {
                tariffCEME = await getEmspTariffWithIdTag(tokenUid?.uid, Enums.ChargerNetworks.Mobie);
                if (!tariffCEME) tariffCEME = await Utils.getTariffCEME(new_session.clientName);
                var tariffArray = Utils.getTariffCemeByDate(tariffCEME, data.start_date_time);
                tariffCEME.tariff = tariffArray;
                new_session.tariffCEME = tariffCEME;
            }
        } else {
            tariffCEME = await getEmspTariffWithIdTag(tokenUid?.uid, Enums.ChargerNetworks.Mobie);
            if (!tariffCEME) tariffCEME = await Utils.getTariffCEME(new_session.clientName);
            var tariffArray = Utils.getTariffCemeByDate(tariffCEME, data.start_date_time);
            tariffCEME.tariff = tariffArray;
            new_session.tariffCEME = tariffCEME;
        }

        var { tariffTAR, TAR_Schedule } = await Utils.getCEMEandTar(tariffCEME._id, new_session.timeZone, "MobiE", new_session.clientName);

        new_session.schedulesCEME = TAR_Schedule;
        new_session.tariffTAR = tariffTAR;
        new_session.timeZone = new_session.timeZone || "";

        new_session.paymentType = paymentConditions.paymentType || (userIdWillPayInfo?.paymentPeriod || "AD_HOC");
        new_session.clientType = paymentConditions.clientType || userIdWillPayInfo?.clientType
        new_session.billingPeriod = paymentConditions.billingPeriod || userIdToBillingInfo?.billingPeriod;
        new_session.paymentMethod = paymentConditions.paymentMethod || "Unknown";
        new_session.paymentMethodId = paymentConditions.paymentMethodId || "-1";
        new_session.walletAmount = paymentConditions.walletAmount ?? -1;
        new_session.reservedAmount = paymentConditions.reservedAmount ?? -1;
        new_session.confirmationAmount = paymentConditions.confirmationAmount ?? -1;
        paymentConditions.plafondId && (new_session.plafondId = paymentConditions.plafondId);
        new_session.viesVAT = paymentConditions.viesVAT;

        new_session.userIdWillPay = paymentConditions.userIdWillPay
        new_session.userIdToBilling = paymentConditions.userIdToBilling

        new_session.adyenReference = paymentConditions.adyenReference || "-1";
        new_session.transactionId = paymentConditions.transactionId || "-1";

    },

    async createNewSession(new_session, sessionId, res) {
        Session.create(new_session, (err, result) => {
            if (err) {
                console.log("[createNewSession] Session not created:", err);
                return res.status(StatusCodes.OK).send(Utils.response(null, RESPONSE_CODES.CLIENT_ERROR, "Generic client error"));
            }

            if (result) {
                Utils.sendStartNotification(result);
                return res.status(StatusCodes.OK).send(Utils.response(null, RESPONSE_CODES.GENERIC_SUCCESS, "Created Session " + sessionId));
            } else {
                console.log("[createNewSession] Session not created.");
                return res.status(StatusCodes.OK).send(Utils.response(null, RESPONSE_CODES.CLIENT_ERROR, "Generic client error"));
            }
        });
    },

    setPaymentConditions: async function (session, plugId, tokenUid, data, res) {
        try {
            let paymentConditions = await Utils.getPaymentConditions(
                session.userId,
                session.evId,
                data.location_id,
                plugId,
                process.env.chargerTypeMobie,
                session.fees
            );
            session.paymentConditions = paymentConditions;
        } catch (e) {
            console.log("[getAndPopulatePaymentConditions] Get payment conditions failed. Reason:", e);
            session.notes = "Get payment conditions failed - " + JSON.stringify(e.message);
            res.status(e.status || StatusCodes.INTERNAL_SERVER_ERROR).send(Utils.response(null, e.status || StatusCodes.INTERNAL_SERVER_ERROR, `At the moment, it is not possible to start the upload session. Please try again later. ${e.message}`));
            return 'error';
        }
    }
};
