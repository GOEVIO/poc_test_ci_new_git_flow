var Platforms = require('./models/platforms');
const JsonFind = require('json-find');
const mappingMobie = require('./models/mappingMobiePlugStatus.json');
const mappingCountryCodes = require('./models/mappingCountryCodes.json');
const mappingNames = require('./models/mappingCountryCodesToNames.json');
const jsonCountryNames = JsonFind(mappingNames)
const jsonCountryCodes = JsonFind(mappingCountryCodes)
const jsonFile = JsonFind(mappingMobie);
const moment = require('moment');
const timeZoneMoment = require('moment-timezone');
const global = require('./global');
const Token = require('./models/tokens')
const axios = require('axios');
const _ = require("underscore");
const Tariff = require('./models/tariffs')
const Session = require('./models/sessions')
const TariffCEME = require('./models/tariffCEME')
const DefaultTariffs = require('./models/defaultTariffs')
const mobieScheduleTime = require('./models/schedulesCEME')
const DifferentCdrs = require('./models/differentCdrs')
const LogsOut = require('./models/logsout');
const mobieScheduleTimeJson = JsonFind(mobieScheduleTime)
const regex = /<U\+([0-9A-Z]{4})>/gm;
const subst = `\\u$1`;
const geoTimeZone = require('geo-tz')
const Excel = require('exceljs');
const nodemailer = require("nodemailer");
const { retrieveValidationCDRConfig } = require("evio-library-configs");
const toggle = require('evio-toggle').default
const vatService = require('./services/vat')
const { ensureCountryCode } = require('evio-library-configs').default;
const { findEvAndFleetById } = require('evio-library-evs');
const { findGroupDrivers, getAllUserInfo, getEmspTariffWithIdTag } = require('evio-library-identity').default;
const { getTarTariff } = require('evio-library-tariffs').default;
const { Enums, Helpers } = require('evio-library-commons').default;
const { CdrsService, TariffsService } = require("evio-library-ocpi");

const { sendMessage } = require('evio-event-producer');
const DevicesPreAuthorizationService = require('./v2/services/device-preauthorization.service');
const validationCDR = require('./validations/CDRStatus/validation');
const constants = require('./utils/constants');
const { formatDuration } = require('./utils/date-format.utils');
const { NotificationType, CodeTranslationsPushNotifications, notifySessionEvNotCharging, notifySessionEvCharging } = require('evio-library-notifications').default;

const { saveSessionLogs } = require('./functions/save-session-logs');


// Disable node-cron by mocking for an easy turn-back
// const cron = require('node-cron');
const cron = {
    schedule: ()=>({
     start: ()=>{},
     stop: ()=>{},
     validate: ()=>{},
     status: '',
    })
};
const Constants = require('./utils/constants');

const { StatusCodes } = require('http-status-codes');
const Sentry = require("@sentry/node");

const UtilsFirebase = require('./utils_firebase');
const { tryEach } = require('async');
const { sendSessionToHistoryQueue } = require('./functions/sendSessionToHistoryQueue');

const {findByChargerHWID} = require('evio-library-chargers/dist').default;

const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

function dayOfTheWeek(date) {
    const context = "[Utills dayOfTheWeek]"
    try {
        if (!date && date instanceof Date) {
            console.log(`${context} Error - Missing input fields`)
            return null
        }

        switch (date.getDay()) {
            case "0":
                return "MONDAY"
            case "1":
                return "TUESDAY"
            case "2":
                return "WEDNESDAY"
            case "3":
                return "THURSDAY"
            case "4":
                return "FRIDAY"
            case "5":
                return "SATURDAY"
            case "6":
                return "SUNDAY"
            default:
                console.log(`${context} Error - unknowed day of the week: `, date.getDay())
                return null
        }
    } catch (error) {
        console.log(`${context} Error - `, error)
        return null
    }
}


const Utils = {
    round: function (value, decimals = 2) {
        //return Number(formatter.format(value))
        return Number(value.toFixed(decimals))
    },
    diffDateSeconds: function (startDate) {

        const dateNow = moment();
        //console.log(dateNow)

        const duration = moment.duration(dateNow.diff(startDate));
        const dif = duration.asSeconds();
        return dif;

    },
    generateToken: function (length) {
        const uid = require('rand-token').uid;
        const token = uid(length);

        return token;
    },
    response: function (data, statusCode, statusMessage) {
        let  message = {};

        if (data !== null)
            message = { data: data, status_code: statusCode, status_message: statusMessage, timestamp: new Date().toISOString(), }
        else
            message = { status_code: statusCode, status_message: statusMessage, timestamp: new Date().toISOString(), }

        return message;
    },
    getPlatformInfo: function (token) {
        return new Promise(function (resolve, reject) {
            if (!token) {
                console.log("[getPlatformInfo] Error - Token is empty");
                resolve(null);
            }
            else {
                let query = {
                    evioActiveCredentialsToken: {
                        $elemMatch: { token: token }
                    }
                };

                Platforms.findOne(query, (err, platform) => {
                    if (err) {
                        console.log(`[find] Error `, err);
                        resolve(null);
                    }
                    else {
                        resolve(platform);
                    };
                });
            }
        });
    },
    isEmptyObject: function (obj) {
        for (let key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                return false;
            }
        }
        return true;
    },

    /*
AVAILABLE The EVSE/Connector is able to start a new charging session.
BLOCKED The EVSE/Connector is not accessible because of a physical barrier, i.e. a car.
CHARGING The EVSE/Connector is in use.
INOPERATIVE The EVSE/Connector is not yet active or it is no longer available (deleted).
OUTOFORDER The EVSE/Connector is currently out of order.
PLANNED The EVSE/Connector is planned, will be operating soon.
REMOVED The EVSE/Connector was discontinued/removed.
RESERVED The EVSE/Connector is reserved for a particular EV driver and is unavailable for other drivers.
UNKNOWN No status information available (also used when offline).
*/

    getMapping: function (data, mapping_type) {
        let mapping_list = jsonFile[mapping_type];

        let value = "unknown";

        if (mapping_type == "parkingType")
            value = "Street";
        else if (mapping_type == "plugStatus")
            value = "40";

        if (data != undefined) {
            value = Object.keys(mapping_list).find(key => mapping_list[key] === data.toString());
            if (value === undefined) {
                value = Object.keys(mapping_list).find(key => mapping_list[key].includes(data.toString()));
                if (value === undefined) {
                    if (mapping_type == "parkingType")
                        value = "Street";
                    else if (mapping_type == "plugStatus")
                        value = "40"
                    else
                        value = "unknown";
                }
            };
        }
        return value;
    },
    getEvDriverId: function (evId) {
        return new Promise(async (resolve, reject) => {

            const params = {
                evId: evId,
            }

            axios.get(global.checkEvDriverEndpoint, { params }).then(function (response) {
                const obj = response.data;
                if (typeof obj === 'undefined') {
                    resolve(false);
                }
                else {
                    resolve(obj);
                }
            }).catch(function (error) {

                if (error.response) {
                    console.log("[getEvDriverId] error: " + error.response.data);
                    resolve(false);
                }
                else {
                    console.log("[getEvDriverId] error: " + error.message);
                    resolve(false);
                }
            });
        });
    },
    getUserId: function (idTag) {
        return new Promise(async (resolve, reject) => {
            let query = { uid: idTag };
            Token.findOne(query, { _id: 0, __v: 0, createdAt: 0, updatedAt: 0, source: 0 }, (err, token) => {
                if (token) {
                    resolve(token);
                }
                else
                    resolve();
            }).catch(function (e) {
                console.log(e);
                resolve();
                return;
            });;
        });
    },
    getUserIdActiveteOrInactive: function (idTag) {
        return new Promise(async (resolve, reject) => {
            let query = { uid: idTag };
            Token.findOne(query, { _id: 0, __v: 0, createdAt: 0, updatedAt: 0, source: 0 }, (err, token) => {
                if (token) {
                    resolve(token);
                }
                else
                    resolve();
            }).catch(function (e) {
                logger.error(e);
                resolve();
                return;
            });;
        });
    },
    getCharger: function (hwId, plugId) {
        return new Promise(async (resolve, reject) => {
            const chargersEndpoint = global.publicNetworkChargersProxy + "/" + hwId;
            axios.get(chargersEndpoint, {}, {}).then(function (response) {

                if (typeof response.data !== 'undefined' && response.data !== '') {
                    const charger = response.data;
                    //console.log(charger);
                    const plugs = charger.plugs;
                    const plug = _.where(plugs, { plugId: plugId });

                    //Return tariff Id
                    resolve({ charger: charger, plug: plug[0] });
                }
                else {
                    console.log("Checking OPC Tariff- Charger does nor found " + hwId)
                    resolve(false);
                }
            }).catch(function (e) {
                console.log("[Utils getCharger - Charger does not found " + hwId + ". Error: " + e.message)
                resolve(false);
                return;
            });
        });
    },
    getTariffOPC: async function (tariffId) {
        const context = "Function getTariffOPC";

        try {
            const query = { id: tariffId };
            const fields = {
                _id: 0,
                __v: 0,
                createdAt: 0,
                updatedAt: 0,
                source: 0,
                "elements._id": 0,
                "elements.restrictions._id": 0,
                "elements.price_components._id": 0,
                "elements.price_components.price_round._id": 0,
                "elements.price_components.step_round._id": 0,
            };

            const tariff = await Tariff.findOne(query, fields).lean();
            if (tariff) {
                return tariff;
            } else {
                const defaultTariff = await Utils.getDefaultOPCTariff();
                console.log(`[${context}] Tariff not found using tariffId=${tariffId}, returning fallback tariff=${JSON.stringify(defaultTariff)}`);
                return defaultTariff;
            }
        } catch (e) {
            // Log the error and capture with Sentry
            Sentry.captureException(e);
            const defaultTariff = await Utils.getDefaultOPCTariff();
            console.error(`[${context}] Error when fetching tariff using tariffId=${tariffId}, returning fallback tariff=${JSON.stringify(defaultTariff)}`);
            return defaultTariff;
        }
    },
    getTariffCEME: function (clientName) {
        const context = "Function getTariffCEME"

        // TODO FOR now it's ok. Later, we need to check which CEME is charging and return specific tariff and maybe, throught axios get tariff in public tariffs microservice
        return new Promise(async (resolve, reject) => {
            try {
                let tariffCEME = await TariffCEME.findOne({ planName: `server_plan_${clientName}` })
                if (!tariffCEME) {
                    tariffCEME = await TariffCEME.findOne({ planName: "server_plan_EVIO_ad_hoc" })
                }
                resolve(tariffCEME);
            } catch (error) {
                console.log(`[${context}] Error `, error.message);

                let tariffCEME = {
                    "country": "PT",
                    "CEME": "EVIO",
                    "tariffType": "server_bi_hour",
                    "cycleType": "server_daily",
                    "planName": "server_plan_EVIO",
                    "tariff": [
                        {
                            "type": "energy",
                            "power": "all",
                            "uom": "€/kWh",
                            "tariffType": "server_empty",
                            "voltageLevel": "BTN",
                            "price": 0.35
                        },
                        {
                            "type": "energy",
                            "power": "all",
                            "uom": "€/kWh",
                            "tariffType": "server_out_empty",
                            "voltageLevel": "BTN",
                            "price": 0.35
                        }
                    ],
                    "activationFee": {
                        "currency": "EUR",
                        "value": Constants.defaultCEMEtariff.activationFee
                    },
                    "activationFeeAdHoc": {
                        "currency": "EUR",
                        "value": Constants.defaultCEMEtariff.activationFeeAdHoc
                    }
                }
                resolve(tariffCEME);
            }
        });
    },
    getTariffTAR: function (ceme) {
        const tariffTAR = {
            "country": "PT",
            "tariffType": "server_bi_hour",
            "tariff": [
                {
                    "uom": "€/kWh",
                    "tariffType": "server_empty",
                    "voltageLevel": "BTN",
                    "price": -0.0180
                },
                {
                    "uom": "€/kWh",
                    "tariffType": "server_out_empty",
                    "voltageLevel": "BTN",
                    "price": 0.0299
                },
                {
                    "uom": "€/kWh",
                    "tariffType": "server_empty",
                    "voltageLevel": "BTE",
                    "price": -0.0180
                },
                {
                    "uom": "€/kWh",
                    "tariffType": "server_out_empty",
                    "voltageLevel": "BTE",
                    "price": 0.0299
                },
                {
                    "uom": "€/kWh",
                    "tariffType": "server_empty",
                    "voltageLevel": "MT",
                    "price": -0.0215
                },
                {
                    "uom": "€/kWh",
                    "tariffType": "server_out_empty",
                    "voltageLevel": "MT",
                    "price": 0.0164
                }
            ]
        }
        return tariffTAR;
    },
    getCemeScheduleTime: function () {
        return mobieScheduleTimeJson;
    },
    getPaymentConditions: function (userId, evId, hwId, plugId, chargerType, fees, idTag = '') {
        //FOR now it's ok. Later, we need to check which CEME is charging and return specific tariff and maybe, throught axios get tariff in public tariffs microservice
        return new Promise(async (resolve, reject) => {
            const data = {
                userId: userId,
                data: {
                    hwId: hwId,
                    plugId: plugId,
                    evId: evId,
                    tariffId: "-1",
                    chargerType: chargerType,
                    fees: fees,
                    idTag
                }
            }

            axios.get(global.paymentCheckConditionsEndpoint, { data }).then(function (response) {
                const paymentConditions = response.data;
                if (typeof paymentConditions === 'undefined') {
                    resolve();
                }
                else {
                    resolve(paymentConditions);
                }
            }).catch(function (error) {
                if (error.response)
                    reject({ message: JSON.stringify(error.response.data), status: error.response.status, });
                else
                reject({ message: error.message, status: StatusCodes.INTERNAL_SERVER_ERROR, });
            });
        });
    },
    updateMeterValues: function (chargingSession, payload, sendNotification) {
        const context = "Function updateMeterValues"
        return new Promise(async (resolve, reject) => {
            try {
                //Obter inicio de sessão de carregamento à sessão de carregamento
                let startDate
                if ('start_date_time' in payload) {
                    startDate = payload.start_date_time;
                } else {
                    startDate = chargingSession.start_date_time
                }

                let readDate = payload.last_updated ? moment.utc(payload.last_updated) : moment.utc(new Date().toISOString())
                let communicationDate = moment.utc();

                const isFeatureFlagActive = await toggle.isEnable('charge-314-not-notify-user-session-expensive')
                const dateNow = isFeatureFlagActive ? readDate : moment();

                //Calcular tempo total de carregamento
                const timeChargedinSeconds = Utils.getChargingTime(startDate, dateNow);

                //Obter energia total consumida ao payload do request
                let totalPowerConsumed_Kw = chargingSession.kwh >= 0 ? chargingSession.kwh : 0
                let totalPowerConsumed_W = 0;
                let instantPower = -1;
                let instantVoltage = -1;
                let instantAmperage = -1;
                let evBattery = -1;
                let CO2emitted = 0;

                if (payload.kwh >= 0) {
                    totalPowerConsumed_Kw = payload.kwh;
                    totalPowerConsumed_W = totalPowerConsumed_Kw * 1000;
                    CO2emitted = Number(process.env.CarbonIntensity) * totalPowerConsumed_Kw;// Kg CO₂ eq/kWh
                    if (CO2emitted < 0)
                        CO2emitted = 0
                }

                const readingPoints = [{
                    totalPower: totalPowerConsumed_W,
                    instantPower: instantPower,
                    instantVoltage: instantVoltage,
                    batteryCharged: evBattery,
                    instantAmperage: instantAmperage,
                    readDate: readDate,
                    communicationDate,
                }]

                //Calcular estimativa de custo
                let estimatedPrice_excl_Vat = -1;
                let estimatedPrice_incl_Vat = -1;
                let priceComponents = chargingSession?.tariffOPC?.elements || [];
                if (!priceComponents?.length) {
                    Sentry.captureMessage(`Inexisting price components for session ${chargingSession.id}`);
                }

                let offset = Utils.getChargerOffset(chargingSession.timeZone, chargingSession.country_code, null, null)

                priceComponents = priceComponents ? Utils.createTariffElementsAccordingToRestriction(priceComponents, startDate, dateNow.utc().format()) : priceComponents

                let [flat, energy, time, parking] = Utils.opcTariffsPrices(null, priceComponents, startDate, dateNow.utc().format(), offset, chargingSession.plugPower, chargingSession.plugVoltage, totalPowerConsumed_Kw, timeChargedinSeconds / 3600, 0, chargingSession.source)

                let [
                    OCP_PRICE_FLAT,
                    OCP_PRICE_ENERGY,
                    OCP_PRICE_TIME,
                    OCP_PRICE_PARKING_TIME
                ] = [flat.price, energy.price, time.price, parking.price]

                let OPC_Price = OCP_PRICE_FLAT + OCP_PRICE_ENERGY + OCP_PRICE_TIME + OCP_PRICE_PARKING_TIME

                let opc = { flat, energy, time, parking, price: OPC_Price }

                // ======================= CEME and TAR ======================= //

                //We get local iso dates because of TAR schedules
                let localSessionStartDate = moment.utc(startDate).add(offset, 'minutes').format()
                let localSessionStopDate = moment.utc(dateNow.utc().format()).add(offset, 'minutes').format()

                let { ceme, tar } = Utils.calculateCemeAndTar(chargingSession.schedulesCEME, chargingSession.tariffCEME, chargingSession.tariffTAR, timeChargedinSeconds / 3600, totalPowerConsumed_Kw, localSessionStartDate, localSessionStopDate, chargingSession.voltageLevel)

                // ======================= FEES ======================= //

                let iec = { price: chargingSession.fees.IEC * totalPowerConsumed_Kw }

                let opcPrice = Utils.round(opc.price)
                let cemePrice = Utils.round(ceme.price)
                let tarPrice = Utils.round(tar.price)
                let iecPrice = Utils.round(iec.price)

                //VAT
                const VAT_Price = await vatService.getVATwithViesVAT(chargingSession); //Iva

                //Final PRICES
                estimatedPrice_excl_Vat_without_FEES = opcPrice + cemePrice + tarPrice;
                estimatedPrice_excl_Vat = opcPrice + cemePrice + iecPrice + tarPrice;
                estimatedPrice_incl_Vat = estimatedPrice_excl_Vat + (VAT_Price * estimatedPrice_excl_Vat);

                console.log({ estimatedPrice_excl_Vat_without_FEES: estimatedPrice_excl_Vat_without_FEES, energy: totalPowerConsumed_Kw, time: (timeChargedinSeconds / 60), opc_price: opcPrice, ceme_price: cemePrice, iec_price: iecPrice, tar_price: tarPrice, tar_tariff: chargingSession.tariffTAR })

                const totalCost = { excl_vat: Utils.round(estimatedPrice_excl_Vat), incl_vat: Utils.round(estimatedPrice_incl_Vat) }

                let query = { _id: chargingSession._id, status: {$nin: [global.SessionStatusStopped, global.SessionStatusSuspended]} };
                const newValues = {
                    $set:
                    {
                        timeCharged: timeChargedinSeconds,
                        batteryCharged: evBattery,
                        kwh: totalPowerConsumed_Kw,
                        CO2Saved: CO2emitted,
                        total_cost: totalCost,
                        totalPower: totalPowerConsumed_W,
                        start_date_time: startDate
                    },
                    $push: {
                        readingPoints: readingPoints
                    }

                };

                console.log("[update Session OCPI] priceComponents ", priceComponents);
                const sessionTimeValid = await Utils.checkSessionTimeIsValidForNotification(timeChargedinSeconds, startDate, isFeatureFlagActive);
                Session.updateSession(query, newValues, async (err, result) => {
                    if (err) {
                        console.log(`[update Session OCPI] Error `, err);
                        resolve(err);
                    }
                    else {
                        if(result){
                            let notificationBody = {
                                totalPower: totalPowerConsumed_W,
                                estimatedPrice: totalCost.incl_vat,
                                timeCharged: timeChargedinSeconds,
                                batteryCharged: evBattery
                            }
                            const {isDevice = false, deviceType = '' } = Helpers.verifyIsDeviceRequest(result?.createdWay);

                            if (sendNotification && sessionTimeValid && !isDevice) {
                                UtilsFirebase.dataFirebaseNotification(result, notificationBody);
                                Utils.notificationManagement(result)
                                Utils.sendStartNotification(result)
                            }

                            let reason = null;
                            let paymentSubStatus = "Pre Authorization Captivated with success";

                            
                            // validation to check if we can create a pre-authorization, to prevent creating preAuthorization to sessions that already happen
                            if (isDevice || (isValidDateForPreAuthorization(startDate) && result.paymentMethod == Enums.PaymentsMethods.Card)) {
                                try {
                                    if(isDevice){
                                        console.log(`${context} is ${deviceType} session, updating pre-authorization ${deviceType} for sessionId: ${chargingSession.id}, userId: ${chargingSession.userId}`);
                                        const devicesPreAuthorization = new DevicesPreAuthorizationService(deviceType);
                                        const result = await devicesPreAuthorization.updatePreAuthorization(chargingSession, totalCost.incl_vat);
                                        if(!result){
                                            throw new Error('Failed to update pre-authorization APT');
                                        }
                                    }else{
                                        await Utils.MakeOrUpdatePreAuhtorization(chargingSession, totalCost.incl_vat, totalPowerConsumed_W);
                                    }
                                } catch (error) {
                                    const errorLogStage = isDevice ? `[${deviceType} updatePreAuthorization]` : 'MakeOrUpdatePreAuthorization';
                                    reason = 'SESSION STOP - MISSING PAYMENTS';
                                    paymentSubStatus = "PAYMENT FAILED FOR ANY REASON";
                                    console.log(`${context} errorMakeOrUpdatePreAuhtorization: ${error}`);
                                    saveSessionLogs({
                                        userId: chargingSession?.userId || '',
                                        hwId: chargingSession?.location_id || '',
                                        plugId: chargingSession?.connector_id || '',
                                        sessionId: chargingSession?._id || '',
                                        externalSessionId: chargingSession?.id || '',
                                        stage: errorLogStage,
                                        action: 'start',
                                        status: Enums.SessionFlowLogsStatus.ERROR,
                                        errorType: Enums.SessionFlowLogsErrorTypes.VALIDATION_ERROR,
                                        errorMessage: `ERROR SESSION PreAuthorization ${deviceType || ''} - MISSING PAYMENTS, Error: ${error?.message || ''}`
                                    })
                                    Utils.updateStopSessionMeterValues(chargingSession);
                                    const req = {
                                        headers:{ 'userid': chargingSession.userId },
                                        body: { sessionId: chargingSession.id }
                                    }
                                    await remoteStopSessionUtil(req, result.source).then(async result => {
                                        console.log(`${context} remoteStopSession: `, result);
                                        if(!isDevice){
                                            notifySessionStopedMissingPayment(chargingSession.userId, CodeTranslationsPushNotifications.NOTIFICATION_CHARGING_SESSION_STOP_MISSING_PAYMENT_WITHOUT_BALANCE)
                                            let messageHeader = 'SESSÃO STOP - PAGAMENTOS EM FALTA'
                                            let messageBody = 'A sua sessão de carregamento foi interrompida porque não conseguimos garantir a autorização necessária por valor insuficiente em cartão.';

                                            await Utils.sendNotificationToUser(chargingSession.userId, messageHeader, messageBody, chargingSession.clientName, 'CHARGING_SESSION_STOP_MISSING_PAYMENT')
                                        }
                                        
                                    }).catch((e) => {
                                        console.log(`${context} remoteStopSession ${deviceType || ''} session error: `, e, ' sessionId: ', chargingSession.id);
                                        e.sessionId = chargingSession.id;
                                        reason = 'ERROR SESSION STOP - MISSING PAYMENTS';
                                        Sentry.captureException(e);
                                    });
                                    Sentry.captureException(error);
                                } finally {
                                    if(!result.reservationPay){
                                        result.reservationPay = true;
                                        result.paymentSubStatus = paymentSubStatus;
                                        if(reason) result.reason = reason;
                                        await this.updateSession(result.id, result);
                                    }
                                }
                            }
                        }
                        resolve();
                    };
                });
            } catch (error) {
                Sentry.captureException(error);
                console.log(`[${context}] Error `, error);
                resolve()
            }
        });
    },
    MakeOrUpdatePreAuhtorization: function(chargingSession, totalCostInclVat, totalPowerConsumed_Kw){
        const context = "[Function] MakeOrUpdatePreAuhtorization"
        return new Promise(async (resolve, reject) => {
            try {
                console.log(`[${context}] chargingSession.reservationPay: ${chargingSession.reservationPay} ' ---- userId : ', ${chargingSession.userId}`);
                if( chargingSession.paymentMethod.toLowerCase().trim() != 'card'.toLocaleLowerCase().trim() || chargingSession.reservationPay) {
                    console.log(`${context} Not was possible to pre authorize card, userId: ${chargingSession.userId}`);
                    return resolve();
                }

                const chargerInfo = await findByChargerHWID(chargingSession.location_id);
                if(chargerInfo == undefined || Object.keys(chargerInfo).length === 0 ) {
                    console.log(`${context} Not was possible to pre authorize card`);
                    return resolve();
                }
                const info = {
                    userId: chargingSession.userIdWillPay ?? chargingSession.userId,
                    totalCostInclVat: totalCostInclVat,
                    reservedAmount: chargingSession.reservedAmount,
                    currency: chargingSession.currency,
                    sessionId: chargingSession.id,
                    hwId: chargingSession.location_id,
                    sessionIdInternal: chargingSession._id,
                    capture: true,
                    clientName: chargingSession.clientName,
                    chargerType: chargingSession.chargerType
                }
                const proxy = process.env.HostPaymentsV2 + process.env.PathPostPreAuthorization + 'user/' + chargingSession.userId + '/reservation';
                console.log(`[${context}] info: ${JSON.stringify(info)}, proxy: ${proxy}`);
                axios.post(proxy, info)
                    .then((result) => {
                        console.log(`[${context}] userId: ${chargingSession.userId} , result: `, result.data);
                        return resolve(result.data);
                    })
                    .catch((error) => {
                        console.error(`[${context}] userId: ${chargingSession.userId}  - Not was possible to pre authorize card. Error: `, error);
                        return reject(error);
                    });
            } catch (error) {
                console.error(`[${context}][500] Error `, error.message);
                return reject();
            }
        });
    },

    getChargingTime: function (startDate, stopDate) {
        const duration = moment.duration(stopDate.diff(startDate));
        const timeChargedinSeconds = duration.asSeconds();
        return timeChargedinSeconds;
    },
    calculatePrice: function (startDate, stopDate) {
        const price = -1;
        return price;
    },
    billing: function (cdr, userId, chargingSession, paymentId, invoiceLines, totalPrice) {
        return new Promise(async (resolve, reject) => {
            const body = await this.drawSingle_Ad_HocInvoice(cdr, userId, chargingSession, paymentId, invoiceLines, totalPrice);

            let host = global.billingEndpoint
            let headers = {
                'userid': userId
            }

            if (chargingSession.clientName !== process.env.evioClientName) {
                host = global.billingEndpointWL
                headers = {
                    ...headers,
                    'clientname': chargingSession.clientName,
                    'source':  chargingSession?.source?.toLowerCase() || cdr?.source?.toLowerCase(),
                    'ceme': "EVIO",
                }
            }

            axios.post(host, body, { headers }).then(function (response) {

                if (typeof response.data !== 'undefined') {
                    resolve(response.data);
                }
                else
                    reject(false);

            }).catch(function (error) {
                reject(error);
            });
        });
    },
    getInvoiceLines: function (cdr, userId, chargingSession) {
        return new Promise(async (resolve, reject) => {
            let invoiceLines = [];
            const cdr_end_date_time = new Date(cdr.end_date_time)
            const vat = chargingSession?.fees?.IVA ?? await vatService.getVATwithViesVAT(chargingSession);

            let {
                opcFlat,
                opcTime,
                opcPower,
                TAR_Price,
                CEME_Price,
                IEC_Price,
                mobiEGrant,
            } = Utils.calculateCdrTotalValues(cdr, chargingSession)
            const { isUserTariffOrDevice, flat, time, energy } = Utils.calculateUserOrDeviceCpoTariff(cdr, chargingSession)
            if (isUserTariffOrDevice) {
                opcFlat = flat
                opcTime = time
                opcPower = energy
                Utils.addUserTariffsInvoiceLines(invoiceLines, cdr, vat, flat, energy, time)
            }
            let OPC_Price = opcFlat + opcTime + opcPower
            const others = Utils.getOcpiActivationFee(cdr_end_date_time, chargingSession, OPC_Price, TAR_Price, CEME_Price, IEC_Price, mobiEGrant, vat, vat)

            let tariffCemePriceEmpty = Utils.getCemeUnitPrice(chargingSession.tariffCEME, process.env.TariffTypeEmpty, chargingSession.voltageLevel)
            let tariffCemePriceOutEmpty = Utils.getCemeUnitPrice(chargingSession.tariffCEME, process.env.TariffTypeOutEmpty, chargingSession.voltageLevel)
            // #DCL 06/07/2023 - quick fix on OCPI in pre
            if (typeof cdr.mobie_cdr_extension?.subUsages !== "undefined") {
                for (let subUsage of cdr.mobie_cdr_extension.subUsages) {

                    let equalLineIndex = 0;

                    if (chargingSession.voltageLevel == "BT" || chargingSession.voltageLevel == "BTN") {

                        //CEME
                        let line1_BT = {
                            "code": global.Item_Energy_OutEmpty_BT, "description": "Energia consumida Fora do Vazio BT", "unitPrice": tariffCemePriceOutEmpty, "uom": "KWh", "quantity": subUsage.energia_fora_vazio, "vat": vat, "discount": 0, "total": 0
                        }

                        let line2_BT = {
                            "code": global.Item_Energy_Empty_BT, "description": "Energia consumida Vazio BT", "unitPrice": tariffCemePriceEmpty, "uom": "KWh", "quantity": subUsage.energia_vazio, "vat": vat, "discount": 0, "total": 0
                        }

                        //TAR
                        let line3_TAR_BT = {
                            "code": global.Item_TAR_OutEmpty_BT, "description": "Tarifas Acesso às Redes Fora do Vazio BT", "unitPrice": subUsage.preco_unitario_com_desconto_acesso_redes_fora_vazio, "uom": "KWh", "quantity": subUsage.energia_fora_vazio, "vat": vat, "discount": 0, "total": 0
                        }

                        let line4_TAR_BT = {
                            "code": global.Item_TAR_Empty_BT, "description": "Tarifas Acesso às Redes Vazio BT", "unitPrice": subUsage.preco_unitario_com_desconto_acesso_redes_vazio, "uom": "KWh", "quantity": subUsage.energia_vazio, "vat": vat, "discount": 0, "total": 0
                        }

                        if(vat == 0) {
                            line1_BT_base.taxExemptionReasonCode = Constants.TAX_EXEMPTION_REASON_CODE_M40;
                            line2_BT.taxExemptionReasonCode = Constants.TAX_EXEMPTION_REASON_CODE_M40;
                            line3_TAR_BT.taxExemptionReasonCode = Constants.TAX_EXEMPTION_REASON_CODE_M40;
                            line4_TAR_BT.taxExemptionReasonCode = Constants.TAX_EXEMPTION_REASON_CODE_M40;
                        }

                        equalLineIndex = invoiceLines.findIndex(obj => obj.code == global.Item_Energy_OutEmpty_BT && obj.unitPrice == tariffCemePriceOutEmpty)
                        if (equalLineIndex > -1) {
                            invoiceLines[equalLineIndex].quantity += subUsage.energia_fora_vazio
                        } else {
                            invoiceLines.push(line1_BT);
                        }

                        equalLineIndex = invoiceLines.findIndex(obj => obj.code == global.Item_Energy_Empty_BT && obj.unitPrice == tariffCemePriceEmpty)
                        if (equalLineIndex > -1) {
                            invoiceLines[equalLineIndex].quantity += subUsage.energia_vazio
                        } else {
                            invoiceLines.push(line2_BT);
                        }


                        equalLineIndex = invoiceLines.findIndex(obj => obj.code == global.Item_TAR_OutEmpty_BT && obj.unitPrice == subUsage.preco_unitario_com_desconto_acesso_redes_fora_vazio)
                        if (equalLineIndex > -1) {
                            invoiceLines[equalLineIndex].quantity += subUsage.energia_fora_vazio
                        } else {
                            invoiceLines.push(line3_TAR_BT);
                        }

                        equalLineIndex = invoiceLines.findIndex(obj => obj.code == global.Item_TAR_Empty_BT && obj.unitPrice == subUsage.preco_unitario_com_desconto_acesso_redes_vazio)
                        if (equalLineIndex > -1) {
                            invoiceLines[equalLineIndex].quantity += subUsage.energia_vazio
                        } else {
                            invoiceLines.push(line4_TAR_BT);
                        }

                    }
                    else {
                        let line1_MT = {
                            "code": global.Item_Energy_OutEmpty_MT, "description": "Energia consumida Fora do Vazio MT", "unitPrice": tariffCemePriceOutEmpty, "uom": "KWh", "quantity": subUsage.energia_fora_vazio, "vat": vat, "discount": 0, "total": 0
                        }

                        let line2_MT = {
                            "code": global.Item_Energy_Empty_MT, "description": "Energia consumida Vazio MT", "unitPrice": tariffCemePriceEmpty, "uom": "KWh", "quantity": subUsage.energia_vazio, "vat": vat, "discount": 0, "total": 0
                        }

                        let line3_TAR_MT = {
                            "code": global.Item_TAR_OutEmpty_MT, "description": "Tarifas Acesso às Redes Fora do Vazio MT", "unitPrice": subUsage.preco_unitario_com_desconto_acesso_redes_fora_vazio, "uom": "KWh", "quantity": subUsage.energia_fora_vazio, "vat": vat, "discount": 0, "total": 0
                        }

                        let line4_TAR_MT = {
                            "code": global.Item_TAR_Empty_MT, "description": "Tarifas Acesso às Redes Vazio MT", "unitPrice": subUsage.preco_unitario_com_desconto_acesso_redes_vazio, "uom": "KWh", "quantity": subUsage.energia_vazio, "vat": vat, "discount": 0, "total": 0
                        }

                        if(vat == 0) {
                            line1_MT.taxExemptionReasonCode = Constants.TAX_EXEMPTION_REASON_CODE_M40;
                            line2_MT.taxExemptionReasonCode = Constants.TAX_EXEMPTION_REASON_CODE_M40;
                            line3_TAR_MT.taxExemptionReasonCode = Constants.TAX_EXEMPTION_REASON_CODE_M40;
                            line4_TAR_MT.taxExemptionReasonCode = Constants.TAX_EXEMPTION_REASON_CODE_M40;
                        }

                        equalLineIndex = invoiceLines.findIndex(obj => obj.code == global.Item_Energy_OutEmpty_MT && obj.unitPrice == tariffCemePriceOutEmpty)
                        if (equalLineIndex > -1) {
                            invoiceLines[equalLineIndex].quantity += subUsage.energia_fora_vazio
                        } else {
                            invoiceLines.push(line1_MT);
                        }

                        equalLineIndex = invoiceLines.findIndex(obj => obj.code == global.Item_Energy_Empty_MT && obj.unitPrice == tariffCemePriceEmpty)
                        if (equalLineIndex > -1) {
                            invoiceLines[equalLineIndex].quantity += subUsage.energia_vazio
                        } else {
                            invoiceLines.push(line2_MT);
                        }


                        equalLineIndex = invoiceLines.findIndex(obj => obj.code == global.Item_TAR_OutEmpty_MT && obj.unitPrice == subUsage.preco_unitario_com_desconto_acesso_redes_fora_vazio)
                        if (equalLineIndex > -1) {
                            invoiceLines[equalLineIndex].quantity += subUsage.energia_fora_vazio
                        } else {
                            invoiceLines.push(line3_TAR_MT);
                        }


                        equalLineIndex = invoiceLines.findIndex(obj => obj.code == global.Item_TAR_Empty_MT && obj.unitPrice == subUsage.preco_unitario_com_desconto_acesso_redes_vazio)
                        if (equalLineIndex > -1) {
                            invoiceLines[equalLineIndex].quantity += subUsage.energia_vazio
                        } else {
                            invoiceLines.push(line4_TAR_MT);
                        }

                    }

                    if (!isUserTariffOrDevice) {
                        let line4_OPC_FLAT = {
                            "code": global.Item_OPC_FLAT, "description": "Tarifas de ativação de utilização dos OPC", "unitPrice": subUsage.preco_unitario_opc_ativacao, "uom": "UN", "quantity": 1, "vat": vat, "discount": 0, "total": 0
                        }

                        let line5_OPC_ENERGY = {
                            "code": global.Item_OPC_KWH, "description": "Tarifas de utilização dos OPC por kWh", "unitPrice": subUsage.preco_unitario_opc_energia, "uom": "KWh", "quantity": subUsage.energia_total_periodo, "vat": vat, "discount": 0, "total": 0
                        }

                        let line6_OPC_TIME = {
                            "code": global.Item_OPC_TIME, "description": "Tarifas de utilização dos OPC por min", "unitPrice": subUsage.preco_unitario_opc_tempo, "uom": "min", "quantity": subUsage.periodDuration, "vat": vat, "discount": 0, "total": 0
                        }

                        if (vat == 0) {
                            line4_OPC_FLAT.taxExemptionReasonCode = Constants.TAX_EXEMPTION_REASON_CODE_M40;
                            line5_OPC_ENERGY.taxExemptionReasonCode = Constants.TAX_EXEMPTION_REASON_CODE_M40;
                            line6_OPC_TIME.taxExemptionReasonCode = Constants.TAX_EXEMPTION_REASON_CODE_M40;
                        }

                        equalLineIndex = invoiceLines.findIndex(obj => obj.code == global.Item_OPC_FLAT && obj.quantity == 1)
                        if (equalLineIndex > -1) {
                            invoiceLines[equalLineIndex].unitPrice += subUsage.preco_unitario_opc_ativacao
                        } else {
                            invoiceLines.push(line4_OPC_FLAT);
                        }



                        equalLineIndex = invoiceLines.findIndex(obj => obj.code == global.Item_OPC_KWH && obj.unitPrice == subUsage.preco_unitario_opc_energia)
                        if (equalLineIndex > -1) {
                            invoiceLines[equalLineIndex].quantity += subUsage.energia_total_periodo
                        } else {
                            invoiceLines.push(line5_OPC_ENERGY);
                        }



                        equalLineIndex = invoiceLines.findIndex(obj => obj.code == global.Item_OPC_TIME && obj.unitPrice == subUsage.preco_unitario_opc_tempo)
                        if (equalLineIndex > -1) {
                            invoiceLines[equalLineIndex].quantity += subUsage.periodDuration
                        } else {
                            invoiceLines.push(line6_OPC_TIME);
                        }   
                    }
                }
            }

            let line7_IEC = {
                "code": global.Item_IEC, "description": "IEC – Imposto Especial sobre o Consumo", "unitPrice": chargingSession.fees.IEC, "uom": "kWh", "quantity": cdr.total_energy, "vat": vat, "discount": 0, "total": 0
            }

            let line8_OTHERS = {
                "code": global.Item_OTHERS, "description": "Tarifa de serviço EVIO", "unitPrice": others, "uom": "UN", "quantity": 1, "vat": vat, "discount": 0, "total": 0
            }

            if (vat == 0) {
                line7_IEC.taxExemptionReasonCode = Constants.TAX_EXEMPTION_REASON_CODE_M40;
                line8_OTHERS.taxExemptionReasonCode = Constants.TAX_EXEMPTION_REASON_CODE_M40;
            }

            if (cdr?.total_energy > 0) {
                invoiceLines.push(line7_IEC);
            }
            invoiceLines.push(line8_OTHERS); 

            const line9_MOBIE_Grant = {
                "code": global.Item_Public_Grant, "description": "Apoio Público à Mobilidade Elétrica", "unitPrice": mobiEGrant, "uom": "UN", "quantity": 1, "vat": vat, "discount": 0, "total": 0, "taxExemptionReasonCode": process.env.TaxExemptionM01
            }

            if (cdr_end_date_time.getFullYear() > 2021) {
                invoiceLines.push(line9_MOBIE_Grant);
            }

            let hasNetativeQuantity = false;
            const normalizedInvoiceLines = invoiceLines.filter(line=>{
                if (!line.quantity || line.quantity<=0) {
                    if(line.quantity<0){
                        hasNetativeQuantity = true
                    }
                    return false
                }
                return true;
            });

            if (hasNetativeQuantity) {
                Sentry.captureMessage(`Invoice line with negativa value. Debug Data: ${JSON.stringify({subUsages: cdr.mobie_cdr_extension.subUsages, invoiceLines})}`);
            }

            resolve(normalizedInvoiceLines);
        });
    },
    getAttachLines: function (chargingSessions) {
        return new Promise(async (resolve, reject) => {
        });
    },
    drawSingle_Ad_HocInvoice: function (cdr, userId, chargingSession, paymentId, invoiceLines, totalPrice) {
        return new Promise(async (resolve, reject) => {
            const footer = {
                total_exc_vat: totalPrice.excl_vat,
                total_inc_vat: totalPrice.incl_vat
            }

            const cdr_end_date_time = new Date(cdr.end_date_time)
            let others = 0;
            const VAT_Price = chargingSession?.fees?.IVA ?? await vatService.getVATwithViesVAT(chargingSession);

            let {
                opcFlat,
                opcTime,
                opcPower,
                TAR_Price,
                CEME_Price,
                IEC_Price,
                mobiEGrant,
            } = Utils.calculateCdrTotalValues(cdr, chargingSession)
            const { isUserTariffOrDevice, flat, time, energy } = Utils.calculateUserOrDeviceCpoTariff(cdr, chargingSession)
            if (isUserTariffOrDevice) {
                opcFlat = flat
                opcTime = time
                opcPower = energy
            }

            let OPC_Price = opcFlat + opcTime + opcPower
            const activationFee = Utils.getOcpiActivationFee(cdr_end_date_time, chargingSession, OPC_Price, TAR_Price, CEME_Price, IEC_Price, mobiEGrant, VAT_Price, VAT_Price)

            let energyConsumedEmpty = cdr?.mobie_cdr_extension?.subUsages?.map(obj => obj.energia_vazio)?.reduce((a, b) => a + b, 0) ?? 0
            let energyConsumedOutEmpty = cdr?.mobie_cdr_extension?.subUsages?.map(obj => obj.energia_fora_vazio)?.reduce((a, b) => a + b, 0) ?? 0
            let unitPriceTarEmpty = cdr?.mobie_cdr_extension?.subUsages[0]?.preco_unitario_com_desconto_acesso_redes_vazio ?? 0
            let unitPriceTarOutEmpty = cdr?.mobie_cdr_extension?.subUsages[0]?.preco_unitario_com_desconto_acesso_redes_fora_vazio ?? 0

            //CEME
            let unitPriceCEMEEmptyBT = Utils.getCemeUnitPrice(chargingSession.tariffCEME, process.env.TariffTypeEmpty, process.env.voltageLevelBT)
            let unitPriceCEMEEmptyMT = Utils.getCemeUnitPrice(chargingSession.tariffCEME, process.env.TariffTypeEmpty, process.env.voltageLevelMT)
            let unitPriceCEMEOutEmptyBT = Utils.getCemeUnitPrice(chargingSession.tariffCEME, process.env.TariffTypeOutEmpty, process.env.voltageLevelBT)
            let unitPriceCEMEOutEmptyMT = Utils.getCemeUnitPrice(chargingSession.tariffCEME, process.env.TariffTypeOutEmpty, process.env.voltageLevelMT)

            let unitActivationFee = null
            if (chargingSession.tariffCEME)
                if (chargingSession.tariffCEME.activationFee)
                    if (chargingSession.tariffCEME.activationFee.value)
                        unitActivationFee = chargingSession.tariffCEME.activationFee.value
            let unitActivationFeeAdHoc = null
            if (chargingSession.tariffCEME)
                if (chargingSession.tariffCEME.activationFeeAdHoc)
                    if (chargingSession.tariffCEME.activationFeeAdHoc.value)
                        unitActivationFeeAdHoc = chargingSession.tariffCEME.activationFeeAdHoc.value


            let unitPriceOPCTimeSum = cdr?.mobie_cdr_extension?.subUsages?.map(obj => obj.preco_unitario_opc_tempo)?.reduce((a, b) => a + b, 0) ?? 0
            let unitPriceOPCTime = unitPriceOPCTimeSum > 0 ? (unitPriceOPCTimeSum / cdr?.mobie_cdr_extension?.subUsages?.map(obj => obj.preco_unitario_opc_tempo)?.length) : 0
            let unitPriceOPCEnergySum = cdr?.mobie_cdr_extension?.subUsages?.map(obj => obj.preco_unitario_opc_energia)?.reduce((a, b) => a + b, 0) ?? 0
            let unitPriceOPCEnergy = unitPriceOPCEnergySum > 0 ? (unitPriceOPCEnergySum / cdr.mobie_cdr_extension.subUsages.map(obj => obj.preco_unitario_opc_energia)?.length) : 0


            others += activationFee;

            if(chargingSession.local_start_date_time) {
                chargingSession.start_date_time = new Date(chargingSession.local_start_date_time).toISOString();
            }
            else {
            chargingSession.start_date_time = new Date(chargingSession.start_date_time).toISOString();
            }

            if(chargingSession.local_end_date_time) {
                chargingSession.end_date_time = new Date(chargingSession.local_end_date_time).toISOString();
            }

            let iecPrice_excl_vat;

            if (chargingSession.finalPrices && chargingSession.finalPrices.iecPrice) {
                iecPrice_excl_vat = chargingSession.finalPrices.iecPrice.excl_vat;
            } else {
                iecPrice_excl_vat = 0;
            };

            let evDetails = chargingSession.evDetails ?? (chargingSession.evId !== null && chargingSession.evId !== undefined && chargingSession.evId !== "-1" ? await this.getEvDetails(chargingSession.evId) : null)
            let licensePlate = evDetails?.licensePlate ?? null
            let groupDrivers = evDetails ? evDetails?.listOfGroupDrivers?.find(group => group?.listOfDrivers?.find(driver => driver._id === chargingSession.userId)) : null
            let fleet = chargingSession.fleetDetails ?? (evDetails && evDetails.fleet !== null && evDetails.fleet !== undefined && evDetails.fleet !== "-1" ? await this.getFleetDetails(evDetails.fleet) : null)

            let userInfo = chargingSession.userIdInfo ?? await this.getUserInfo(chargingSession.userId)
            let userWillPayInfo = chargingSession.userIdWillPayInfo ?? (chargingSession.userIdWillPay !== chargingSession.userId ? await this.getUserInfo(chargingSession.userIdWillPay) : userInfo)

            let averagePower = chargingSession.kwh > 0 && chargingSession.timeCharged > 0 ? chargingSession.kwh / (chargingSession.timeCharged / 3600) : 0
            let realTimeCharging = chargingSession.timeCharged / 60

            if (chargingSession.endOfEnergyDate !== null && chargingSession.endOfEnergyDate !== undefined) {
                realTimeCharging = moment.duration(moment.utc(chargingSession.endOfEnergyDate).diff(chargingSession.start_date_time)).asMinutes()
            }

            let {
                unitPriceTAREmptyBT,
                unitPriceTAREmptyMT,
                unitPriceTAROutEmptyBT,
                unitPriceTAROutEmptyMT,
            } = Utils.getTarUnitPrices(chargingSession.tariffTAR)

            const attachLine = {
                "date": moment(chargingSession.start_date_time ? chargingSession.start_date_time : cdr.start_date_time).format("DD/MM/YYYY"),
                "startTime": moment(chargingSession.start_date_time ? chargingSession.start_date_time : cdr.start_date_time).format("HH:mm"),
                "duration": formatDuration(chargingSession.timeCharged),
                "city": chargingSession.address.city,
                "network": chargingSession.source || cdr.source,
                "hwId": chargingSession.location_id,
                "totalPower": chargingSession.kwh,
                "energyConsumedEmpty": energyConsumedEmpty,
                "energyConsumedOutEmpty": energyConsumedOutEmpty,
                "energyCost": chargingSession.finalPrices.cemePriceDetail.powerPrice.excl_vat,
                "tar": chargingSession.finalPrices.tarPrice.excl_vat,
                "mobiEGrant": mobiEGrant,//TODO
                "activationFee": this.round(activationFee, 4),
                "opcTimeCost": chargingSession.finalPrices.opcPriceDetail.timePrice.excl_vat,
                "unitPriceOPCTime": this.round(unitPriceOPCTime, 3),
                "opcEnergyCost": chargingSession.finalPrices.opcPriceDetail.powerPrice.excl_vat,
                "unitPriceOPCEnergy": this.round(unitPriceOPCEnergy, 3),
                "opcFlatCost": chargingSession.finalPrices.opcPriceDetail.flatPrice.excl_vat,
                "unitPriceOPCFlat": chargingSession.finalPrices.opcPriceDetail.flatPrice.excl_vat,
                "iec": iecPrice_excl_vat,
                "unitPriceIEC": chargingSession.fees.IEC,
                "total_exc_vat": totalPrice.excl_vat,
                "vat": chargingSession.fees.IVA * 100,
                "total_inc_vat": totalPrice.incl_vat,
                // "startDateTime": moment(chargingSession.start_date_time).format("DD/MM/YYYY HH:mm:ss"),
                "startDateTime": chargingSession.start_date_time,
                // "endDateTime": moment(chargingSession.end_date_time).format("DD/MM/YYYY HH:mm:ss"),
                "endDateTime": chargingSession.end_date_time,
                "durationMin": this.round(chargingSession.timeCharged / 60),
                "realTimeCharging": this.round(realTimeCharging),
                "averagePower": this.round(averagePower),
                "CO2emitted": chargingSession.CO2Saved,
                "fleetName": fleet?.name ?? "-",
                "licensePlate": licensePlate ?? "-",
                "groupName": groupDrivers?.name ?? "-",
                "userIdName": userInfo?.name ?? "-",
                "userIdWillPayName": userWillPayInfo?.name ?? "-",
                "voltageLevel": chargingSession.voltageLevel,
                "unitPriceCEMEEmptyBT": unitPriceCEMEEmptyBT,
                "unitPriceCEMEEmptyMT": unitPriceCEMEEmptyMT,
                "unitPriceCEMEOutEmptyBT": unitPriceCEMEOutEmptyBT,
                "unitPriceCEMEOutEmptyMT": unitPriceCEMEOutEmptyMT,
                "unitPriceTAREmptyBT": unitPriceTAREmptyBT,
                "unitPriceTAREmptyMT": unitPriceTAREmptyMT,
                "unitPriceTAROutEmptyBT": unitPriceTAROutEmptyBT,
                "unitPriceTAROutEmptyMT": unitPriceTAROutEmptyMT,
                "cemeTotalPrice": chargingSession.finalPrices.cemePrice.excl_vat,
                "opcTotalPrice": chargingSession.finalPrices.opcPrice.excl_vat,
                "partyId": chargingSession.party_id
            }

            const body = {
                optionalCountryCodeToVAT: chargingSession.fees?.countryCode ?? chargingSession.country_code,
                invoice: {
                    paymentId: paymentId,
                    header: {
                        userId: userId
                    },
                    lines: invoiceLines
                },
                attach: {
                    overview: {
                        footer: footer,
                        lines:
                        {
                            // evio_services: { total_exc_vat: others, vat: this.round(VAT_Price * others) },
                            evio_services: { total_exc_vat: 0, vat: 0 },
                            evio_network: { total_exc_vat: 0, vat: 0 },
                            // mobie_network: { total_exc_vat: this.round(totalPrice.excl_vat - others), vat: this.round(VAT_Price * (totalPrice.excl_vat - others)) },
                            mobie_network: { total_exc_vat: this.round(totalPrice.excl_vat), vat: this.round((totalPrice.incl_vat - totalPrice.excl_vat)) },
                            other_networks: { total_exc_vat: 0, vat: 0 },
                            hyundai_network: { total_exc_vat: 0, vat: 0 },
                            goCharge_network: { total_exc_vat: 0, vat: 0 },
                            klc_network: { total_exc_vat: 0, vat: 0 },
                            kinto_network: { total_exc_vat: 0, vat: 0 },
                        }

                    },
                    chargingSessions: {
                        header: {
                            sessions: 1,
                            totalTime: formatDuration(chargingSession.timeCharged),
                            totalEnergy: chargingSession.kwh + " KWh"
                        },
                        lines: [
                            attachLine
                        ],
                        summaryAddress: [
                            {
                                hwId: chargingSession.location_id,
                                city: chargingSession.address.city,
                                voltageLevel: chargingSession.voltageLevel,
                            }
                        ],
                        summaryOperator: [
                            {
                                partyId: chargingSession.party_id,
                                operatorName: `${chargingSession.cpoCountryCode}*${chargingSession.party_id}`
                            }
                        ],
                        unitPricesSummary: {
                            unitPriceCEMEEmptyBT: unitPriceCEMEEmptyBT,
                            unitPriceCEMEEmptyMT: unitPriceCEMEEmptyMT,
                            unitPriceCEMEOutEmptyBT: unitPriceCEMEOutEmptyBT,
                            unitPriceCEMEOutEmptyMT: unitPriceCEMEOutEmptyMT,
                            //FIXME For now, we need to hardcode these TAR values
                            unitPriceTAREmptyBT: unitPriceTAREmptyBT,
                            unitPriceTAREmptyMT: unitPriceTAREmptyMT,
                            unitPriceTAROutEmptyBT: unitPriceTAROutEmptyBT,
                            unitPriceTAROutEmptyMT: unitPriceTAROutEmptyMT,

                            mobiEGrant: mobiEGrant,
                            activationFeeAdHoc: unitActivationFeeAdHoc,
                            activationFee: unitActivationFee
                        },
                        footer: footer
                    }
                }
            }
            console.log(JSON.stringify(body))
            resolve(body);
        });
    },
    updateStopSessionMeterValues: function (chargingSession) {
        const context = "Function updateStopSessionMeterValues"
        return new Promise(async (resolve, reject) => {
            try {
                //Obter inicio de sessão de carregamento à sessão de carregamento
                const startDate = chargingSession.start_date_time ? chargingSession.start_date_time : new Date().toISOString();
                const end_date_time = chargingSession.end_date_time ? chargingSession.end_date_time : new Date().toISOString();
                const endDate_moment = moment(end_date_time).utc();

                //VAT
                const VAT_Price = chargingSession?.fees?.IVA ?? await vatService.getVATwithViesVAT(chargingSession); //Iva

                //Calcular tempo total de carregamento
                const timeChargedinSeconds = Utils.getChargingTime(startDate, endDate_moment);

                //Obter energia total consumida ao payload do request
                let totalPowerConsumed_Kw = chargingSession.kwh >= 0 ? chargingSession.kwh : 0
                let totalPowerConsumed_W = 0;
                let instantPower = -1;
                let instantVoltage = -1;
                let instantAmperage = -1;
                let evBattery = -1;
                let CO2emitted = 0;

                if (chargingSession.kwh >= 0) {
                    totalPowerConsumed_Kw = chargingSession.kwh;
                    totalPowerConsumed_W = totalPowerConsumed_Kw * 1000;
                    CO2emitted = Number(process.env.CarbonIntensity) * totalPowerConsumed_Kw;// Kg CO₂ eq/kWh
                    if (CO2emitted < 0)
                        CO2emitted = 0
                }

                const readingPoints = [{
                    totalPower: totalPowerConsumed_W,
                    instantPower: instantPower,
                    instantVoltage: instantVoltage,
                    batteryCharged: evBattery,
                    instantAmperage: instantAmperage
                }]

                //Calcular estimativa de custo
                let estimatedPrice_excl_Vat = -1;
                let estimatedPrice_incl_Vat = -1;
                let priceComponents = chargingSession?.tariffOPC?.elements || [];
                if (!priceComponents?.length) {
                    Sentry.captureMessage(`Inexisting price components for session ${chargingSession.id}`);
                }

                let offset = Utils.getChargerOffset(chargingSession.timeZone, chargingSession.country_code, null, null)

                priceComponents = priceComponents ? Utils.createTariffElementsAccordingToRestriction(priceComponents, startDate, end_date_time) : priceComponents

                let [flat, energy, time, parking] = Utils.opcTariffsPrices(null, priceComponents, startDate, end_date_time, offset, chargingSession.plugPower, chargingSession.plugVoltage, totalPowerConsumed_Kw, timeChargedinSeconds / 3600, 0, chargingSession.source)

                let [
                    OCP_PRICE_FLAT,
                    OCP_PRICE_ENERGY,
                    OCP_PRICE_TIME,
                    OCP_PRICE_PARKING_TIME
                ] = [flat.price, energy.price, time.price, parking.price]

                let OPC_Price = OCP_PRICE_FLAT + OCP_PRICE_ENERGY + OCP_PRICE_TIME + OCP_PRICE_PARKING_TIME

                let opc = { flat, energy, time, parking, price: OPC_Price }

                // ======================= CEME and TAR ======================= //

                //We get local iso dates because of TAR schedules
                let localSessionStartDate = moment.utc(startDate).add(offset, 'minutes').format()
                let localSessionStopDate = moment.utc(end_date_time).add(offset, 'minutes').format()

                let { ceme, tar } = Utils.calculateCemeAndTar(chargingSession.schedulesCEME, chargingSession.tariffCEME, chargingSession.tariffTAR, timeChargedinSeconds / 3600, totalPowerConsumed_Kw, localSessionStartDate, localSessionStopDate, chargingSession.voltageLevel)

                // ======================= FEES ======================= //

                let iec = { price: chargingSession.fees.IEC * totalPowerConsumed_Kw }

                let opcPrice = { excl_vat: this.round(opc.price), incl_vat: this.round(opc.price + (VAT_Price * opc.price)) }

                let opcPriceDetail = {
                    flatPrice: { excl_vat: this.round(opc.flat.price), incl_vat: this.round(opc.flat.price + (opc.flat.price * VAT_Price)) },
                    timePrice: { excl_vat: this.round(opc.time.price), incl_vat: this.round(opc.time.price + (opc.time.price * VAT_Price)) },
                    powerPrice: { excl_vat: this.round(opc.energy.price), incl_vat: this.round(opc.energy.price + (opc.energy.price * VAT_Price)) }
                }

                let dateNow = new Date();
                let mobiEGrant
                if (dateNow < new Date("2024-01-01T00:00:00.000Z"))
                mobiEGrant = Number(process.env.MobiE_Grant)
                else if(dateNow < new Date("2025-01-01T00:00:00.000Z"))
                    mobiEGrant = Number(process.env.MobiE_GrantNew)
                else mobiEGrant = 0

                let Ad_Hoc_activationFee = Utils.getOcpiActivationFee(new Date(end_date_time), chargingSession, opc.price, tar.price, ceme.price, iec.price, mobiEGrant, VAT_Price, VAT_Price)

                let otherPrices = [
                    { description: `Activation Fee ${Ad_Hoc_activationFee}`, price: { excl_vat: Ad_Hoc_activationFee, incl_vat: this.round(Ad_Hoc_activationFee + (VAT_Price * Ad_Hoc_activationFee)) } },
                    { description: `MobiE Grant ${mobiEGrant}`, price: { excl_vat: mobiEGrant, incl_vat: this.round(mobiEGrant + (VAT_Price * mobiEGrant)) } },
                ]

                let CEME_Price_TOTAL = ceme.price + Ad_Hoc_activationFee + mobiEGrant;
                let CEME_Price_Flat = ceme.flat.price + Ad_Hoc_activationFee + mobiEGrant
                let CEME_PRICE_inc_vat = CEME_Price_TOTAL + (VAT_Price * CEME_Price_TOTAL);

                let cemePrice = { excl_vat: this.round(CEME_Price_TOTAL), incl_vat: this.round(CEME_PRICE_inc_vat) }
                let cemePriceDetail = {
                    flatPrice: { excl_vat: this.round(CEME_Price_Flat), incl_vat: this.round(CEME_Price_Flat + (CEME_Price_Flat * VAT_Price)) },
                    timePrice: { excl_vat: this.round(ceme.time.price), incl_vat: this.round(ceme.time.price) },
                    powerPrice: { excl_vat: this.round(ceme.energy.price), incl_vat: this.round(ceme.energy.price + (ceme.energy.price * VAT_Price)) }
                }

                let tarPrice = { excl_vat: this.round(tar.price), incl_vat: this.round(tar.price + (VAT_Price * tar.price)) }

                let iecPrice = { excl_vat: this.round(iec.price), incl_vat: this.round(iec.price + (VAT_Price * iec.price)) }

                estimatedPrice_excl_Vat = opcPrice.excl_vat + cemePrice.excl_vat + tarPrice.excl_vat + iecPrice.excl_vat;
                estimatedPrice_incl_Vat = opcPrice.incl_vat + cemePrice.incl_vat + tarPrice.incl_vat + iecPrice.incl_vat;

                const totalCost = { excl_vat: this.round(estimatedPrice_excl_Vat), incl_vat: this.round(estimatedPrice_incl_Vat) }

                const vatPrice = { vat: this.round(VAT_Price), value: this.round((estimatedPrice_incl_Vat - estimatedPrice_excl_Vat)) }
                const finalPrices = {
                    opcPrice: opcPrice,
                    opcPriceDetail: opcPriceDetail,
                    cemePrice: cemePrice,
                    cemePriceDetail: cemePriceDetail,
                    tarPrice: tarPrice,
                    iecPrice: iecPrice,
                    vatPrice: vatPrice,
                    othersPrice: otherPrices,
                    totalPrice: totalCost
                }

                let query = { _id: chargingSession._id, cdrId: {$eq : "-1"} };
                const newValues = {
                    $set:
                    {
                        timeCharged: timeChargedinSeconds,
                        batteryCharged: evBattery,
                        kwh: totalPowerConsumed_Kw,
                        CO2Saved: CO2emitted,
                        total_cost: totalCost,
                        totalPower: totalPowerConsumed_W,
                        finalPrices: finalPrices,
                        end_date_time: end_date_time
                    },
                    $push: {
                        readingPoints: readingPoints
                    }

                };

                console.log("Update stop session: ", finalPrices);

                Session.updateSession(query, newValues, async (err, result) => {
                    if (err) {
                        console.log(`[update Session OCPI] Error `, err);
                        resolve(err);
                    }
                    else {
                        if (result) {
                            sendSessionToHistoryQueue(chargingSession?._id, context)
                            const sessionTimeValid = await Utils.checkSessionTimeIsValidForNotification(timeChargedinSeconds, startDate);
                            const {isDevice = false } = Helpers.verifyIsDeviceRequest(result?.createdWay);
                            if(sessionTimeValid && !isDevice){
                                Utils.sendStopNotification(result)
                            }
                        }
                        resolve();
                    };
                });
            } catch (error) {
                console.log(`[${context}] Error `, error);
                resolve()
            }

        });
    },
     processBillingAndPayment: function (sessionId, cdr) {
        const context = 'Utils processBillingAndPayment'
        let query = { id: sessionId };
        console.log("sessionId", sessionId);

        const totalPowerConsumed_Kw = cdr.total_energy;

        this.chargingSessionFindOne(query).then(async (chargingSession) => {
            if (chargingSession) {
                const {isDevice = false, deviceType = '' } = Helpers.verifyIsDeviceRequest(chargingSession?.createdWay);
                try {
                    if(chargingSession.paymentMethod == process.env.PaymentMethodUnknown || chargingSession.paymentMethod == process.env.PaymentMethodUnknownPayments) {
                        await Utils.forceValidatePayment(chargingSession);
                        chargingSession = await this.chargingSessionFindOne(query);
                    }

                    let minimumBillingConditions = this.hasMinimumBillingConditionsMobiE(cdr)

                    const VAT_Price = chargingSession?.fees?.IVA ?? await vatService.getVATwithViesVAT(chargingSession); //Iva

                    ////////////////////////////////////////////////
                    //OPC Cost
                    let {
                        opcFlat,
                        opcTime,
                        opcPower,
                        TAR_Price,
                        CEME_Price,
                        IEC_Price,
                        mobiEGrant,
                    } = Utils.calculateCdrTotalValues(cdr, chargingSession)

                    const { isUserTariffOrDevice, flat, time, energy } = Utils.calculateUserOrDeviceCpoTariff(cdr, chargingSession)
                    if (isUserTariffOrDevice) {
                        opcFlat = flat
                        opcTime = time
                        opcPower = energy
                    }
                    const OPC_Price = opcFlat + opcTime + opcPower
                    const opcPrice = { excl_vat: this.round(OPC_Price), incl_vat: this.round(OPC_Price + (VAT_Price * OPC_Price)) }


                    const opcPriceDetail = {
                        flatPrice: { excl_vat: this.round(opcFlat), incl_vat: this.round(opcFlat + (opcFlat * VAT_Price)) },
                        timePrice: { excl_vat: this.round(opcTime), incl_vat: this.round(opcTime + (opcTime * VAT_Price)) },
                        powerPrice: { excl_vat: this.round(opcPower), incl_vat: this.round(opcPower + (opcPower * VAT_Price)) }
                    }

                    const timeChargedinSeconds = Utils.getChargingTime(moment(cdr.start_date_time), moment(cdr.end_date_time));
                    chargingSession.timeCharged = timeChargedinSeconds;

                    const cdr_end_date_time = new Date(cdr.end_date_time)
                    const Ad_Hoc_activationFee = Utils.getOcpiActivationFee(cdr_end_date_time, chargingSession, OPC_Price, TAR_Price, CEME_Price, IEC_Price, mobiEGrant, VAT_Price, VAT_Price)

                    const otherPrices = [
                        { description: `Activation Fee ${Ad_Hoc_activationFee}`, price: { excl_vat: Ad_Hoc_activationFee, incl_vat: this.round(Ad_Hoc_activationFee + (VAT_Price * Ad_Hoc_activationFee)) } },
                        { description: `MobiE Grant ${mobiEGrant}`, price: { excl_vat: mobiEGrant, incl_vat: this.round(mobiEGrant + (VAT_Price * mobiEGrant)) } },
                    ]


                    ////////////////////////////////////////////////
                    //CEME Price
                    let CEME_Price_total = CEME_Price + Ad_Hoc_activationFee + mobiEGrant
                    let CEME_Price_Flat = Ad_Hoc_activationFee + mobiEGrant
                    const cemePrice = { excl_vat: this.round(CEME_Price_total), incl_vat: this.round(CEME_Price_total + (VAT_Price * CEME_Price_total)) }

                    const cemePriceDetail = {
                        flatPrice: { excl_vat: this.round(CEME_Price_Flat), incl_vat: this.round(CEME_Price_Flat + (CEME_Price_Flat * VAT_Price)) },
                        timePrice: { excl_vat: 0, incl_vat: 0 },
                        powerPrice: { excl_vat: this.round(CEME_Price), incl_vat: this.round(CEME_Price + (CEME_Price * VAT_Price)) }
                    }

                    ////////////////////////////////////////////////
                    //TAR Price
                    // var TAR_Price = cdr.mobie_cdr_extension.subUsages.map(obj => obj.preco_com_desconto_acesso_redes).reduce((a, b) => a + b, 0);
                    const tarPrice = { excl_vat: this.round(TAR_Price), incl_vat: this.round(TAR_Price + (VAT_Price * TAR_Price)) }

                    ////////////////////////////////////////////////
                    //IEC Price
                    // var IEC_Price = totalPowerConsumed_Kw * chargingSession.fees.IEC;
                    const iecPrice = { excl_vat: this.round(IEC_Price), incl_vat: this.round(IEC_Price + (VAT_Price * IEC_Price)) }


                    const invoiceLines = await Utils.getInvoiceLines(cdr, chargingSession.userIdWillPay, chargingSession);
                    let total_exc_vat = 0;
                    let total_inc_vat = 0;
                    invoiceLines.forEach(line => {
                        // total_exc_vat += this.round(line.quantity * line.unitPrice);
                        total_exc_vat += line.quantity * line.unitPrice;
                        // total_inc_vat += line.quantity * line.unitPrice * (1 + line.vat);
                    });
                    const roundedExclVat = this.round(total_exc_vat);
                    const roundedIncVat = this.round(roundedExclVat * (1 + VAT_Price));
                    // total_inc_vat = total_exc_vat + (total_exc_vat * VAT_Price);
                    const totalPrice = { excl_vat: roundedExclVat, incl_vat: roundedIncVat };

                    if (totalPrice?.incl_vat < 0) {
                        minimumBillingConditions = false
                    }

                    const vatPrice = { vat: VAT_Price, value: this.round(roundedIncVat - roundedExclVat) }

                    const finalPrices = {
                        opcPrice: opcPrice,
                        opcPriceDetail: opcPriceDetail,
                        cemePrice: cemePrice,
                        cemePriceDetail: cemePriceDetail,
                        tarPrice: tarPrice,
                        iecPrice: iecPrice,
                        vatPrice: vatPrice,
                        othersPrice: otherPrices,
                        totalPrice: totalPrice
                    }

                    chargingSession.total_cost = totalPrice;
                    chargingSession.finalPrices = finalPrices;
                    chargingSession.invoiceLines = invoiceLines;
                    console.log("finalPrices", JSON.stringify(finalPrices));

                    let CO2emitted = 0;

                    let totalPowerConsumed_W = 0;
                    if (totalPowerConsumed_Kw >= 0) {
                        totalPowerConsumed_W = totalPowerConsumed_Kw * 1000;
                        CO2emitted = this.round(Number(process.env.CarbonIntensity) * totalPowerConsumed_Kw);// Kg CO₂ eq/kWh
                        if (CO2emitted < 0)
                            CO2emitted = 0
                    }

                    // chargingSession.timeCharged = timeChargedinSeconds;
                    chargingSession.kwh = totalPowerConsumed_Kw

                    const bodySession = {
                        timeCharged: timeChargedinSeconds,
                        totalPower: totalPowerConsumed_W,
                        kwh: totalPowerConsumed_Kw,
                        CO2Saved: CO2emitted,
                        cdrId: cdr.id,
                        start_date_time: cdr.start_date_time,
                        end_date_time: cdr.end_date_time,
                        total_energy: cdr.total_energy,
                        total_cost: totalPrice,
                        finalPrices: finalPrices,
                        invoiceLines: invoiceLines,
                        paymentStatus: 'UNPAID',
                        discount: Utils.getMobiEDiscount(cdr),
                    };

                    const cdrValidationResult = await this.checkToApplyValidationCDR(cdr, bodySession, true)

                    bodySession.status = cdrValidationResult.status;
                    bodySession.suspensionReason = cdrValidationResult.reason;

                    if(chargingSession.start_date_time && chargingSession.timeZone) {
                        bodySession.local_start_date_time = moment(chargingSession.start_date_time).tz(chargingSession.timeZone).format("YYYY-MM-DDTHH:mm:ss");
                        chargingSession.local_start_date_time = bodySession.local_start_date_time
                    }

                    if(chargingSession.end_date_time && chargingSession.timeZone) {
                        bodySession.local_end_date_time = moment(chargingSession.end_date_time).tz(chargingSession.timeZone).format("YYYY-MM-DDTHH:mm:ss");
                        chargingSession.local_end_date_time = bodySession.local_end_date_time
                    }
                    bodySession.minimumBillingConditions = minimumBillingConditions

                    this.updateSession(sessionId, bodySession);

                    if ((cdrValidationResult.valid && chargingSession.paymentType == "AD_HOC" && chargingSession.paymentMethod != process.env.PaymentMethodTypeTransfer)
                         || (!cdrValidationResult.valid && chargingSession.paymentMethod == process.env.PaymentMethodCard && chargingSession.status == Enums.OcpiSessionStatus.SessionStatusInvalidSystem )) {
                        //Billing

                        //Call Payments Microservice
                        const bodyPayment = {
                            amount: { currency: cdr.currency, value: minimumBillingConditions ? (totalPrice?.incl_vat >= 0 ? totalPrice.incl_vat : 0) : 0 },
                            userId: chargingSession.userIdWillPay,
                            sessionId: chargingSession._id,
                            listOfSessions: [],
                            hwId: chargingSession.location_id,
                            chargerType: chargingSession.chargerType,
                            paymentMethod: chargingSession.paymentMethod,
                            paymentMethodId: chargingSession.paymentMethodId,
                            transactionId: chargingSession.transactionId,
                            adyenReference: chargingSession.adyenReference,
                            reservedAmount: chargingSession.reservedAmount,
                            clientName: chargingSession.clientName
                        }
                        

                        if(isDevice){
                            try {
                                const devicesPreAuthorization = new DevicesPreAuthorizationService(deviceType);
                                const isCaptureSuccess = await devicesPreAuthorization.capturePreAuthorization(chargingSession, bodyPayment.amount.value)
                                bodySession.paymentSubStatus = isCaptureSuccess ? "PAID AND WAITING FOR ADYEN NOTIFICATION" : "PAYMENT FAILED FOR ANY REASON";
                                console.log(`Pre-authorization ${deviceType} session capture ${isCaptureSuccess ? 'success' : 'failed' } for session ${chargingSession._id}`);
                                this.updateSession(sessionId, bodySession);
                                sendSessionToHistoryQueue(chargingSession?._id, `${context} - pre-authorization ${deviceType}`);
                            } catch (error) {
                                Sentry.captureException(error);
                                console.log(`Error calling payment microservice for ${deviceType} session: `, error?.message)
                                bodySession.paymentSubStatus = "PAYMENT FAILED FOR ANY REASON - " + error?.message;
                                this.updateSession(sessionId, bodySession);
                                sendSessionToHistoryQueue(chargingSession?._id, `${context} - catch payment for ${deviceType} session failed for any reason`);
                            }
                        }else{
                            this.makePayment(bodyPayment).then(async (result) => {
                                
                                //If success (40) - Save paymentId and transactionId and change status to PAID
                                //If success (10/20) - Save paymentId and transactionId
                                bodySession.paymentId = result._id;
                                bodySession.transactionId = result.transactionId;

                                //console.log("result payment", result);
                                if (result.status == "40") {
                                    bodySession.paymentStatus = 'PAID';
                                    bodySession.paymentSubStatus = "PAID AND CLOSED";
                                    if (minimumBillingConditions && chargingSession.billingPeriod == "AD_HOC" && totalPrice?.incl_vat >= 0) {
                                        const disabledBillingV2InvoiceOcpi = await toggle.isEnable('billing-v2-invoice-magnifinance-disable');
                                        if (!disabledBillingV2InvoiceOcpi) {
                                            console.info("BillingV2 - feature billing-v2-invoice-magnifinance-disable is disabled, old billing will be used");
                                            Utils.billing(cdr, chargingSession.userIdToBilling, chargingSession, result._id, invoiceLines, totalPrice).then((res) => {
                                                bodySession.invoiceStatus = true;
                                                bodySession.invoiceId = res.invoiceId;
                                                this.updateSession(sessionId, bodySession);
                                                sendSessionToHistoryQueue(chargingSession?._id, `${context} - billing with minimumBillingConditions`);
                                            }).catch((err) => {
                                                Sentry.captureException(err);
                                                if (err?.response?.data) {
                                                    bodySession.invoiceSubStatus = JSON.stringify(err?.response?.data)
                                                } else {
                                                    bodySession.invoiceSubStatus = err?.message
                                                }
                                                this.updateSession(sessionId, bodySession);
                                                sendSessionToHistoryQueue(chargingSession?._id, `${context} - catch billing with minimumBillingConditions`);
                                            });
                                        } else {
                                            console.log("No minimum billing conditions were found")
                                            this.updateSession(sessionId, bodySession);
                                            sendSessionToHistoryQueue(chargingSession?._id, `${context} - no minimum billing conditions`);
                                        }
                                    }
                                  }
                                else if (result.status == "10" || result.status == "20") {
                                    bodySession.paymentSubStatus = "PAID AND WAITING FOR ADYEN NOTIFICATION";
                                    this.updateSession(sessionId, bodySession);
                                    sendSessionToHistoryQueue(chargingSession?._id, `${context} - payment with status 10 || 20`);
                                }
                                else {
                                    bodySession.paymentSubStatus = "PAYMENT FAILED FOR ANY REASON";
                                    this.updateSession(sessionId, bodySession);
                                    sendSessionToHistoryQueue(chargingSession?._id, `${context} - payment failed for any reason`);
                                }

                            }).catch((err) => {
                                Sentry.captureException(err);
                                console.log("Error calling payment microservice: ", err?.message)
                                bodySession.paymentSubStatus = "PAYMENT FAILED FOR ANY REASON - " + err?.message;
                                this.updateSession(sessionId, bodySession);
                                sendSessionToHistoryQueue(chargingSession?._id, `${context} - catch payment failed for any reason`);
                            });
                        }
                        //BillingV2
                        console.info("Starting new invoice process")
                        try {
                            const enableBillingV2AdHoc = await toggle.isEnable('billing-v2-session_adhoc');
                            if (minimumBillingConditions && enableBillingV2AdHoc) {
                                console.info(`Preparing message to send | sessionId: ${chargingSession._id.toString()}`);
                                const payload = { sessionId: chargingSession._id.toString(), cdrId: cdr.id };
                                sendMessage({ method: 'invoiceAdHoc', payload }, 'billing_v2_key');
                            }
                        } catch (error) {
                            console.error("Error new invoice process", error);
                        }
                        
                    }
                    else {
                        //Monthly Billing
                        console.log("bodySession", bodySession)
                        this.updateSession(sessionId, bodySession);
                        sendSessionToHistoryQueue(chargingSession?._id, `${context} - monthly billing`);
                    }
                }
                catch (err) {
                    Sentry.captureException(err);
                    console.log("Billing CDR - err", err)
                    this.updateSession(sessionId, { status: global.SessionStatusStopped });
                    sendSessionToHistoryQueue(chargingSession?._id, `${context} - catch billing cdr`);
                }
            }
            else {
                console.log("[Utils - processBillingAndPayment] - Charging session " + sessionId + " not found");
            }
        });
    },
    chargingSessionFindOne: function (query) {
        const context = "Funciton chargingSessionFindOne";
        return new Promise((resolve, reject) => {
            Session.findOne(query, (err, chargingSessionFound) => {
                if (err) {
                    console.log(`[${context}][findOne] Error `, err.message);
                    reject(err);
                }
                else {
                    resolve(chargingSessionFound);
                };
            });
        });
    },
    updateOrCreateCharger: async function (charger) {
        return new Promise(async (resolve, reject) => {
            if (charger.evses != undefined && charger.evses.length > 0) {
                let { country_code, party_id } = this.parsePartyIdCountryCode(charger.operator.name)
                let countryCode = this.countryToCountryCode(charger, charger.country, country_code)
                let partyId = (charger.party_id === null || typeof charger.party_id === 'undefined') ? party_id : charger.party_id
                Utils.getPlugs(charger.evses, charger.id, countryCode, partyId)
                    .then(async (plugs) => {
                        let name = "";
                        if (typeof charger.name !== 'undefined') {
                            name = charger.name;
                        }
                        else {
                            name = charger.address.replace(regex, subst);
                        }
                        // let { country_code, party_id } = this.parsePartyIdCountryCode(charger.operator.name)
                        let chargerInfo = {
                            hwId: charger.id,
                            //TODO This object has some hardcoded values to Gireve
                            chargerType: this.getChargerTypeByPlatformCode(charger.source),
                            source: charger.source,
                            // partyId: (charger.party_id === null || typeof charger.party_id === 'undefined') ? party_id : charger.party_id,
                            partyId: partyId,
                            operatorID: party_id,
                            // countryCode: this.countryToCountryCode(charger, charger.country, country_code),
                            countryCode: countryCode,
                            cpoCountryCode: (charger.country_code === null || typeof charger.country_code === 'undefined') ? country_code : charger.country_code,
                            operator: charger.operator.name,
                            country: charger.country,
                            name: name,
                            address: {
                                street: charger.address.replace(regex, subst),
                                zipCode: charger.postal_code ?? "",
                                city: charger.city.replace(regex, subst)
                            },
                            parkingType: Utils.getMapping(charger.type, "parkingType"),
                            geometry: {
                                type: "Point",
                                coordinates: [
                                    parseFloat(charger.coordinates.longitude),
                                    parseFloat(charger.coordinates.latitude)
                                ]
                            },
                            availability: {
                                availabilityType: "Always"
                            },
                            status: Utils.getChargerStatus(charger.evses),
                            subStatus: Utils.getChargerSubStatus(charger.evses),
                            imageContent: [],
                            rating: 0,
                            plugs: plugs,
                            network: charger.source,
                            stationIdentifier: charger.id,
                            // TODO How do we get the voltage level?
                            voltageLevel: charger.mobie_voltage_level,
                            timeZone: charger.time_zone || Utils.getTimezone(charger.coordinates.latitude, charger.coordinates.longitude),
                            lastUpdated: charger.last_updated,
                            operationalStatus: Utils.getOperationalStatus(plugs),
                            originalCoordinates: {
                                type: "Point",
                                coordinates: [
                                    parseFloat(charger.coordinates.longitude),
                                    parseFloat(charger.coordinates.latitude)
                                ]
                            }
                        }

                        chargerInfo = await ensureCountryCode(chargerInfo, "updateOrCreateCharger");

                        resolve(chargerInfo)

                    });
            } else {
                let name = "";
                if (typeof charger.name !== 'undefined') {
                    name = charger.name;
                }
                else {
                    name = charger.address.replace(regex, subst);
                }

                let { country_code, party_id } = this.parsePartyIdCountryCode(charger.operator.name)
                let chargerInfo = {
                    hwId: charger.id,
                    //TODO This object has some hardcoded values to Gireve
                    chargerType: this.getChargerTypeByPlatformCode(charger.source),
                    source: charger.source,
                    partyId: (charger.party_id === null || typeof charger.party_id === 'undefined') ? party_id : charger.party_id,
                    operatorID: party_id,
                    countryCode: this.countryToCountryCode(charger, charger.country, country_code),
                    cpoCountryCode: (charger.country_code === null || typeof charger.country_code === 'undefined') ? country_code : charger.country_code,
                    operator: charger.operator.name,
                    country: charger.country,
                    name: name,
                    address: {
                        street: charger.address.replace(regex, subst),
                        zipCode: charger.postal_code ?? "",
                        city: charger.city.replace(regex, subst)
                    },
                    parkingType: Utils.getMapping(charger.type, "parkingType"),
                    geometry: {
                        type: "Point",
                        coordinates: [
                            parseFloat(charger.coordinates.longitude),
                            parseFloat(charger.coordinates.latitude)
                        ]
                    },
                    availability: {
                        availabilityType: "Always"
                    },
                    status: "INOPERATIVE",
                    subStatus: "INOPERATIVE",
                    imageContent: [],
                    rating: 0,
                    plugs: [],
                    network: charger.source,
                    stationIdentifier: charger.id,
                    // TODO How do we get the voltage level?
                    voltageLevel: charger.mobie_voltage_level,
                    timeZone: charger.time_zone || Utils.getTimezone(charger.coordinates.latitude, charger.coordinates.longitude),
                    lastUpdated: charger.last_updated,
                    operationalStatus: "APPROVED",
                    originalCoordinates: {
                        type: "Point",
                        coordinates: [
                            parseFloat(charger.coordinates.longitude),
                            parseFloat(charger.coordinates.latitude)
                        ]
                    }
                }

                chargerInfo = await ensureCountryCode(chargerInfo, "updateOrCreateCharger");

                resolve(chargerInfo)
            }
        });
    },
    makePayment: function (body) {
        return new Promise((resolve, reject) => {
            axios.post(global.paymentEndpoint, body, { headers: { 'userid': body.userId } }).then(function (response) {
                if (typeof response.data !== 'undefined') {
                    resolve(response.data);
                }
                else
                    reject(false);

            }).catch(function (error) {
                reject(error);
            });
        });
    },
    getEVByEvId: function (evId) {
        const context = "Function getEVByEvId";
        return new Promise(async (resolve, reject) => {
            let host = process.env.HostEvs + process.env.PathGetEVByEVId;
            let params = { _id: evId };

            axios.get(host, { params })
                .then((result) => {
                    if (result.data) {
                        resolve(result.data.userId);
                    }
                    else {
                        resolve('-1');
                    };
                })
                .catch((error) => {
                    console.log(`[${context}] Error `, error.message);
                    resolve('-1');
                });
        });
    },
    updateSession: function (sessionId, body) {
        let query = {
            id: sessionId
        };

        Session.findOneAndUpdate(query, body, (err) => {
            if (err) {
                console.log("[updateSession] ", err)
            }
        });
    },
    getPlugs: function (evses, hwId, countryCode, partyId) {
        return new Promise(async (resolve, reject) => {
            let plugs = [];

            for (let evs of evses) {
                let uid = evs.uid;
                let evse_id = evs.evse_id;
                let status = evs.status;
                let plug = null;
                let connectors = evs.connectors;
                let capabilities = evs.capabilities;
                let statusSchedule = evs.status_schedule;
                let floorLevel = evs.floor_level;
                let physicalReference = evs.physical_reference;
                let directions = evs.directions;
                let parkingRestrictions = evs.parking_restrictions;
                let images = evs.images;
                // let evseGroup = await this.getEVSEGroup(uid)

                for (let connector of connectors) {
                    //console.log(connector);
                    plug = {
                        plugId: connector.id,
                        uid: uid,
                        evse_id: evse_id,
                        connectorFormat: connector.format,
                        connectorPowerType: connector.power_type,
                        connectorType: Utils.getMapping(connector.standard, "connectorType"),
                        voltage: connector.voltage,
                        amperage: connector.amperage,
                        status: Utils.getMapping(status, "plugStatus"),
                        subStatus: Utils.getPlugSubStatus(evs),
                        termsAndConditions: connector.terms_and_conditions,
                        //TODO This tariff is being forced, maybe in the future it can change
                        tariffId: [connector.tariff_id],
                        capabilities,
                        statusSchedule,
                        floorLevel,
                        physicalReference,
                        directions,
                        parkingRestrictions,
                        images,
                        hasRemoteCapabilities: typeof evs?.capabilities === 'undefined' || evs?.capabilities?.includes("REMOTE_START_STOP_CAPABLE") ? true : false,
                        lastUpdated: connector.last_updated
                    }

                    if (typeof connector.max_electric_power === 'undefined') {
                        if (connector.voltage != null && connector.amperage != null) {
                            plug.power = (connector.voltage * connector.amperage) / 1000;
                        }
                    }
                    else {
                        plug.power = connector.max_electric_power / 1000;
                    }

                    let tariffOPC = {};
                    if (connector.tariff_id) {
                        tariffOPC = await Utils.getTariffOPC(connector.tariff_id);
                        if (Utils.isEmptyObject(tariffOPC)) {
                            tariffOPC = await Utils.getDefaultOPCTariff() ?? {}
                        }
                    } else {
                        tariffOPC = await Utils.getDefaultOPCTariff() ?? {}
                        if (!Utils.isEmptyObject(tariffOPC)) {
                            plug.tariffId = [tariffOPC.id]
                        }
                    }

                    if (!Utils.isEmptyObject(tariffOPC)) {
                        plug.serviceCost = Utils.tariffResponseBody(tariffOPC);
                    } else {
                        plug.serviceCost = {
                            initialCost: '-1',
                            costByTime: [
                                { cost: '-1' }
                            ],
                            costByPower: {
                                cost: '-1'
                            },
                            elements: [],
                            currency: "EUR",
                        }
                    }
                    /*
                        I'm saving here a serviceCost to Gireve chargers so we don't have to do a request on each plug when the user
                        is using the filter in the map.
                        Although this still needs discussion when we have chargers with other currencies aside from EUR
                    */

                    // let serviceCost = await this.buildGireveServiceCost(plug.power, countryCode , partyId , evseGroup)
                    // plug.serviceCost = serviceCost

                    // TODO Maybe in the future we'll reuse this code, but for now, it will stay commented
                    // if (connector.tariff_id === null || connector.tariff_id === undefined) {
                    //     let tariffId = await this.getChargerTariff(hwId , connector.id)
                    //     plug.tariffId = [tariffId]
                    // }

                    plugs.push(plug);
                }
            }
            resolve(plugs);
        });
    },
    getPlugSubStatus: function (evs) {
        if (evs != undefined) {
            return evs.status;
        }
        else {
            return "UNKNOWN";
        }
    },
    getEVByEvId: function (evId) {
        const context = "Function getEVByEvId";
        return new Promise(async (resolve, reject) => {
            let host = process.env.HostEvs + process.env.PathGetEVByEVId;
            let params = { _id: evId };

            axios.get(host, { params })
                .then((result) => {
                    if (result.data) {
                        resolve(result.data.userId);
                    }
                    else {
                        resolve('-1');
                    };
                })
                .catch((error) => {
                    console.log(`[${context}] Error `, error.message);
                    resolve('-1');
                });
        });
    },
    getEVAllByEvId: function (evId) {
        const context = "Function getEVAllByEvId";
        return new Promise(async (resolve, reject) => {
            let host = process.env.HostEvs + process.env.PathGetAllInfoById;
            let params = { _id: evId };

            axios.get(host, { params })
                .then((result) => {
                    if (result.data) {
                        resolve(result.data);
                    }
                    else {
                        resolve({});
                    };
                })
                .catch((error) => {
                    console.log(`[${context}] Error `, error.message);
                    resolve({});
                });
        });
    },
    getChargerStatus: function (evses) {
        chargerStatus = null;
        plugStatus = [];

        for (let evs of evses) {
            plugStatus.push(evs.status);
        }

        if (plugStatus.includes("AVAILABLE") || plugStatus.includes("CHARGING") || plugStatus.includes("BLOCKED")) {
            return '10';
        }
        else {
            return '50';
        }
    },
    getChargerSubStatus: function (evses) {
        chargerStatus = null;
        plugStatus = [];

        for (let evs of evses) {
            plugStatus.push(evs.status);
        }

        if (plugStatus.includes("AVAILABLE") || plugStatus.includes("CHARGING") || plugStatus.includes("BLOCKED")) {
            return 'AVAILABLE';
        }
        else {
            return 'UNKNOWN';
        }

    },
    parsePartyIdCountryCode: function (operator) {
        /*
            IOP replaces the property “Location.operator.name” by the eMI3 Id of the CPO when an eMSP gets a
            Location. Using this property, the eMSP is able to know who the CPO of the Location is.
        */
        let asterisk = operator.indexOf("*")
        let country_code = operator.slice(0, asterisk)
        let party_id = operator.slice(asterisk + 1)

        return { country_code, party_id }
    },
    getUserIdToken: function (contract_id) {
        return new Promise(async (resolve, reject) => {
            let query = { contract_id: contract_id, valid: true };
            Token.findOne(query, { _id: 0, __v: 0, createdAt: 0, updatedAt: 0, source: 0 }, (err, token) => {
                if (token) {
                    resolve(token);
                }
                else
                    resolve();
            }).catch(function (e) {
                console.log(e);
                resolve();
                return;
            });;
        });
    },
    getSessionModelObj: function (data) {
        /*
            Transforming session request body received on 2.1.1 Session PUT request to session DB model
        */
        let location_id, evse_uid, connector_id
        if (!this.isEmptyObject(data.location)) {
            location_id = data.location.id
            evse_uid = data.location.evses[0].uid
            connector_id = data.location.evses[0].connectors[0].id
        }

        let sessionObj = {
            id: data.id,
            start_date_time: data.start_datetime,
            end_date_time: data.end_datetime,
            kwh: data.kwh,
            contract_id: data.auth_id,
            auth_method: data.auth_method,
            authorization_reference: data.authorization_id,
            location_id,
            evse_uid,
            connector_id,
            meter_id: data.meter_id,
            currency: data.currency,
            charging_periods: data.charging_periods,
            //TODO: Check the missing incl_vat
            total_cost: {
                excl_vat: data.total_cost,
                // incl_vat : -1
            },
            status: data.status,
            last_updated: data.last_updated,
            party_id: data.party_id,
            country_code: data.country_code
        }
        return this.removeUndefinedValues(sessionObj)
    },
    getTokenModelObj: function (data) {
        let tokenObj = {
            country_code: data.country_code,
            type: data.type,
            valid: data.valid,
            whitelist: data.whitelist,
            party_id: data.party_id,
            uid: data.uid,
            auth_id: data.contract_id,
            issuer: data.issuer,
            last_updated: data.last_updated,
        }
        return this.removeUndefinedValues(tokenObj)
    },
    getCDRModelObj: function (data) {
        let chargerName, location_id, evse_uid, evse_id, connector_id, connector_standard, connector_format,
            connector_power_type, connector_voltage, connector_amperage, address, city, postal_code, country, latitude, longitude

        if (!this.isEmptyObject(data.location)) {

            if (typeof data.location.name !== 'undefined') {
                chargerName = data.location.name;
            }
            else {
                chargerName = data.location.address.replace(regex, subst);
            }

            location_id = data.location.id
            evse_uid = data.location.evses[0].uid
            evse_id = data.location.evses[0].evse_id
            connector_id = data.location.evses[0].connectors[0].id
            connector_standard = data.location.evses[0].connectors[0].standard
            connector_format = data.location.evses[0].connectors[0].format
            connector_power_type = data.location.evses[0].connectors[0].power_type
            connector_voltage = data.location.evses[0].connectors[0].voltage
            connector_amperage = data.location.evses[0].connectors[0].amperage

            address = data.location.address.replace(regex, subst)
            city = data.location.city.replace(regex, subst)
            postal_code = data.location.postal_code
            country = data.location.country

            latitude = data.location.coordinates.latitude
            longitude = data.location.coordinates.longitude
        }

        let cdrObj = {
            country_code: data.country_code,
            id: data.id,
            start_date_time: data.start_date_time,
            end_date_time: data.stop_date_time,
            source: data.source,
            cdr_token: data.cdr_token,
            session_id: data.session_id,
            auth_method: data.auth_method,
            cdr_location: {
                id: location_id,
                name: chargerName,
                address,
                city,
                postal_code,
                country,
                coordinates: {
                    latitude,
                    longitude,
                },
                evse_uid,
                evse_id,
                connector_id,
                connector_standard,
                connector_format,
                connector_power_type,
                connector_voltage,
                connector_amperage,
            },
            meter_id: data.meter_id,
            currency: data.currency,
            tariffs: data.tariffs,
            charging_periods: data.charging_periods,
            total_cost: {
                excl_vat: data.total_cost,
                // incl_vat : -1
            },
            total_energy: data.total_energy,
            total_time: data.total_time,
            total_parking_time: data.total_parking_time,
            remark: data.remark,
            party_id: data.party_id,
            last_updated: data.last_updated,
        }

        return this.removeUndefinedValues(cdrObj)
    },
    updateSession: function (sessionId, body) {
        let query = {
            id: sessionId
        };

        Session.findOneAndUpdate(query, body, (err) => {
            if (err) {
                console.log("[updateSession] ", err)
            }
        });
    },
    getTimePrice: function (chargingTime, unitTimePrice, step_size, source) {
        /*
            ACCORDING TO OCPI DOCUMENTATION:

            chargingTime(total_time) comes in hours
            unitTimePrice comes in €/h
            step_size comes in seconds

        */
        let chargingTimeMinutes = chargingTime * 60
        // let unitTimePriceMinutes = unitTimePrice / 60
        //TODO I'll change the unitPrice to €/min to be consistent with MobiE
        let unitTimePriceMinutes = unitTimePrice
        if (source === global.girevePlatformCode || source === global.hubjectPlatformCode) {
            unitTimePriceMinutes = unitTimePrice / 60
        }

        let step_size_minutes = Utils.round(step_size / 60, 6)

        //TODO: Due to roundings along the calculations, I had to round it again when we have relevant step_size. We should keep an eye on this.
        if (step_size_minutes >= 0.03) {
            chargingTimeMinutes = Utils.round(chargingTimeMinutes, 2)
        }

        return Math.ceil(chargingTimeMinutes / step_size_minutes) * unitTimePriceMinutes * step_size_minutes
    },
    getEnergyPrice: function (chargingEnergy, unitEnergyPrice, step_size) {
        /*
            ACCORDING TO OCPI DOCUMENTATION:

            chargingEnergy(total_energy) comes in kWh
            unitEnergyPrice comes in €/kWh
            step_size comes in Wh

        */
        let step_size_kWh = Utils.round(step_size / 1000, 6)

        //TODO: Due to roundings along the calculations, I had to round it again when we have relevant step_size. We should keep an eye on this.
        if (step_size_kWh >= 0.002) {
            chargingEnergy = Utils.round(chargingEnergy, 2)
        }

        return Math.ceil(chargingEnergy / step_size_kWh) * unitEnergyPrice * step_size_kWh
    },
    getTimeTariffPriceStep: function (price, step_size, source) {
        switch (source) {
            case global.girevePlatformCode:
                price = price / 60 // transform to €/min
                step_size = step_size / 60 // transform to min
                break;
            case global.mobiePlatformCode:
                // for now this one's ok
                price = price
                step_size = step_size / 60
                break;
            default:
                price = price
                step_size = step_size / 60
                break;
        }
        return { price, step_size }
    },
    getEnergyTariffPriceStep: function (price, step_size, source) {
        switch (source) {
            case global.girevePlatformCode:
                price = price // transform to €/kWh (it's ok)
                step_size = step_size / 1000 // transform to kWh
                break;
            case global.mobiePlatformCode:
                // for now this one's ok
                price = price
                step_size = step_size / 1000
                break;
            default:
                price = price
                step_size = step_size / 1000
                break;
        }
        return { price, step_size }
    },
    tariffResponseBody: function (foundTariff) {
        let costByTime = []
        let costByPower = []
        let initialCost = 0
        let detailedTariff = {
            flat: [],
            time: [],
            energy: [],
            parking: []
        }
        let currency = foundTariff.currency
        foundTariff.elements.forEach((tariffElement, tariffIndex) => {
            let restrictions = tariffElement.restrictions
            Utils.adjustRestrictions(restrictions)
            let isEmpty = this.isEmptyObject(restrictions)
            tariffElement.price_components.forEach((component, componentIndex) => {
                if (component.type == 'ENERGY') {
                    let { price, step_size } = this.getEnergyTariffPriceStep(component.price, component.step_size, foundTariff.source)
                    costByPower.push({
                        cost: price,
                        step_size,
                        uom: "kWh"
                    })

                    if (!isEmpty) {
                        this.createRestrictionObjects(detailedTariff, 'energy', restrictions, price, step_size, 'kWh', currency)
                    } else {
                        detailedTariff['energy'].push({
                            restrictionType: 'default',
                            values: [
                                {
                                    restrictionValues: {},
                                    price,
                                    step: step_size,
                                    uom: 'kWh',
                                    currency
                                }
                            ]
                        })
                    }
                } else if (component.type == 'TIME') {
                    let { price, step_size } = this.getTimeTariffPriceStep(component.price, component.step_size, foundTariff.source)
                    let body = {
                        minTime: 0,
                        cost: price,
                        step_size,
                        uom: "min"
                    }

                    if (!isEmpty) {
                        this.createRestrictionObjects(detailedTariff, 'time', restrictions, price, step_size, 'min', currency)
                    } else {
                        detailedTariff['time'].push({
                            restrictionType: 'default',
                            values: [
                                {
                                    restrictionValues: {},
                                    price,
                                    step: step_size,
                                    uom: 'min',
                                    currency
                                }
                            ]
                        })
                    }
                    costByTime.push(body)
                } else if (component.type == 'FLAT') {
                    initialCost = component.price
                    if (!isEmpty) {
                        this.createRestrictionObjects(detailedTariff, 'flat', restrictions, component.price, 1, 'UN', currency)
                    } else {
                        detailedTariff['flat'].push({
                            restrictionType: 'default',
                            values: [
                                {
                                    restrictionValues: {},
                                    price: component.price,
                                    step: 1,
                                    uom: 'UN',
                                    currency
                                }
                            ]
                        })
                    }
                } else if (component.type == 'PARKING_TIME') {
                    let { price, step_size } = this.getTimeTariffPriceStep(component.price, component.step_size, foundTariff.source)
                    if (!isEmpty) {
                        this.createRestrictionObjects(detailedTariff, 'parking', restrictions, price, step_size, 'min', currency)
                    } else {
                        detailedTariff['parking'].push({
                            restrictionType: 'default',
                            values: [
                                {
                                    restrictionValues: {},
                                    price,
                                    step: step_size,
                                    uom: 'min',
                                    currency
                                }
                            ]
                        })
                    }
                }
            })
        })

        return {
            _id: foundTariff._id,
            tariffId: foundTariff.id,
            initialCost: initialCost,
            elements: foundTariff.elements,
            currency: foundTariff.currency,
            detailedTariff,
            // TODO We're sending the first object because that's the logic already implemented
            costByPower: costByPower.length > 0 ? costByPower[0] : { "cost": 0, "uom": "kWh" },
            costByTime: costByTime.length > 0 ? costByTime : [{ "minTime": 0, "cost": 0, "uom": "min" }],
        }

    },
    ocpiVersionByChargerType: function (data) {
        switch (data.chargerType) {
            case process.env.chargerTypeGireve:
                return process.env.ocpiVersion211
            case process.env.chargerTypeMobie:
                return process.env.ocpiVersion22
            default:
                return process.env.ocpiVersion211
        }
    },
    //Roaming update meter values
    updateSessionMeterValuesRoaming: function (chargingSession, payload, sendNotification) {
        const context = "[ Utils updateSessionMeterValuesRoaming ]";
        return new Promise(async (resolve, reject) => {
            //Obter inicio de sessão de carregamento à sessão de carregamento
            let startDate
            if ('start_date_time' in payload) {
                startDate = payload.start_date_time;
            } else {
                startDate = chargingSession.start_date_time
            }

            let readDate = payload.last_updated ? moment.utc(payload.last_updated) : moment.utc(new Date().toISOString())
            let communicationDate = moment.utc();

            const isFeatureFlagActive = await toggle.isEnable('charge-314-not-notify-user-session-expensive')
            const dateNow = isFeatureFlagActive ? readDate : moment.utc(new Date().toISOString());
            //Calcular tempo total de carregamento
            const timeChargedinSeconds = Utils.getChargingTime(startDate, dateNow);

            //Obter energia total consumida ao payload do request
            let totalPowerConsumed_Kw = -1;
            let totalPowerConsumed_W = 0;
            let instantPower = -1;
            let instantVoltage = -1;
            let instantAmperage = -1;
            let evBattery = -1;
            let CO2emitted = 0;

            if (payload.kwh >= 0) {
                totalPowerConsumed_Kw = payload.kwh;
                totalPowerConsumed_W = totalPowerConsumed_Kw * 1000;
                CO2emitted = Number(process.env.CarbonIntensity) * totalPowerConsumed_Kw;// Kg CO₂ eq/kWh
                if (CO2emitted < 0)
                    CO2emitted = 0
                if (chargingSession.source == process.env.HubjectPlatformCode && chargingSession.roamingCO2) CO2emitted = this.round(Number(chargingSession.roamingCO2) * totalPowerConsumed_Kw)
            }

            let readingPoints = [{
                totalPower: totalPowerConsumed_W,
                instantPower: instantPower,
                instantVoltage: instantVoltage,
                batteryCharged: evBattery,
                instantAmperage: instantAmperage,
                readDate: readDate,
                communicationDate
            }]

            //Calcular estimativa de custo
            let estimatedPrice_excl_Vat = -1;
            let estimatedPrice_incl_Vat = -1;
            let priceComponents = chargingSession.tariffOPC.elements;
            if (priceComponents !== null && priceComponents !== undefined) {
                priceComponents = this.createTariffElementsAccordingToRestriction(priceComponents, startDate, dateNow.format())
            }
            let charging_periods = payload.charging_periods

            //Calculate OPC Prices
            let aux_totalPowerConsumed_Kw = 0;
            if (totalPowerConsumed_Kw >= 0)
                aux_totalPowerConsumed_Kw = totalPowerConsumed_Kw;

            let result = await this.getCharger(chargingSession.location_id, chargingSession.connector_id);

            // Timezone info to get offset of charger
            let timeZone = chargingSession.timeZone
            let countryCode = chargingSession.country_code
            let offset = this.getChargerOffset(timeZone, countryCode)

            // Arbitrary power and voltage values
            let plugPower = 50
            let plugVoltage = 480
            if (result.plug) {
                plugPower = result.plug.power
                plugVoltage = result.plug.voltage
            }

            /*
                This function calculates the final prices for each dimension. If eventually there's a wrong price, the testTariffs file should be used to test new changes
                and add more use cases if necessary.

                Parking time is assumed 0, but is it right?

                When the charging ends and parking begins, do we still receive updates from session?
                In theory, parking is still part of the session

                Update - > This function also returns a key of information about each dimension. That info contains the amount consumed in each charging period and
                            other details about the tariff and its restrictions
            */

            let [flat, energy, time, parking] = this.opcTariffsPrices(null, priceComponents, startDate, dateNow.format(), offset, plugPower, plugVoltage, aux_totalPowerConsumed_Kw, timeChargedinSeconds / 3600, 0, chargingSession.source)

            let [
                OCP_PRICE_FLAT,
                OCP_PRICE_ENERGY,
                OCP_PRICE_TIME,
                OCP_PRICE_PARKING_TIME
            ] = [flat.price, energy.price, time.price, parking.price]

            let OPC_Price = OCP_PRICE_FLAT + OCP_PRICE_ENERGY + OCP_PRICE_TIME + OCP_PRICE_PARKING_TIME

            // CEME
            let CEME_FLAT = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "flat")
            let CEME_POWER = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "energy")
            let CEME_TIME = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "time")
            let CEME_PERCENTAGE = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "percentage")
            // for Roaming
            let CEME_START_PERCENTAGE = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "start_percentage")
            let CEME_ENERGY_PERCENTAGE = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "energy_percentage")
            let CEME_TIME_PERCENTAGE = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "time_percentage")

            let CEME_Price_FLAT = CEME_FLAT ? CEME_FLAT.price : 0
            let CEME_Price_POWER = CEME_POWER ? CEME_POWER.price : 0
            let CEME_Price_TIME = CEME_TIME ? CEME_TIME.price : 0
            let evioPercentage = CEME_PERCENTAGE ? CEME_PERCENTAGE.price : 0
            let evioStartPercentage = CEME_START_PERCENTAGE ? CEME_START_PERCENTAGE.price : 0
            let evioEnergyPercentage = CEME_ENERGY_PERCENTAGE ? CEME_ENERGY_PERCENTAGE.price : 0
            let evioTimePercentage = CEME_TIME_PERCENTAGE ? CEME_TIME_PERCENTAGE.price : 0

            let totalTimeConsumed = timeChargedinSeconds
            if (CEME_TIME && CEME_TIME.uom.includes('min')) {
                totalTimeConsumed = timeChargedinSeconds / 60
            } else if (CEME_TIME && CEME_TIME.uom.includes('h')) {
                totalTimeConsumed = timeChargedinSeconds / 3600
            }

            // //EVIO Percentage
            // CEME_Price_FLAT += evioPercentage * OPC_Price

            // // Gireve Commission
            // CEME_Price_FLAT += Number(process.env.GireveCommission)

            //We should also consider this value, right?
            // if (chargingSession.paymentType == "AD_HOC" && chargingSession.paymentMethod == "card") {
            //     CEME_Price_FLAT += Number(process.env.AD_HOC_Activation_Fee_Card)
            // } else if (chargingSession.paymentType == "AD_HOC" && chargingSession.paymentMethod == "wallet") {
            //     CEME_Price_FLAT += Number(process.env.AD_HOC_Activation_Fee_Wallet);
            // } else {
            //     CEME_Price_FLAT += Number(process.env.AD_HOC_Activation_Fee_Wallet);
            // }
            let startPercentagePrice = evioStartPercentage * OCP_PRICE_FLAT
            let energyPercentagePrice = evioEnergyPercentage * OCP_PRICE_ENERGY
            let timePercentagePrice = evioTimePercentage * OCP_PRICE_TIME
            let CEME_Price = CEME_Price_FLAT + CEME_Price_POWER * aux_totalPowerConsumed_Kw + CEME_Price_TIME * totalTimeConsumed;

            // VAT
            let VAT_Price = chargingSession?.fees?.IVA ?? await vatService.getVATwithViesVAT(chargingSession); //Iva

            let roamingCommission = chargingSession.source == process.env.HubjectNetwork ? process.env.HubjectCommission : process.env.GireveCommission
            //Final PRICES
            estimatedPrice_excl_Vat_without_FEES = OPC_Price + CEME_Price + evioPercentage * OPC_Price + Number(roamingCommission) + timePercentagePrice + energyPercentagePrice + timePercentagePrice
            estimatedPrice_excl_Vat = OPC_Price + CEME_Price + evioPercentage * OPC_Price + Number(roamingCommission) + timePercentagePrice + energyPercentagePrice + timePercentagePrice
            estimatedPrice_incl_Vat = estimatedPrice_excl_Vat + (VAT_Price * estimatedPrice_excl_Vat);

            // console.log({ estimatedPrice_excl_Vat_without_FEES: estimatedPrice_excl_Vat_without_FEES, energy: aux_totalPowerConsumed_Kw, time: (timeChargedinSeconds / 60), opc_price: OPC_Price, ceme_price: CEME_Price })

            let totalCost = { excl_vat: Utils.round(estimatedPrice_excl_Vat), incl_vat: Utils.round(estimatedPrice_incl_Vat) }

            let query = { _id: chargingSession._id, status: {$nin: [global.SessionStatusStopped, global.SessionStatusSuspended]} };
            let newValues = {
                $set:
                {
                    timeCharged: timeChargedinSeconds,
                    batteryCharged: evBattery,
                    kwh: totalPowerConsumed_Kw,
                    CO2Saved: CO2emitted,
                    total_cost: totalCost,
                    totalPower: totalPowerConsumed_W,
                    charging_periods,
                    start_date_time: startDate,
                },
                $push: {
                    readingPoints: readingPoints
                }

            };

            Session.updateSession(query, newValues, async (err, result) => {
                if (err) {
                    console.log(`[update Session OCPI] Error `, err);
                    resolve(err);
                }
                else {

                    if (result) {
                        let notificationBody = {
                            totalPower: totalPowerConsumed_W,
                            estimatedPrice: totalCost.incl_vat,
                            timeCharged: timeChargedinSeconds,
                            batteryCharged: evBattery
                        }
                        const {isDevice = false, deviceType = '' } = Helpers.verifyIsDeviceRequest(result?.createdWay);

                        if (sendNotification && !isDevice) {
                            const sessionTimeValid = await Utils.checkSessionTimeIsValidForNotification(timeChargedinSeconds, startDate, isFeatureFlagActive);
                            if(sessionTimeValid){
                                UtilsFirebase.dataFirebaseNotification(result, notificationBody);
                                Utils.notificationManagement(result)
                                Utils.sendStartNotification(result)
                            }
                        }
                        // Add flow of PreAuthorization to cc sessions to Gireve
                        let reason = null;
                        let paymentSubStatus = "Pre Authorization Captivated with success";
                        if(isDevice || (isValidDateForPreAuthorization(startDate) && result.paymentMethod == Enums.PaymentsMethods.Card)) {
                            try {
                                if(isDevice){
                                    const devicesPreAuthorization = new DevicesPreAuthorizationService(deviceType);
                                    const result = await devicesPreAuthorization.updatePreAuthorization(chargingSession, totalCost.incl_vat);
                                    if(!result){
                                        throw new Error(`Failed to update pre-authorization ${deviceType}`);
                                    }
                                }else{
                                    await Utils.MakeOrUpdatePreAuhtorization(chargingSession, totalCost.incl_vat, totalPowerConsumed_W);
                                }
                            } catch (error) {
                                const errorLogStage = isDevice ? `[${deviceType} updatePreAuthorization]` : 'MakeOrUpdatePreAuthorization';
                                reason = 'SESSION STOP - MISSING PAYMENTS';
                                paymentSubStatus = "PAYMENT FAILED FOR ANY REASON"
                                saveSessionLogs({
                                    userId: chargingSession?.userId || '',
                                    hwId: chargingSession?.location_id || '',
                                    plugId: chargingSession?.connector_id || '',
                                    sessionId: chargingSession?._id || '',
                                    externalSessionId: chargingSession?.id || '',
                                    stage: errorLogStage,
                                    action: 'start',
                                    status: Enums.SessionFlowLogsStatus.ERROR,
                                    errorType: Enums.SessionFlowLogsErrorTypes.VALIDATION_ERROR,
                                    errorMessage: `ERROR SESSION PreAuthorization ${deviceType || ''} - MISSING PAYMENTS, Error: ${error?.message || ''}`
                                })
                                console.log(`${context} errorMakeOrUpdatePreAuhtorization ${deviceType || ''}: ${error}`);
                                Utils.updateStopSessionMeterValues(chargingSession);
                                const req = {
                                    headers: { userid: chargingSession.userId },
                                    body: { sessionId: chargingSession.id },
                                };
                                await remoteStopSessionUtil(req, result.source).then(async result => {
                                    console.log(`${context} remoteStopSession: `, result);
                                    if(!isDevice){
                                        let messageHeader = 'SESSION STOP - MISSING PAYMENT';
                                        let messageBody = 'Your charging session was interrupted because we were unable to grant the necessary authorization due to insufficient funds on your card.';
                                        
                                        notifySessionStopedMissingPayment(CodeTranslationsPushNotifications.NOTIFICATION_CHARGING_SESSION_STOP_MISSING_PAYMENT_WITHOUT_BALANCE, chargingSession.userId )
                                    }
                                    
                                }).catch((e) => {
                                    console.log(`${context} remoteStopSession  ${deviceType || ''} session error: `, e, ' sessionId: ', chargingSession.id);
                                    e.sessionId = chargingSession.id;
                                    reason = 'ERROR SESSION STOP - MISSING PAYMENTS';
                                    Sentry.captureException(e);
                                });
                                Sentry.captureException(error);
                            }finally{
                                if(!result.reservationPay){
                                    result.reservationPay = true;
                                    result.paymentSubStatus = paymentSubStatus;
                                    if(reason) result.reason = reason;
                                    await this.updateSession(result.id, result);
                                }
                            }
                        }
                    }

                    resolve();
                };
            });
        });
    },
    opcTariffsPrices: function (charging_periods, elements, sessionStartDate, sessionStopDate, offset, power, voltage, total_energy, total_charging_time, total_parking_time, source) {
        let FLAT_OPC_PRICE = 0
        let TIME_OPC_PRICE = 0
        let ENERGY_OPC_PRICE = 0
        let PARKING_TIME_OPC_PRICE = 0

        let timeChargingPeriods = []
        let energyChargingPeriods = []
        let parkingTimeChargingPeriods = []
        let flatChargingPeriods = []

        /*
            If OCPI sends charging_periods(not mandatory), we use them to calculate all prices in each dimension (FLAT,ENERGY,TIME,PARKING_TIME).

            Else, with the total charging time, total energy and total parking time, knowing the start date and end date, we can get which tariffs were used
            in that period of time and the volume of time and energy consumed in those tariff periods.
        */
        if ((charging_periods !== null && typeof charging_periods !== "undefined") && (elements !== null && typeof elements !== "undefined")) {
            let consumedPower_kWh = 0
            charging_periods.forEach((period, index) => {
                // Start and end dates in ISO string 8601, according to UTC
                let periodStartDate = period.start_date_time
                let periodEndDate = index == charging_periods.length - 1 ? sessionStopDate : charging_periods[index + 1].start_date_time

                // Start and end dates in ISO string 8601, according to charger time zone
                let localPeriodStartDate = moment.utc(periodStartDate).add(offset, 'minutes').format()
                let localPeriodEndDate = moment.utc(periodEndDate).add(offset, 'minutes').format()

                // Each charging period has relevant consumed dimension types, according to a specific tariff
                let dimensionsObj = this.getDimensionsObj(period.dimensions)
                consumedPower_kWh += dimensionsObj["ENERGY"]

                // For each charging period, calculate the opc prices in that period with the corresponding tariff
                let [flat, energy, time, parking] = this.getOpcPricesByChargingPeriod(elements, dimensionsObj, sessionStartDate, localPeriodStartDate, localPeriodEndDate, power, voltage, total_charging_time, total_parking_time, consumedPower_kWh, FLAT_OPC_PRICE, TIME_OPC_PRICE, ENERGY_OPC_PRICE, PARKING_TIME_OPC_PRICE, source)

                //Total price in each dimension in each charging period
                FLAT_OPC_PRICE = flat.price
                TIME_OPC_PRICE = time.price
                ENERGY_OPC_PRICE = energy.price
                PARKING_TIME_OPC_PRICE = parking.price

                // Price charged for each charging period, volume of the consumed dimention and tariff info and restrictions
                timeChargingPeriods.push(time.info)
                energyChargingPeriods.push(energy.info)
                parkingTimeChargingPeriods.push(parking.info)
            })

        } else if ((elements !== null && typeof elements !== "undefined")) {

            // Start Date and  End Date in ISO string 8601, according to charger time zone
            let localSessionStartDate = moment.utc(sessionStartDate).add(offset, 'minutes').format()
            let totalChargingSessionTime = total_charging_time + total_parking_time
            let localSessionEndDate = moment.utc(localSessionStartDate).add(totalChargingSessionTime, 'hours').format()

            let [flat, energy, time, parking] = this.opcFinalPrices(elements, localSessionStartDate, localSessionEndDate, total_energy, power, total_charging_time, total_parking_time, source)

            //Total price in each dimension of the total session
            FLAT_OPC_PRICE = flat.price
            TIME_OPC_PRICE = time.price
            ENERGY_OPC_PRICE = energy.price
            PARKING_TIME_OPC_PRICE = parking.price

            // Array containing price charged for each period, volume of the consumed dimention and tariff info and restrictions
            flatChargingPeriods = flat.info
            timeChargingPeriods = time.info
            energyChargingPeriods = energy.info
            parkingTimeChargingPeriods = parking.info

        } else {
            // The returned opc tariffs cost is zero when we can't calculate it (no charging_periods or elements array were sent)
            FLAT_OPC_PRICE = 0
            TIME_OPC_PRICE = 0
            ENERGY_OPC_PRICE = 0
            PARKING_TIME_OPC_PRICE = 0

        }
        return [{ price: FLAT_OPC_PRICE, info: flatChargingPeriods }, { price: ENERGY_OPC_PRICE, info: energyChargingPeriods }, { price: TIME_OPC_PRICE, info: timeChargingPeriods }, { price: PARKING_TIME_OPC_PRICE, info: parkingTimeChargingPeriods }]
    },
    getDimensionsObj: function (dimensions) {
        // These keys are all the possible dimension types provided in each charging period in OCPI 2.1.1
        let responseObj = {
            "FLAT": 0,
            "ENERGY": 0,
            "TIME": 0,
            "PARKING_TIME": 0,
            "MIN_CURRENT": 0,
            "MAX_CURRENT": 0
        }
        for (let dimension of dimensions) {
            let dimensionType = dimension.type
            let dimensionVolume = dimension.volume
            responseObj[dimensionType] = dimensionVolume
        }
        return responseObj
    },
    getOpcPricesByChargingPeriod: function (elements, dimensionsObj, sessionStartDate, startDate, endDate, power, voltage, total_charging_time, total_parking_time, consumedPower, FLAT_OPC_PRICE, TIME_OPC_PRICE, ENERGY_OPC_PRICE, PARKING_TIME_OPC_PRICE, source) {
        /*
            When the list of Tariff Elements contains more than one Element with the same Tariff Dimension (ENERGY/FLAT/TIME etc.), then,
            the first Tariff Element with that Dimension in the list with matching Tariff Restrictions will be used. Only one Tariff per Element type
            can be active at any point in time, but multiple Tariff Types can be active at once. IE you can have an ENERGY element and TIME
            element active at the same time, but only the first valid element of each.

            That being said, we use booleans to control wich tariffs have already matched the restrictions
        */
        let tariffFlat = false
        let tariffEnergy = false
        let tariffTime = false
        let tariffParkingTime = false

        let tariffEnergyObj = {}
        let tariffTimeObj = {}
        let tariffParkingTimeObj = {}

        for (let tariffElement of elements) {
            let restrictions = tariffElement.restrictions
            // A tariff it's only valid if it obeys all restrictions
            Utils.adjustRestrictions(restrictions)
            let isEmpty = this.isEmptyObject(restrictions)
            for (let component of tariffElement.price_components) {
                let obeys = !isEmpty ? this.obeysRestrictions(restrictions, component, dimensionsObj, sessionStartDate, startDate, endDate, consumedPower, power, voltage, total_charging_time, total_parking_time) : true
                component.step_size = component.step_size !== null && component.step_size !== undefined ? component.step_size : 1
                let { priceRoundGranularity, priceRoundRule, stepRoundGranularity, stepRoundRule } = this.roundingsValidation(component)
                if (source === global.girevePlatformCode || source === global.hubjectPlatformCode) {
                    component.price = Utils.roundingGranularityRules(priceRoundGranularity, priceRoundRule, component.price)
                    component.step_size = Utils.roundingGranularityRules(stepRoundGranularity, stepRoundRule, component.step_size)
                }
                if (obeys) {
                    if (component.type === "FLAT" && !tariffFlat) {
                        FLAT_OPC_PRICE += dimensionsObj[component.type]
                        tariffFlat = true
                    } else if (component.type === "ENERGY" && !tariffEnergy) {
                        ENERGY_OPC_PRICE += this.getEnergyPrice(dimensionsObj[component.type], component.price, component.step_size)
                        tariffEnergyObj = {
                            quantity: dimensionsObj[component.type],
                            cost: this.getEnergyPrice(dimensionsObj[component.type], component.price, component.step_size),
                            component,
                            restrictions: !isEmpty ? restrictions : {}
                        }
                        tariffEnergy = true
                    } else if (component.type === "TIME" && !tariffTime) {
                        TIME_OPC_PRICE += this.getTimePrice(dimensionsObj[component.type], component.price, component.step_size, source)
                        tariffTimeObj = {
                            quantity: dimensionsObj[component.type],
                            cost: this.getTimePrice(dimensionsObj[component.type], component.price, component.step_size, source),
                            component,
                            restrictions: !isEmpty ? restrictions : {}
                        }
                        tariffTime = true
                    } else if (component.type === "PARKING_TIME" && !tariffParkingTime) {
                        PARKING_TIME_OPC_PRICE += this.getTimePrice(dimensionsObj[component.type], component.price, component.step_size, source)
                        tariffParkingTimeObj = {
                            quantity: dimensionsObj[component.type],
                            cost: this.getTimePrice(dimensionsObj[component.type], component.price, component.step_size, source),
                            component,
                            restrictions: !isEmpty ? restrictions : {}
                        }
                        tariffParkingTime = true
                    }
                }
            }
        }
        return [{ price: FLAT_OPC_PRICE, info: {} }, { price: ENERGY_OPC_PRICE, info: tariffEnergyObj }, { price: TIME_OPC_PRICE, info: tariffTimeObj }, { price: PARKING_TIME_OPC_PRICE, info: tariffParkingTimeObj }]
    },
    obeysRestrictions: function (restrictions, component, dimensionsObj, sessionStartDate, startDate, endDate, consumedPower, plugPower, plugVoltage, total_charging_time, total_parking_time) {
        let obeys = true

        //Local start and end dates
        let localStartDate = moment.utc(startDate).format("YYYY-MM-DD")
        let localEndDate = moment.utc(endDate).format("YYYY-MM-DD")

        // Local Unix Time Stamps
        let endLocalUnixTimestamp = Date.parse(endDate)
        let startLocalUnixTimestamp = Date.parse(startDate)

        //Session Start Date Unix Time Stamp
        let sessionStartDateUnixTimestamp = Date.parse(sessionStartDate)

        // START_TIME_RESTRICTION
        if ('start_time' in restrictions && restrictions['start_time'] !== null && restrictions['start_time'] !== undefined) {
            let restrictionStartDateTime = moment.utc(`${restrictions['start_date']} ${restrictions["start_time"]}`, "YYYY-MM-DD HH:mm").format()
            // Restrictions Unix Time Stamp
            let startTimeUnixTimestampRestriction = Date.parse(restrictionStartDateTime)

            if ('end_time' in restrictions && restrictions['end_time'] !== null && restrictions['end_time'] !== undefined) {
                let restrictionEndDateTime = moment.utc(`${restrictions['start_date']} ${restrictions["end_time"]}`, "YYYY-MM-DD HH:mm").format()

                // Restrictions Unix Time Stamp
                let endTimeUnixTimestampRestriction = Date.parse(restrictionEndDateTime)

                if (endTimeUnixTimestampRestriction < startTimeUnixTimestampRestriction) {
                    endTimeUnixTimestampRestriction += 24 * 3600 * 1000 //adding 24 hours
                }

                if (!(startLocalUnixTimestamp >= startTimeUnixTimestampRestriction && endLocalUnixTimestamp <= endTimeUnixTimestampRestriction)) {
                    obeys = false
                }

            } else {
                if (startLocalUnixTimestamp < startTimeUnixTimestampRestriction) {
                    obeys = false
                }
            }
        }

        // START_DATE_RESTRICTION
        if ('start_date' in restrictions && restrictions['start_date'] !== null && restrictions['start_date'] !== undefined) {
            let restrictionStartDate = moment.utc(`${restrictions["start_date"]}`, "YYYY-MM-DD").format()
            // Restrictions Unix Time Stamp
            let startDateUnixTimestampRestriction = Date.parse(restrictionStartDate)

            // Local Start Date set to midnight
            let localMomentStartDate = moment.utc(`${localStartDate}}`, "YYYY-MM-DD").format()


            if ('end_date' in restrictions && restrictions['end_date'] !== null && restrictions['end_date'] !== undefined) {
                let restrictionEndDate = moment.utc(`${restrictions["end_date"]}`, "YYYY-MM-DD").format()

                // Restrictions Unix Time Stamp
                let endDateUnixTimestampRestriction = Date.parse(restrictionEndDate)

                // Local End Date set to midnight
                let localMomentEndDate = moment.utc(`${localEndDate}}`, "YYYY-MM-DD").format()

                // end_date -> tariff valid until this day (excluding this day)
                if (!(Date.parse(localMomentStartDate) >= startDateUnixTimestampRestriction && Date.parse(localMomentEndDate) < endDateUnixTimestampRestriction)) {
                    obeys = false
                }

            } else {
                if (Date.parse(localMomentStartDate) < startDateUnixTimestampRestriction) {
                    obeys = false
                }
            }
        }

        // END_DATE_RESTRICTION
        if ('end_date' in restrictions && restrictions['end_date'] !== null && restrictions['end_date'] !== undefined) {
            let restrictionEndDate = moment.utc(`${restrictions["end_date"]}`, "YYYY-MM-DD").format()

            // Restrictions Unix Time Stamp
            let endDateUnixTimestampRestriction = Date.parse(restrictionEndDate)

            // Local End Date set to midnight
            let localMomentEndDate = moment.utc(`${localEndDate}}`, "YYYY-MM-DD").format()

            // end_date -> tariff valid until this day (excluding this day)
            if (Date.parse(localMomentEndDate) >= endDateUnixTimestampRestriction) {
                obeys = false
            }
        }

        // MIN_KWH_RESTRICTION
        if ('min_kwh' in restrictions && restrictions['min_kwh'] !== null && restrictions['min_kwh'] !== undefined) {
            if (consumedPower <= restrictions["min_kwh"]) {
                obeys = false
            } else {
                if ('max_kwh' in restrictions && restrictions['max_kwh'] !== null && restrictions['max_kwh'] !== undefined) {
                    if (consumedPower > restrictions["max_kwh"]) {
                        obeys = false
                    }
                }
            }
        }

        // MAX_KWH_RESTRICTION
        if ('max_kwh' in restrictions && restrictions['max_kwh'] !== null && restrictions['max_kwh'] !== undefined) {
            if (consumedPower > restrictions["max_kwh"]) {
                obeys = false
            }
        }

        //MIN_POWER_RESTRICTION
        if ('min_power' in restrictions && restrictions['min_power'] !== null && restrictions['min_power'] !== undefined) {
            let max_current = dimensionsObj["MAX_CURRENT"]
            let min_current = dimensionsObj["MIN_CURRENT"]
            let current = Math.max(max_current, min_current)
            let power = current * plugVoltage / 1000 < plugPower ? current * plugVoltage / 1000 : plugPower

            if (power < restrictions['min_power']) {
                obeys = false
            } else {
                if ('max_power' in restrictions && restrictions['max_power'] !== null && restrictions['max_power'] !== undefined) {
                    if (power >= restrictions['max_power']) {
                        obeys = false
                    }
                }
            }
        }

        //MAX_POWER_RESTRICTION
        if ('max_power' in restrictions && restrictions['max_power'] !== null && restrictions['max_power'] !== undefined) {
            let max_current = dimensionsObj["MAX_CURRENT"]
            let min_current = dimensionsObj["MIN_CURRENT"]
            let current = Math.max(max_current, min_current)
            let power = current * plugVoltage / 1000 < plugPower ? current * plugVoltage / 1000 : plugPower

            if (power >= restrictions['max_power']) {
                obeys = false
            }
        }

        //MIN_DURATION_RESTRICTION
        if ('min_duration' in restrictions && restrictions['min_duration'] !== null && restrictions['min_duration'] !== undefined) {
            let sessionDurationEnd = (endLocalUnixTimestamp - sessionStartDateUnixTimestamp) / 1000
            let sessionDurationStart = (startLocalUnixTimestamp - sessionStartDateUnixTimestamp) / 1000
            if (component.type === "PARKING_TIME") {
                sessionDurationEnd = (endLocalUnixTimestamp - (sessionStartDateUnixTimestamp + total_charging_time * 3600 * 1000)) / 1000
                sessionDurationStart = (startLocalUnixTimestamp - (sessionStartDateUnixTimestamp + total_charging_time * 3600 * 1000)) / 1000
            }
            if (sessionDurationEnd < restrictions['min_duration']) {
                obeys = false
            } else {
                if ('max_duration' in restrictions && restrictions['max_duration'] !== null && restrictions['max_duration'] !== undefined) {
                    if (sessionDurationStart >= 0) {
                        if (sessionDurationStart > restrictions['max_duration']) {
                            obeys = false
                        }
                    } else {
                        obeys = false
                    }
                }
            }
        }

        //MAX_DURATION_RESTRICTION
        if ('max_duration' in restrictions && restrictions['max_duration'] !== null && restrictions['max_duration'] !== undefined) {
            let sessionDurationEnd = (endLocalUnixTimestamp - sessionStartDateUnixTimestamp) / 1000
            let sessionDurationStart = (startLocalUnixTimestamp - sessionStartDateUnixTimestamp) / 1000
            if (component.type === "PARKING_TIME") {
                sessionDurationEnd = (endLocalUnixTimestamp - (sessionStartDateUnixTimestamp + total_charging_time * 3600 * 1000)) / 1000
                sessionDurationStart = (startLocalUnixTimestamp - (sessionStartDateUnixTimestamp + total_charging_time * 3600 * 1000)) / 1000
            }

            if (sessionDurationStart >= 0) {
                if (sessionDurationEnd > restrictions['max_duration']) {
                    obeys = false
                }
            } else {
                obeys = false
            }
        }

        return obeys
    },
    opcFinalPrices: function (tariffElements, startDate, endDate, consumedPower, plugPower, total_charging_time, total_parking_time, source) {
        /*
            This function loops all available tariffs, checks if they can apply to the corresponding charging session, and then, divide the charging session
            in charging periods with the different relevant dimensions.
        */
        let chargingPeriodsObj = {
            "FLAT": [],
            "ENERGY": [],
            "TIME": [],
            "PARKING_TIME": []
        }

        let consumedPower_s = total_charging_time > 0 ? Utils.round(consumedPower / (Utils.round(total_charging_time * 3600, 6)), 6) : 0

        // Append all valid tariffs to an array with its corresponding dimension types, valid periods in time and consumed energy in that period
        for (let element of tariffElements) {
            let restrictions = element.restrictions
            let priceComponents = element.price_components
            Utils.adjustRestrictions(restrictions)
            let isEmpty = this.isEmptyObject(restrictions)

            let tariffObj
            if (!isEmpty) {
                tariffObj = this.tariffIsValid(restrictions, priceComponents, startDate, endDate, total_charging_time, total_parking_time, consumedPower, plugPower)
            } else {
                tariffObj = {}
                priceComponents.forEach(component => {
                    if (component.type === "PARKING_TIME") {
                        tariffObj[component.type] = {
                            isValid: true,
                            periodConsumedPower: 0, // kWh
                            periodConsumedTime: 0, // s
                            periodConsumedParkingTime: total_parking_time * 3600, // s
                            chargingPeriods: [Date.parse(startDate) + Utils.round((total_charging_time * 3600 * 1000), 0), Date.parse(endDate)], // ms
                            component: component,
                            restrictions: {},
                        }
                    } else {
                        tariffObj[component.type] = {
                            isValid: true,
                            periodConsumedPower: 0, // kWh
                            periodConsumedTime: total_charging_time * 3600, // s
                            periodConsumedParkingTime: 0, // s
                            chargingPeriods: [Date.parse(startDate), Date.parse(startDate) + Utils.round((total_charging_time * 3600 * 1000), 0)], // ms
                            component: component,
                            restrictions: {},
                        }
                    }
                })
            }
            chargingPeriodsObj = this.pushTariffsToChargingPeriods(tariffObj, chargingPeriodsObj)
        }

        // OPC PRICE FLAT
        let [OCP_PRICE_FLAT, flatInfo] = this.calculateOpcPrice("FLAT", chargingPeriodsObj, consumedPower_s, source)

        // OPC PRICE ENERGY
        let [OCP_PRICE_ENERGY, energyInfo] = this.calculateOpcPrice("ENERGY", chargingPeriodsObj, consumedPower_s, source)

        // OPC PRICE TIME
        let [OCP_PRICE_TIME, timeInfo] = this.calculateOpcPrice("TIME", chargingPeriodsObj, consumedPower_s, source)

        // OPC PRICE PARKING_TIME
        let [OCP_PRICE_PARKING_TIME, parkingTimeInfo] = this.calculateOpcPrice("PARKING_TIME", chargingPeriodsObj, consumedPower_s, source)

        return [{ price: OCP_PRICE_FLAT, info: flatInfo }, { price: OCP_PRICE_ENERGY, info: energyInfo }, { price: OCP_PRICE_TIME, info: timeInfo }, { price: OCP_PRICE_PARKING_TIME, info: parkingTimeInfo }]
    },
    tariffIsValid: function (restrictions, priceComponents, startDate, endDate, total_charging_time, total_parking_time, consumedPower, plugPower) {
        let tariffsObj = {}

        for (let component of priceComponents) {
            let isValid = true
            //Local start and end dates
            let localStartDate = moment.utc(startDate).format("YYYY-MM-DD")
            let localEndDate = moment.utc(endDate).format("YYYY-MM-DD")

            // Local Unix Time Stamps
            let endLocalUnixTimestamp = Date.parse(endDate)
            let startLocalUnixTimestamp = Date.parse(startDate)

            //Charging periods of this tariff
            let chargingPeriods = []

            let periodConsumedPower = 0
            let periodConsumedTime = total_charging_time * 3600
            let periodConsumedParkingTime = total_parking_time * 3600
            let totalChargingTime = Utils.round(total_charging_time * 3600, 6)
            let totalParkingTime = Utils.round(total_parking_time * 3600, 6)

            if (component.type === "PARKING_TIME") {
                localStartDate = moment.utc(startLocalUnixTimestamp + totalChargingTime * 1000).format("YYYY-MM-DD")
                startLocalUnixTimestamp += totalChargingTime * 1000
            } else {
                localEndDate = moment.utc(startLocalUnixTimestamp + totalChargingTime * 1000).format("YYYY-MM-DD")
                endLocalUnixTimestamp = startLocalUnixTimestamp + totalChargingTime * 1000
            }

            endLocalUnixTimestamp = Utils.round(endLocalUnixTimestamp, 0)
            startLocalUnixTimestamp = Utils.round(startLocalUnixTimestamp, 0)

            // START_TIME_RESTRICTION
            if ('start_time' in restrictions && restrictions['start_time'] !== null && restrictions['start_time'] !== undefined) {
                let restrictionStartDateTime = moment.utc(`${restrictions['start_date']} ${restrictions["start_time"]}`, "YYYY-MM-DD HH:mm").format()
                // Restrictions Unix Time Stamp
                let startTimeUnixTimestampRestriction = Date.parse(restrictionStartDateTime)

                if ('end_time' in restrictions && restrictions['end_time'] !== null && restrictions['end_time'] !== undefined) {
                    let restrictionEndDateTime = moment.utc(`${restrictions['start_date']} ${restrictions["end_time"]}`, "YYYY-MM-DD HH:mm").format()

                    // Restrictions Unix Time Stamp
                    let endTimeUnixTimestampRestriction = Date.parse(restrictionEndDateTime)

                    if (endTimeUnixTimestampRestriction < startTimeUnixTimestampRestriction) {
                        endTimeUnixTimestampRestriction += 24 * 3600 * 1000 //adding 24 hours
                    }

                    if (startLocalUnixTimestamp <= startTimeUnixTimestampRestriction && endLocalUnixTimestamp <= startTimeUnixTimestampRestriction) {
                        isValid = false
                    } else if (startLocalUnixTimestamp >= endTimeUnixTimestampRestriction && endLocalUnixTimestamp >= endTimeUnixTimestampRestriction) {
                        isValid = false
                    } else {
                        if (startLocalUnixTimestamp <= startTimeUnixTimestampRestriction && endLocalUnixTimestamp >= endTimeUnixTimestampRestriction) {
                            chargingPeriods.push([
                                startTimeUnixTimestampRestriction, endTimeUnixTimestampRestriction
                            ])
                        } else if (startLocalUnixTimestamp >= startTimeUnixTimestampRestriction && endLocalUnixTimestamp <= endTimeUnixTimestampRestriction) {
                            chargingPeriods.push([
                                startLocalUnixTimestamp, endLocalUnixTimestamp
                            ])
                        } else if (startLocalUnixTimestamp <= startTimeUnixTimestampRestriction && endLocalUnixTimestamp > startTimeUnixTimestampRestriction) {
                            chargingPeriods.push([
                                startTimeUnixTimestampRestriction, endLocalUnixTimestamp
                            ])
                        } else if (startLocalUnixTimestamp < endTimeUnixTimestampRestriction && endLocalUnixTimestamp >= endTimeUnixTimestampRestriction) {
                            chargingPeriods.push([
                                startLocalUnixTimestamp, endTimeUnixTimestampRestriction
                            ])
                        }
                    }
                } else {
                    // I actually think that we can't have end_time without start_time and vice versa, but I'll assume in this case that end_time is midnight of next day
                    let restrictionEndDateTime = moment.utc(`${moment.utc(localStartDate).add(1, 'days').format()}`, "YYYY-MM-DD").format()

                    // Restrictions Unix Time Stamp
                    let endTimeUnixTimestampRestriction = Date.parse(restrictionEndDateTime)

                    if (startLocalUnixTimestamp <= startTimeUnixTimestampRestriction && endLocalUnixTimestamp <= startTimeUnixTimestampRestriction) {
                        isValid = false
                    } else if (startLocalUnixTimestamp >= endTimeUnixTimestampRestriction && endLocalUnixTimestamp >= endTimeUnixTimestampRestriction) {
                        isValid = false
                    } else {
                        if (startLocalUnixTimestamp <= startTimeUnixTimestampRestriction && endLocalUnixTimestamp >= endTimeUnixTimestampRestriction) {
                            chargingPeriods.push([
                                startTimeUnixTimestampRestriction, endTimeUnixTimestampRestriction
                            ])

                        } else if (startLocalUnixTimestamp >= startTimeUnixTimestampRestriction && endLocalUnixTimestamp <= endTimeUnixTimestampRestriction) {
                            chargingPeriods.push([
                                startLocalUnixTimestamp, endLocalUnixTimestamp
                            ])
                        } else if (startLocalUnixTimestamp <= startTimeUnixTimestampRestriction && endLocalUnixTimestamp > startTimeUnixTimestampRestriction) {
                            chargingPeriods.push([
                                startTimeUnixTimestampRestriction, endLocalUnixTimestamp
                            ])
                        } else if (startLocalUnixTimestamp < endTimeUnixTimestampRestriction && endLocalUnixTimestamp >= endTimeUnixTimestampRestriction) {
                            chargingPeriods.push([
                                startLocalUnixTimestamp, endTimeUnixTimestampRestriction
                            ])
                        }
                    }
                }
            }
            // END_TIME_RESTRICTION
            if ('end_time' in restrictions && restrictions['end_time'] !== null && restrictions['end_time'] !== undefined) {

                if (!('start_time' in restrictions) || restrictions['start_time'] === null || restrictions['start_time'] === undefined) {
                    // I actually think that we can't have end_time without start_time and vice versa, but I'll assume in this case that start_time is midnight of the current day
                    let restrictionStartDateTime = moment.utc(`${restrictions['start_date']}`, "YYYY-MM-DD").format()
                    // Restrictions Unix Time Stamp
                    let startTimeUnixTimestampRestriction = Date.parse(restrictionStartDateTime)

                    let restrictionEndDateTime = moment.utc(`${restrictions['start_date']} ${restrictions["end_time"]}`, "YYYY-MM-DD HH:mm").format()

                    // Restrictions Unix Time Stamp
                    let endTimeUnixTimestampRestriction = Date.parse(restrictionEndDateTime)

                    if (endTimeUnixTimestampRestriction < endLocalUnixTimestamp) {
                        endTimeUnixTimestampRestriction += 24 * 3600 * 1000 //adding 24 hours
                    }

                    if (startLocalUnixTimestamp <= startTimeUnixTimestampRestriction && endLocalUnixTimestamp <= startTimeUnixTimestampRestriction) {
                        isValid = false
                    } else if (startLocalUnixTimestamp >= endTimeUnixTimestampRestriction && endLocalUnixTimestamp >= endTimeUnixTimestampRestriction) {
                        isValid = false
                    } else {
                        if (startLocalUnixTimestamp <= startTimeUnixTimestampRestriction && endLocalUnixTimestamp >= endTimeUnixTimestampRestriction) {
                            chargingPeriods.push([
                                startTimeUnixTimestampRestriction, endTimeUnixTimestampRestriction
                            ])

                        } else if (startLocalUnixTimestamp >= startTimeUnixTimestampRestriction && endLocalUnixTimestamp <= endTimeUnixTimestampRestriction) {
                            chargingPeriods.push([
                                startLocalUnixTimestamp, endLocalUnixTimestamp
                            ])
                        } else if (startLocalUnixTimestamp <= startTimeUnixTimestampRestriction && endLocalUnixTimestamp > startTimeUnixTimestampRestriction) {
                            chargingPeriods.push([
                                startTimeUnixTimestampRestriction, endLocalUnixTimestamp
                            ])
                        } else if (startLocalUnixTimestamp < endTimeUnixTimestampRestriction && endLocalUnixTimestamp >= endTimeUnixTimestampRestriction) {
                            chargingPeriods.push([
                                startLocalUnixTimestamp, endTimeUnixTimestampRestriction
                            ])
                        }
                    }
                }
            }

            // START_DATE_RESTRICTION
            if ('start_date' in restrictions && restrictions['start_date'] !== null && restrictions['start_date'] !== undefined) {
                let restrictionStartDate = moment.utc(`${restrictions["start_date"]}`, "YYYY-MM-DD").format()
                // Restrictions Unix Time Stamp
                let startDateUnixTimestampRestriction = Date.parse(restrictionStartDate)

                // Local Start Date set to midnight
                let localMomentStartDate = moment.utc(`${localStartDate}}`, "YYYY-MM-DD").format()

                if ('end_date' in restrictions && restrictions['end_date'] !== null && restrictions['end_date'] !== undefined) {
                    let restrictionEndDate = moment.utc(`${restrictions["end_date"]}`, "YYYY-MM-DD").format()

                    // Restrictions Unix Time Stamp
                    let endDateUnixTimestampRestriction = Date.parse(restrictionEndDate)

                    // Local End Date set to midnight
                    let localMomentEndDate = moment.utc(`${localEndDate}}`, "YYYY-MM-DD").format()

                    // end_date -> tariff valid until this day (excluding this day)
                    if (startLocalUnixTimestamp <= startDateUnixTimestampRestriction && endLocalUnixTimestamp <= startDateUnixTimestampRestriction) {
                        isValid = false
                    } else if (startLocalUnixTimestamp >= endDateUnixTimestampRestriction && endLocalUnixTimestamp >= endDateUnixTimestampRestriction) {
                        isValid = false
                    } else {
                        if (startLocalUnixTimestamp <= startDateUnixTimestampRestriction && endLocalUnixTimestamp >= endDateUnixTimestampRestriction) {
                            chargingPeriods.push([
                                startDateUnixTimestampRestriction, endDateUnixTimestampRestriction
                            ])

                        } else if (startLocalUnixTimestamp >= startDateUnixTimestampRestriction && endLocalUnixTimestamp < endDateUnixTimestampRestriction) {
                            chargingPeriods.push([
                                startLocalUnixTimestamp, endLocalUnixTimestamp
                            ])
                        } else if (startLocalUnixTimestamp <= startDateUnixTimestampRestriction && endLocalUnixTimestamp > startDateUnixTimestampRestriction) {
                            chargingPeriods.push([
                                startDateUnixTimestampRestriction, endLocalUnixTimestamp
                            ])
                        } else if (startLocalUnixTimestamp < endDateUnixTimestampRestriction && endLocalUnixTimestamp >= endDateUnixTimestampRestriction) {
                            chargingPeriods.push([
                                startLocalUnixTimestamp, endDateUnixTimestampRestriction
                            ])
                        }
                    }
                } else {
                    let restrictionEndDate = moment.utc(`${moment.utc(localEndDate).add(1, 'days').format()}`, "YYYY-MM-DD").format()

                    // Restrictions Unix Time Stamp
                    let endDateUnixTimestampRestriction = Date.parse(restrictionEndDate)

                    // Local End Date set to midnight
                    let localMomentEndDate = moment.utc(`${localEndDate}}`, "YYYY-MM-DD").format()

                    // end_date -> tariff valid until this day (excluding this day)

                    if (startLocalUnixTimestamp <= startDateUnixTimestampRestriction && endLocalUnixTimestamp <= startDateUnixTimestampRestriction) {
                        isValid = false
                    } else if (startLocalUnixTimestamp >= endDateUnixTimestampRestriction && endLocalUnixTimestamp >= endDateUnixTimestampRestriction) {
                        isValid = false
                    } else {
                        if (startLocalUnixTimestamp <= startDateUnixTimestampRestriction && endLocalUnixTimestamp >= endDateUnixTimestampRestriction) {
                            chargingPeriods.push([
                                startDateUnixTimestampRestriction, endDateUnixTimestampRestriction
                            ])

                        } else if (startLocalUnixTimestamp >= startDateUnixTimestampRestriction && endLocalUnixTimestamp < endDateUnixTimestampRestriction) {
                            chargingPeriods.push([
                                startLocalUnixTimestamp, endLocalUnixTimestamp
                            ])
                        } else if (startLocalUnixTimestamp <= startDateUnixTimestampRestriction && endLocalUnixTimestamp > startDateUnixTimestampRestriction) {
                            chargingPeriods.push([
                                startDateUnixTimestampRestriction, endLocalUnixTimestamp
                            ])
                        } else if (startLocalUnixTimestamp < endDateUnixTimestampRestriction && endLocalUnixTimestamp >= endDateUnixTimestampRestriction) {
                            chargingPeriods.push([
                                startLocalUnixTimestamp, endDateUnixTimestampRestriction
                            ])
                        }
                    }
                }
            }
            // END_DATE_RESTRICTION
            if ('end_date' in restrictions && restrictions['end_date'] !== null && restrictions['end_date'] !== undefined) {

                if (!('start_date' in restrictions) || restrictions['start_date'] === null || restrictions['start_date'] === undefined) {
                    let restrictionStartDate = moment.utc(`${localStartDate}`, "YYYY-MM-DD").format()
                    // Restrictions Unix Time Stamp
                    let startDateUnixTimestampRestriction = Date.parse(restrictionStartDate)

                    // Local Start Date set to midnight
                    let localMomentStartDate = moment.utc(`${localStartDate}}`, "YYYY-MM-DD").format()


                    let restrictionEndDate = moment.utc(`${restrictions["end_date"]}`, "YYYY-MM-DD").format()

                    // Restrictions Unix Time Stamp
                    let endDateUnixTimestampRestriction = Date.parse(restrictionEndDate)

                    // Local End Date set to midnight
                    let localMomentEndDate = moment.utc(`${localEndDate}}`, "YYYY-MM-DD").format()

                    // end_date -> tariff valid until this day (excluding this day)
                    if (startLocalUnixTimestamp <= startDateUnixTimestampRestriction && endLocalUnixTimestamp <= startDateUnixTimestampRestriction) {
                        isValid = false
                    } else if (startLocalUnixTimestamp >= endDateUnixTimestampRestriction && endLocalUnixTimestamp >= endDateUnixTimestampRestriction) {
                        isValid = false
                    } else {
                        if (startLocalUnixTimestamp <= startDateUnixTimestampRestriction && endLocalUnixTimestamp >= endDateUnixTimestampRestriction) {
                            chargingPeriods.push([
                                startDateUnixTimestampRestriction, endDateUnixTimestampRestriction
                            ])

                        } else if (startLocalUnixTimestamp >= startDateUnixTimestampRestriction && endLocalUnixTimestamp < endDateUnixTimestampRestriction) {
                            chargingPeriods.push([
                                startLocalUnixTimestamp, endLocalUnixTimestamp
                            ])
                        } else if (startLocalUnixTimestamp <= startDateUnixTimestampRestriction && endLocalUnixTimestamp > startDateUnixTimestampRestriction) {
                            chargingPeriods.push([
                                startDateUnixTimestampRestriction, endLocalUnixTimestamp
                            ])
                        } else if (startLocalUnixTimestamp < endDateUnixTimestampRestriction && endLocalUnixTimestamp >= endDateUnixTimestampRestriction) {
                            chargingPeriods.push([
                                startLocalUnixTimestamp, endDateUnixTimestampRestriction
                            ])
                        }
                    }
                }
            }
            /*
               In this scenario we assume the power is always the same throughout the session, so, we can extrapolate charging periods based on consumed kwh
           */
            // MIN_KWH_RESTRICTION
            if ('min_kwh' in restrictions && restrictions['min_kwh'] !== null && restrictions['min_kwh'] !== undefined) {
                if (consumedPower < restrictions["min_kwh"]) {
                    isValid = false
                } else {
                    if ('max_kwh' in restrictions && restrictions['max_kwh'] !== null && restrictions['max_kwh'] !== undefined) {
                        if (consumedPower >= restrictions["max_kwh"]) {
                            periodConsumedPower = restrictions["max_kwh"] - restrictions["min_kwh"]
                            let lowerLimit = Utils.round((restrictions["min_kwh"] * Utils.round((totalChargingTime * 1000 / consumedPower), 6)), 0)
                            let upperLimit = Utils.round((restrictions["max_kwh"] * Utils.round((totalChargingTime * 1000 / consumedPower), 6)), 0)
                            chargingPeriods.push([
                                startLocalUnixTimestamp + lowerLimit, startLocalUnixTimestamp + upperLimit
                            ])
                        } else {
                            periodConsumedPower = consumedPower - restrictions["min_kwh"]
                            let lowerLimit = Utils.round((restrictions["min_kwh"] * Utils.round((totalChargingTime * 1000 / consumedPower), 6)), 0)
                            let upperLimit = Utils.round((totalChargingTime * 1000), 0)
                            chargingPeriods.push([
                                startLocalUnixTimestamp + lowerLimit, startLocalUnixTimestamp + upperLimit
                            ])
                        }
                    } else {
                        periodConsumedPower = consumedPower - restrictions["min_kwh"]
                        let lowerLimit = Utils.round((restrictions["min_kwh"] * Utils.round((totalChargingTime * 1000 / consumedPower), 6)), 0)
                        let upperLimit = Utils.round((totalChargingTime * 1000), 0)
                        chargingPeriods.push([
                            startLocalUnixTimestamp + lowerLimit, startLocalUnixTimestamp + upperLimit
                        ])
                    }
                }
            }
            // MAX_KWH_RESTRICTION
            if ('max_kwh' in restrictions && restrictions['max_kwh'] !== null && restrictions['max_kwh'] !== undefined) {
                if (!('min_kwh' in restrictions) || restrictions['min_kwh'] === null || restrictions['min_kwh'] === undefined) {
                    if (consumedPower >= restrictions["max_kwh"]) {
                        periodConsumedPower = restrictions["max_kwh"]
                        let upperLimit = Utils.round(restrictions["max_kwh"] * Utils.round((totalChargingTime * 1000 / consumedPower), 6), 0)
                        chargingPeriods.push([
                            startLocalUnixTimestamp, startLocalUnixTimestamp + upperLimit
                        ])

                    } else {
                        periodConsumedPower = consumedPower
                        let upperLimit = Utils.round((totalChargingTime * 1000), 0)
                        chargingPeriods.push([
                            startLocalUnixTimestamp, startLocalUnixTimestamp + upperLimit
                        ])
                    }
                }
            }
            //MIN_POWER_RESTRICTION
            if ('min_power' in restrictions && restrictions['min_power'] !== null && restrictions['min_power'] !== undefined) {
                if (plugPower < restrictions['min_power']) {
                    isValid = false
                } else {
                    if ('max_power' in restrictions) {
                        if (plugPower >= restrictions['max_power']) {
                            isValid = false
                        }
                    }
                }
            }

            //MAX_POWER_RESTRICTION
            if ('max_power' in restrictions && restrictions['max_power'] !== null && restrictions['max_power'] !== undefined) {
                if (plugPower >= restrictions['max_power']) {
                    isValid = false
                }
            }

            //MIN_DURATION_RESTRICTION
            if ('min_duration' in restrictions && restrictions['min_duration'] !== null && restrictions['min_duration'] !== undefined) {
                if (component.type === 'TIME') {
                    if (totalChargingTime < restrictions['min_duration']) {
                        isValid = false
                    } else {
                        if ('max_duration' in restrictions && restrictions['max_duration'] !== null && restrictions['max_duration'] !== undefined) {

                            if (totalChargingTime >= restrictions['max_duration']) {
                                periodConsumedTime = restrictions['max_duration'] - restrictions['min_duration']
                                chargingPeriods.push([
                                    startLocalUnixTimestamp + restrictions['min_duration'] * 1000, startLocalUnixTimestamp + restrictions['min_duration'] * 1000 + Utils.round((periodConsumedTime * 1000), 0)
                                ])
                            } else {
                                periodConsumedTime = totalChargingTime - restrictions['min_duration']
                                chargingPeriods.push([
                                    startLocalUnixTimestamp + restrictions['min_duration'] * 1000, startLocalUnixTimestamp + restrictions['min_duration'] * 1000 + Utils.round((periodConsumedTime * 1000), 0)
                                ])
                            }
                        } else {
                            periodConsumedTime = totalChargingTime - restrictions['min_duration']
                            chargingPeriods.push([
                                startLocalUnixTimestamp + restrictions['min_duration'] * 1000, startLocalUnixTimestamp + restrictions['min_duration'] * 1000 + Utils.round((periodConsumedTime * 1000), 0)
                            ])
                        }
                    }
                } else if (component.type === 'PARKING_TIME') {
                    if (totalParkingTime < restrictions['min_duration']) {
                        isValid = false
                    } else {
                        if ('max_duration' in restrictions && restrictions['max_duration'] !== null && restrictions['max_duration'] !== undefined) {
                            if (totalParkingTime >= restrictions['max_duration']) {
                                periodConsumedParkingTime = restrictions['max_duration'] - restrictions['min_duration']
                                chargingPeriods.push([
                                    startLocalUnixTimestamp + restrictions['min_duration'] * 1000, startLocalUnixTimestamp + restrictions['min_duration'] * 1000 + Utils.round((periodConsumedParkingTime * 1000), 0)
                                ])
                            } else {

                                periodConsumedParkingTime = totalParkingTime - restrictions['min_duration']

                                chargingPeriods.push([
                                    startLocalUnixTimestamp + restrictions['min_duration'] * 1000, startLocalUnixTimestamp + restrictions['min_duration'] * 1000 + Utils.round((periodConsumedParkingTime * 1000), 0)
                                ])

                            }
                        } else {
                            periodConsumedParkingTime = totalParkingTime - restrictions['min_duration']
                            chargingPeriods.push([
                                startLocalUnixTimestamp + restrictions['min_duration'] * 1000, startLocalUnixTimestamp + restrictions['min_duration'] * 1000 + Utils.round((periodConsumedParkingTime * 1000), 0)
                            ])

                        }
                    }
                } else if (component.type === 'ENERGY') {
                    if (totalChargingTime < restrictions['min_duration']) {
                        isValid = false
                    } else {
                        if ('max_duration' in restrictions && restrictions['max_duration'] !== null && restrictions['max_duration'] !== undefined) {
                            if (totalChargingTime >= restrictions['max_duration']) {
                                periodConsumedTime = restrictions['max_duration'] - restrictions['min_duration']
                                chargingPeriods.push([
                                    startLocalUnixTimestamp + restrictions['min_duration'] * 1000, startLocalUnixTimestamp + restrictions['min_duration'] * 1000 + Utils.round((periodConsumedTime * 1000), 0)
                                ])
                            } else {
                                periodConsumedTime = totalChargingTime - restrictions['min_duration']
                                chargingPeriods.push([
                                    startLocalUnixTimestamp + restrictions['min_duration'] * 1000, startLocalUnixTimestamp + restrictions['min_duration'] * 1000 + Utils.round((periodConsumedTime * 1000), 0)
                                ])
                            }
                        } else {
                            periodConsumedTime = totalChargingTime - restrictions['min_duration']
                            chargingPeriods.push([
                                startLocalUnixTimestamp + restrictions['min_duration'] * 1000, startLocalUnixTimestamp + restrictions['min_duration'] * 1000 + Utils.round((periodConsumedTime * 1000), 0)
                            ])
                        }
                    }
                }
            }
            //MAX_DURATION_RESTRICTION
            if ('max_duration' in restrictions && restrictions['max_duration'] !== null && restrictions['max_duration'] !== undefined) {
                if (!('min_duration' in restrictions) || restrictions['min_duration'] === null || restrictions['min_duration'] === undefined) {
                    if (component.type === 'TIME') {
                        if (totalChargingTime >= restrictions['max_duration']) {
                            periodConsumedTime = restrictions['max_duration']
                            chargingPeriods.push([
                                startLocalUnixTimestamp, startLocalUnixTimestamp + Utils.round((periodConsumedTime * 1000), 0)
                            ])
                        } else {
                            periodConsumedTime = totalChargingTime
                            chargingPeriods.push([
                                startLocalUnixTimestamp, startLocalUnixTimestamp + Utils.round((periodConsumedTime * 1000), 0)
                            ])
                        }
                    } else if (component.type === 'PARKING_TIME') {
                        if (totalParkingTime >= restrictions['max_duration']) {
                            periodConsumedParkingTime = restrictions['max_duration']
                            chargingPeriods.push([
                                startLocalUnixTimestamp, startLocalUnixTimestamp + Utils.round((periodConsumedTime * 1000), 0)
                            ])
                        } else {
                            periodConsumedParkingTime = totalParkingTime
                            chargingPeriods.push([
                                startLocalUnixTimestamp, startLocalUnixTimestamp + Utils.round((periodConsumedTime * 1000), 0)
                            ])
                        }
                    } else if (component.type === 'ENERGY') {
                        if (totalChargingTime >= restrictions['max_duration']) {
                            periodConsumedTime = restrictions['max_duration']
                            chargingPeriods.push([
                                startLocalUnixTimestamp, startLocalUnixTimestamp + Utils.round((periodConsumedTime * 1000), 0)
                            ])
                        } else {
                            periodConsumedTime = totalChargingTime
                            chargingPeriods.push([
                                startLocalUnixTimestamp, startLocalUnixTimestamp + Utils.round((periodConsumedTime * 1000), 0)
                            ])
                        }
                    }
                }
            }

            if (chargingPeriods.length > 1) {
                [isValid, chargingPeriods] = this.validateChargingPeriodsArray(chargingPeriods, isValid)
            }
            chargingPeriods = chargingPeriods.length === 0 ? [Date.parse(startDate), Date.parse(endDate)] : this.getSmallestPeriod(chargingPeriods)

            periodConsumedTime = (chargingPeriods[1] - chargingPeriods[0]) / 1000 < periodConsumedTime ? (chargingPeriods[1] - chargingPeriods[0]) / 1000 : periodConsumedTime,
                periodConsumedParkingTime = (chargingPeriods[1] - chargingPeriods[0]) / 1000 < periodConsumedParkingTime ? (chargingPeriods[1] - chargingPeriods[0]) / 1000 : periodConsumedParkingTime

            tariffsObj[component.type] = {
                isValid,
                chargingPeriods,
                periodConsumedPower,
                periodConsumedTime,
                periodConsumedParkingTime,
                component: component,
                restrictions: restrictions
            }
        }

        return tariffsObj
    },
    getSmallestPeriod: function (chargingPeriods) {
        let intervals = chargingPeriods.map(period => {
            return period[1] - period[0]
        })

        let minValue = Math.min(...intervals)

        return chargingPeriods[intervals.indexOf(minValue)]
    },
    getPushPeriods: function (tariffChargingPeriod, chargingPeriods) {
        /*
            This function takes all available charging periods and, if they overlap each other, divides them into smaller chunks, according to priority
        */

        let pushPeriods = [tariffChargingPeriod]
        chargingPeriods.forEach((period) => {
            let priorityPeriod = period.tariffChargingPeriod
            for (let pushingIndex = 0; pushingIndex < pushPeriods.length; pushingIndex++) {
                let pushPeriod = pushPeriods[pushingIndex]

                if (pushPeriod[0] < priorityPeriod[0] && pushPeriod[1] > priorityPeriod[1]) {
                    pushPeriods.splice(pushingIndex, 1, [pushPeriod[0], priorityPeriod[0]], [priorityPeriod[1], pushPeriod[1]])
                } else if (pushPeriod[0] < priorityPeriod[0] && pushPeriod[1] >= priorityPeriod[0]) {
                    pushPeriods.splice(pushingIndex, 1, [pushPeriod[0], priorityPeriod[0]])
                } else if (pushPeriod[0] <= priorityPeriod[1] && pushPeriod[1] > priorityPeriod[1]) {
                    pushPeriods.splice(pushingIndex, 1, [priorityPeriod[1], pushPeriod[1]])
                } else if (pushPeriod[0] >= priorityPeriod[0] && pushPeriod[1] <= priorityPeriod[1]) {
                    pushPeriods.splice(pushingIndex, 1)
                }
            }
        })
        return pushPeriods
    },
    validateChargingPeriodsArray: function (chargingPeriods, isValid) {
        let intervals = chargingPeriods.map((period, index) => {
            return [index, period[1] - period[0]]
        })

        let sortedIntervals = intervals.sort(function (a, b) {
            return b[1] - a[1];
        });

        let sortedPeriods = sortedIntervals.map((array => { return chargingPeriods[array[0]] }))

        for (let index = 0; index < sortedPeriods.length; index++) {
            if (index !== sortedPeriods.length - 1) {
                let currentInterval = sortedPeriods[index]
                let nextInterval = sortedPeriods[index + 1]

                if (nextInterval[0] < currentInterval[0] && nextInterval[1] <= currentInterval[0]) {
                    isValid = false
                    break
                } else if (nextInterval[0] >= currentInterval[1] && nextInterval[1] > currentInterval[1]) {
                    isValid = false
                    break
                } else if (nextInterval[0] <= currentInterval[0] && nextInterval[1] >= currentInterval[1]) {
                    sortedPeriods.splice(index + 1, 1)
                    index--
                } else if (nextInterval[0] >= currentInterval[0] && nextInterval[1] <= currentInterval[1]) {
                    sortedPeriods.splice(index, 1)
                    index--
                } else if (nextInterval[0] <= currentInterval[0] && nextInterval[1] > currentInterval[0]) {
                    sortedPeriods.splice(index, 1, [currentInterval[0], nextInterval[1]])
                    index--
                } else if (nextInterval[0] < currentInterval[1] && nextInterval[1] >= currentInterval[1]) {
                    sortedPeriods.splice(index, 1, [nextInterval[0], currentInterval[1]])
                    index--
                }
            }
        }
        return [isValid, sortedPeriods]
    },
    pushTariffsToChargingPeriods: function (tariffObj, chargingPeriodsObj) {
        for (let tariffType in tariffObj) {
            let tariff = tariffObj[tariffType]
            if (tariff.isValid) {
                if (chargingPeriodsObj[tariffType].length === 0) {
                    chargingPeriodsObj[tariffType].push({
                        periodConsumedPower: tariff.periodConsumedPower,
                        periodConsumedTime: tariff.periodConsumedTime,
                        periodConsumedParkingTime: tariff.periodConsumedParkingTime,
                        tariffChargingPeriod: tariff.chargingPeriods,
                        component: tariff.component,
                        restrictions: tariff.restrictions,
                    })
                } else {
                    // The first tariffs appearing in array have always priority over the next ones if they eventually overlap in time periods
                    let pushPeriods = this.getPushPeriods(tariff.chargingPeriods, chargingPeriodsObj[tariffType])
                    if (pushPeriods.length > 0) {
                        pushPeriods.forEach(period => {
                            chargingPeriodsObj[tariffType].push({
                                periodConsumedPower: tariff.periodConsumedPower,
                                periodConsumedTime: (period[1] - period[0]) / 1000 < tariff.periodConsumedTime ? (period[1] - period[0]) / 1000 : tariff.periodConsumedTime,
                                periodConsumedParkingTime: (period[1] - period[0]) / 1000 < tariff.periodConsumedParkingTime ? (period[1] - period[0]) / 1000 : tariff.periodConsumedParkingTime,
                                tariffChargingPeriod: period,
                                component: tariff.component,
                                restrictions: tariff.restrictions,
                            })
                        })
                    }
                }
            }
        }

        return chargingPeriodsObj

    },
    calculateOpcPrice: function (type, chargingPeriodsObj, consumedPower_s, source) {
        let dimensionArray = chargingPeriodsObj[type]
        let price = 0
        let chargingPeriodsInfo = []

        if (dimensionArray.length > 0) {
            if (type === "FLAT") {
                // price = dimensionArray[0].component.price
                dimensionArray.forEach(element => {
                    price += element.component.price
                    chargingPeriodsInfo.push({
                        quantity: 1,
                        unit: "UN",
                        cost: element.component.price,
                        componentPrice: element.component.price,
                        componentStepSize: element.component.step_size,
                        component: element.component,
                        restrictions: element.restrictions,
                        source,
                    })

                })
            } else if (type === "ENERGY") {
                dimensionArray.forEach(element => {
                    element.component.step_size = element.component.step_size !== null && element.component.step_size !== undefined ? element.component.step_size : 1
                    let { priceRoundGranularity, priceRoundRule, stepRoundGranularity, stepRoundRule } = this.roundingsValidation(element.component)
                    if (source === global.girevePlatformCode || source === global.hubjectPlatformCode) {
                        element.component.price = Utils.roundingGranularityRules(priceRoundGranularity, priceRoundRule, element.component.price)
                        element.component.step_size = Utils.roundingGranularityRules(stepRoundGranularity, stepRoundRule, element.component.step_size)
                    }
                    if (element.periodConsumedPower !== 0) {
                        //TODO : I was rounding 6 digits and not 2. Due to step size I needed to reduce this value. Can't remember why it was used 6 in the first place.
                        price += this.getEnergyPrice(Utils.round(element.periodConsumedPower, 6), element.component.price, element.component.step_size)
                        chargingPeriodsInfo.push({
                            quantity: Utils.round(element.periodConsumedPower , 6),
                            unit : "kWh",
                            cost: this.getEnergyPrice(Utils.round(element.periodConsumedPower , 6), element.component.price, element.component.step_size),
                            componentPrice : element.component.price,
                            componentStepSize : element.component.step_size,
                            component: element.component,
                            restrictions: element.restrictions,
                            source,
                        })
                    } else {
                        let periodConsumedPower = Utils.round((consumedPower_s * (element.tariffChargingPeriod[1] - element.tariffChargingPeriod[0]) / 1000), 6)
                        price += this.getEnergyPrice(periodConsumedPower, element.component.price, element.component.step_size)
                        chargingPeriodsInfo.push({
                            quantity: periodConsumedPower,
                            unit: "kWh",
                            cost: this.getEnergyPrice(periodConsumedPower, element.component.price, element.component.step_size),
                            componentPrice: element.component.price,
                            componentStepSize: element.component.step_size,
                            component: element.component,
                            restrictions: element.restrictions,
                            source,
                        })
                    }

                })
            } else if (type === "TIME") {
                dimensionArray.forEach(element => {
                    element.component.step_size = element.component.step_size !== null && element.component.step_size !== undefined ? element.component.step_size : 1
                    let { priceRoundGranularity, priceRoundRule, stepRoundGranularity, stepRoundRule } = this.roundingsValidation(element.component)
                    if (source === global.girevePlatformCode || source === global.hubjectPlatformCode) {
                        element.component.price = Utils.roundingGranularityRules(priceRoundGranularity, priceRoundRule, element.component.price)
                        element.component.step_size = Utils.roundingGranularityRules(stepRoundGranularity, stepRoundRule, element.component.step_size)
                    }
                    price += this.getTimePrice(element.periodConsumedTime / 3600, element.component.price, element.component.step_size, source)
                    chargingPeriodsInfo.push({
                        quantity: element.periodConsumedTime,
                        unit: "s",
                        cost: this.getTimePrice(element.periodConsumedTime / 3600, element.component.price, element.component.step_size, source),
                        componentPrice: element.component.price,
                        componentStepSize: element.component.step_size,
                        component: element.component,
                        restrictions: element.restrictions,
                        source,
                    })

                })
            } else if (type === "PARKING_TIME") {
                dimensionArray.forEach(element => {
                    element.component.step_size = element.component.step_size !== null && element.component.step_size !== undefined ? element.component.step_size : 1
                    let { priceRoundGranularity, priceRoundRule, stepRoundGranularity, stepRoundRule } = this.roundingsValidation(element.component)
                    if (source === global.girevePlatformCode || source === global.HubjectPlatformCode) {
                        element.component.price = Utils.roundingGranularityRules(priceRoundGranularity, priceRoundRule, element.component.price)
                        element.component.step_size = Utils.roundingGranularityRules(stepRoundGranularity, stepRoundRule, element.component.step_size)
                    }
                    price += this.getTimePrice(element.periodConsumedParkingTime / 3600, element.component.price, element.component.step_size, source)
                    chargingPeriodsInfo.push({
                        quantity: element.periodConsumedParkingTime,
                        unit: "s",
                        cost: this.getTimePrice(element.periodConsumedParkingTime / 3600, element.component.price, element.component.step_size, source),
                        componentPrice: element.component.price,
                        componentStepSize: element.component.step_size,
                        component: element.component,
                        restrictions: element.restrictions,
                        source,
                    })
                })
            }
        }

        return [price, chargingPeriodsInfo]
    },
    getChargerOffset: function (timeZone, countryCode, latitude = null, longitude = null) {
        let offset = 0
        // IANA tzdata’s TZ-values representing the time zone of the location.
        if (latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined) {
            timeZone = geoTimeZone.find(latitude, longitude)[0]
        }
        if (typeof timeZone !== 'undefined' && timeZone !== null) {
            offset = timeZoneMoment.tz(timeZone)._offset
        } else {
            /*
                this method returns negative offsets as it counts the offset of utc to this timezone

                I'm also retrieving the last value assuming that there's only one timezone for each country. In europe works kinda well,
                although there are countries like Spain and Portugal that have more than one timezone because of the Azores(Portugal), Madeira (Portugal) and Canary islands (Spain)
            */
            let countryTimeZones = timeZoneMoment.tz.zonesForCountry(countryCode, true)
            offset = -countryTimeZones[countryTimeZones.length - 1].offset
        }

        return offset
    },
    getInvoiceLinesRoaming: function (cdr, userId, chargingSession, flat, energy, time, parking) {
        return new Promise(async (resolve, reject) => {
            let invoiceLines = [];

            let total_parking_time = (typeof cdr.total_parking_time !== "undefined" && cdr.total_parking_time !== null) ? cdr.total_parking_time : 0
            let totalTimeConsumed_h = cdr.total_time - total_parking_time
            let vat = chargingSession?.fees?.IVA ?? await vatService.getVATwithViesVAT(chargingSession); //Iva

            // ========== CEME ==========
            let CEME_FLAT = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "flat")
            let CEME_POWER = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "energy")
            let CEME_TIME = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "time")
            let CEME_PERCENTAGE = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "percentage")

            // for Hubject
            let CEME_START_PERCENTAGE = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "start_percentage")
            let CEME_ENERGY_PERCENTAGE = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "energy_percentage")
            let CEME_TIME_PERCENTAGE = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "time_percentage")

            let CEME_Price_FLAT = CEME_FLAT ? CEME_FLAT.price : 0
            let CEME_Price_POWER = CEME_POWER ? CEME_POWER.price : 0
            let CEME_Price_TIME = CEME_TIME ? CEME_TIME.price : 0
            let evioPercentage = CEME_PERCENTAGE ? CEME_PERCENTAGE.price : 0
            let evioStartPercentage = CEME_START_PERCENTAGE ? CEME_START_PERCENTAGE.price : 0
            let evioEnergyPercentage = CEME_ENERGY_PERCENTAGE ? CEME_ENERGY_PERCENTAGE.price : 0
            let evioTimePercentage = CEME_TIME_PERCENTAGE ? CEME_TIME_PERCENTAGE.price : 0

            let totalTimeConsumed = totalTimeConsumed_h
            if (CEME_TIME && CEME_TIME.uom.includes('min')) {
                totalTimeConsumed = totalTimeConsumed_h * 60
            } else if (CEME_TIME && CEME_TIME.uom.includes('s')) {
                totalTimeConsumed = totalTimeConsumed_h * 3600
            }

            let minimumBillingConditions = true
            if (
                // (totalTimeConsumed_h * 3600 <= Number(process.env.MinimumChargingTimeToBilling)) ||
                (cdr.total_energy * 1000 <= Number(process.env.MinimumEnergyToBillingGireve))
            ) {
                minimumBillingConditions = false
            }

            let networkCommission = chargingSession.source == "Hubject" ? process.env.HubjectCommission : process.env.GireveCommission

            // let OPC_Price = cdr.total_cost.excl_vat
            let OPC_Price = this.round(flat.price) + this.round(energy.price) + this.round(time.price) + this.round(parking.price)
            let CEME_Price = this.round(CEME_Price_FLAT) + this.round(CEME_Price_POWER * cdr.total_energy) + this.round(CEME_Price_TIME * totalTimeConsumed);
            let totalRoamingCost = this.round(OPC_Price) + this.round(CEME_Price) + this.round(evioPercentage * OPC_Price) + this.round(Number(networkCommission)) + this.round(Number(evioStartPercentage * flat.price)) + this.round(Number(evioEnergyPercentage * energy.price)) + this.round(Number(evioTimePercentage * time.price))
            //eMSP

            //TODO This should have a translation key in the description
            let line1_roaming_services = {
                "code": global.Item_OtherNetworks, "description": "Serviços em outras redes", "unitPrice": this.round(totalRoamingCost), "uom": "UN", "quantity": 1, "vat": vat, "discount": 0, "total": 0
            }

            if(vat == 0) {
                line1_roaming_services.taxExemptionReasonCode = Constants.TAX_EXEMPTION_REASON_CODE_M40;
            }

            if (totalRoamingCost > 0 && minimumBillingConditions) {
                invoiceLines.push(line1_roaming_services);
            }

            resolve(invoiceLines);

        });
    },
    processBillingAndPaymentRoaming: function (sessionId, cdr) {
        const context = 'Utils processBillingAndPaymentRoaming'
        let query = { id: sessionId };

        let totalPowerConsumed_Kw = cdr.total_energy;
        let total_parking_time = (typeof cdr.total_parking_time !== "undefined" && cdr.total_parking_time !== null) ? cdr.total_parking_time : 0
        let totalTimeConsumed_h = cdr.total_time - total_parking_time
        this.chargingSessionFindOne(query).then(async (chargingSession) => {

            if (chargingSession) {

                try {
                    const {isDevice = false, deviceType = '' } = Helpers.verifyIsDeviceRequest(chargingSession?.createdWay);
                    chargingSession.start_date_time = new Date(cdr.start_date_time)
                    chargingSession.end_date_time = new Date(cdr.end_date_time)
                    let timeChargedinSeconds = Utils.getChargingTime(moment(cdr.start_date_time), moment(cdr.end_date_time));

                    let CO2emitted = 0;
                    let totalPowerConsumed_W = 0;
                    if (totalPowerConsumed_Kw >= 0) {
                        totalPowerConsumed_W = totalPowerConsumed_Kw * 1000;
                        CO2emitted = this.round(Number(process.env.CarbonIntensity) * totalPowerConsumed_Kw);// Kg CO₂ eq/kWh
                        if (CO2emitted < 0)
                            CO2emitted = 0
                        if (chargingSession.source == process.env.HubjectPlatformCode && chargingSession.roamingCO2) CO2emitted = this.round(Number(chargingSession.roamingCO2) * totalPowerConsumed_Kw)
                    }

                    let minimumBillingConditions = true
                    if (
                        // (timeChargedinSeconds <= Number(process.env.MinimumChargingTimeToBilling)) ||
                        (totalPowerConsumed_W <= Number(process.env.MinimumEnergyToBillingGireve))
                    ) {
                        minimumBillingConditions = false
                    }

                    var VAT_Price = await chargingSession?.fees?.IVA ?? vatService.getVATwithViesVAT(chargingSession); //Iva

                    ////////////////////////////////////////////////
                    //OPC Cost
                    //Calculate OPC Prices

                    // Timezone info to get offset of charger
                    let timeZone = chargingSession.timeZone
                    let countryCode = chargingSession.country_code
                    let offset = this.getChargerOffset(timeZone, countryCode)

                    // Arbitrary power and voltage values
                    let plugVoltage = cdr.cdr_location.connector_voltage
                    let plugAmperage = cdr.cdr_location.connector_amperage
                    let plugPower = (plugVoltage * plugAmperage) / 1000;

                    // Charging periods and chargin opc tariffs
                    let charging_periods = cdr.charging_periods
                    let priceComponents = chargingSession.tariffOPC.elements;

                    if (cdr.tariffs !== null && cdr.tariffs !== undefined && cdr.tariffs.length > 0 && chargingSession.tariffOPC.type !== Enums.OcpiTariffType.User && !isDevice) {
                        priceComponents = this.transformTariffElements(cdr.tariffs[0].elements)
                        priceComponents = this.createTariffElementsAccordingToRestriction(priceComponents, cdr.start_date_time, cdr.end_date_time)
                    } else if (priceComponents !== null && priceComponents !== undefined) {
                        priceComponents = this.createTariffElementsAccordingToRestriction(priceComponents, cdr.start_date_time, cdr.end_date_time)
                    }

                    /*
                        This function calculates the final prices for each dimension. If eventually there's a wrong price, the testTariffs file should be used to test new changes
                        and add more use cases if necessary.

                        Update - > This function also returns a key of information about each dimension. That info contains the amount consumed in each charging period and
                                    other details about the tariff and its restrictions

                    */
                    let [flat, energy, time, parking] = this.opcTariffsPrices(null, priceComponents, cdr.start_date_time, cdr.end_date_time, offset, plugPower, plugVoltage, totalPowerConsumed_Kw, totalTimeConsumed_h, total_parking_time, chargingSession.source)

                    let [
                        OCP_PRICE_FLAT,
                        OCP_PRICE_ENERGY,
                        OCP_PRICE_TIME,
                        OCP_PRICE_PARKING_TIME
                    ] = [flat.price, energy.price, time.price, parking.price]

                    let OPC_Price = minimumBillingConditions ? (this.round(OCP_PRICE_FLAT) + this.round(OCP_PRICE_ENERGY) + this.round(OCP_PRICE_TIME) + this.round(OCP_PRICE_PARKING_TIME)) : 0
                    // let OPC_Price = cdr.total_cost.excl_vat

                    let opcPrice = { excl_vat: this.round(OPC_Price), incl_vat: this.round(OPC_Price + (VAT_Price * OPC_Price)) }
                    let opcFlat = minimumBillingConditions ? OCP_PRICE_FLAT : 0
                    let opcTime = minimumBillingConditions ? OCP_PRICE_TIME : 0
                    let opcPower = minimumBillingConditions ? OCP_PRICE_ENERGY : 0
                    let opcParkingTime = minimumBillingConditions ? OCP_PRICE_PARKING_TIME : 0

                    let opcPriceDetail = {
                        flatPrice: { excl_vat: this.round(opcFlat), incl_vat: this.round(opcFlat + (opcFlat * VAT_Price)) },
                        timePrice: { excl_vat: this.round(opcTime), incl_vat: this.round(opcTime + (opcTime * VAT_Price)) },
                        powerPrice: { excl_vat: this.round(opcPower), incl_vat: this.round(opcPower + (opcPower * VAT_Price)) },
                        parkingTimePrice: { excl_vat: this.round(opcParkingTime), incl_vat: this.round(opcParkingTime + (opcParkingTime * VAT_Price)) }
                    }

                    ////////////////////////////////////////////////
                    //CEME Price
                    let CEME_FLAT = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "flat")
                    let CEME_POWER = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "energy")
                    let CEME_TIME = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "time")
                    let CEME_PERCENTAGE = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "percentage")

                    // for Hubject
                    let CEME_START_PERCENTAGE = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "start_percentage")
                    let CEME_ENERGY_PERCENTAGE = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "energy_percentage")
                    let CEME_TIME_PERCENTAGE = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "time_percentage")


                    let CEME_Price_FLAT = minimumBillingConditions ? (CEME_FLAT ? CEME_FLAT.price : 0) : 0
                    let CEME_Price_POWER = minimumBillingConditions ? (CEME_POWER ? CEME_POWER.price : 0) : 0
                    let CEME_Price_TIME = minimumBillingConditions ? (CEME_TIME ? CEME_TIME.price : 0) : 0
                    let evioPercentage = CEME_PERCENTAGE ? CEME_PERCENTAGE.price : 0
                    let evioStartPercentage = minimumBillingConditions ? (CEME_START_PERCENTAGE ? CEME_START_PERCENTAGE.price : 0) : 0
                    let evioEnergyPercentage = minimumBillingConditions ? (CEME_ENERGY_PERCENTAGE ? CEME_ENERGY_PERCENTAGE.price : 0) : 0
                    let evioTimePercentage = minimumBillingConditions ? (CEME_TIME_PERCENTAGE ? CEME_TIME_PERCENTAGE.price : 0) : 0

                    let totalTimeConsumed = totalTimeConsumed_h
                    if (CEME_TIME && CEME_TIME.uom.includes('min')) {
                        totalTimeConsumed = totalTimeConsumed_h * 60
                    } else if (CEME_TIME && CEME_TIME.uom.includes('s')) {
                        totalTimeConsumed = totalTimeConsumed_h * 3600
                    }

                    //TODO: We should also consider this value, right?
                    ////////////////////////////////////////////////
                    //Other Prices, 0.15€ activation fee

                    // Add Comission for Hubject and Gireve
                    let activationFee = minimumBillingConditions ? (chargingSession.source == "Hubject" ? Number(process.env.HubjectCommission) : Number(process.env.GireveCommission)) : 0

                    let evioPercentageValue = minimumBillingConditions ? evioPercentage * OPC_Price : 0
                    let evioPercentageStartValue = minimumBillingConditions ? evioStartPercentage * OCP_PRICE_FLAT : 0
                    let evioPercentageEnergyValue = minimumBillingConditions ? evioEnergyPercentage * OCP_PRICE_ENERGY : 0
                    let evioPercentageTimeValue = minimumBillingConditions ? evioTimePercentage * OCP_PRICE_TIME : 0

                    let CEME_Price = this.round(CEME_Price_FLAT) + this.round(CEME_Price_POWER * totalPowerConsumed_Kw) + this.round(CEME_Price_TIME * totalTimeConsumed);

                    let cemePrice = { excl_vat: this.round(CEME_Price), incl_vat: this.round(CEME_Price + (VAT_Price * CEME_Price)) }

                    let cemePriceDetail = {
                        flatPrice: { excl_vat: this.round(CEME_Price_FLAT), incl_vat: this.round(CEME_Price_FLAT + (CEME_Price_FLAT * VAT_Price)) },
                        timePrice: { excl_vat: this.round(CEME_Price_TIME * totalTimeConsumed), incl_vat: this.round(CEME_Price_TIME * totalTimeConsumed + (CEME_Price_TIME * totalTimeConsumed * VAT_Price)) },
                        powerPrice: { excl_vat: this.round(CEME_Price_POWER * totalPowerConsumed_Kw), incl_vat: this.round(CEME_Price_POWER * totalPowerConsumed_Kw + (CEME_Price_POWER * totalPowerConsumed_Kw * VAT_Price)) },
                    }

                    var otherPrices = [
                        { description: `${chargingSession.source} Activation Fee ${activationFee}`, price: { excl_vat: this.round(activationFee), incl_vat: this.round(activationFee + (VAT_Price * activationFee)) } }
                    ]

                    if (evioPercentage > 0 || (evioEnergyPercentage == evioTimePercentage && evioEnergyPercentage > 0)) otherPrices.push({ description: `EVIO Percentage ${evioPercentage > 0 ? evioPercentage * 100 : evioEnergyPercentage * 100}%`, price: { excl_vat: this.round(evioPercentage > 0 ? evioPercentageValue : evioPercentageTimeValue + evioPercentageEnergyValue), incl_vat: this.round(evioPercentage > 0 ? evioPercentageValue + (VAT_Price * evioPercentageValue) : evioPercentageEnergyValue + evioPercentageTimeValue + (VAT_Price * evioPercentageEnergyValue)) } })
                    if (evioStartPercentage > 0) otherPrices.push({ description: `EVIO Start Percentage ${evioStartPercentage * 100}%`, price: { excl_vat: this.round(evioPercentageStartValue), incl_vat: this.round(evioPercentageStartValue + (VAT_Price * evioPercentageStartValue)) } })
                    if (evioEnergyPercentage > 0 && evioEnergyPercentage !== evioTimePercentage) otherPrices.push({ description: `EVIO Energy Percentage ${evioEnergyPercentage * 100}%`, price: { excl_vat: this.round(evioPercentageEnergyValue), incl_vat: this.round(evioPercentageEnergyValue + (VAT_Price * evioPercentageEnergyValue)) } })
                    if (evioTimePercentage > 0 && evioEnergyPercentage !== evioTimePercentage) otherPrices.push({ description: `EVIO Time Percentage ${evioTimePercentage * 100}%`, price: { excl_vat: this.round(evioPercentageTimeValue), incl_vat: this.round(evioPercentageTimeValue + (VAT_Price * evioPercentageTimeValue)) } })

                    ////////////////////////////////////////////////
                    //Total Prices

                    let invoiceLines = await this.getInvoiceLinesRoaming(cdr, chargingSession.userIdWillPay, chargingSession, flat, energy, time, parking);
                    let total_exc_vat = 0;
                    let total_inc_vat = 0;
                    invoiceLines.forEach(line => {
                        // total_exc_vat += this.round(line.quantity * line.unitPrice);
                        total_exc_vat += line.quantity * line.unitPrice;
                        // total_inc_vat += line.quantity * line.unitPrice * (1 + line.vat);
                    });
                    const roundedExclVat = this.round(total_exc_vat);
                    const roundedIncVat = this.round(roundedExclVat * (1 + VAT_Price));
                    // total_inc_vat = total_exc_vat + (total_exc_vat * VAT_Price);
                    const totalPrice = { excl_vat: roundedExclVat, incl_vat: roundedIncVat };


                    if (totalPrice?.incl_vat < 0) {
                        minimumBillingConditions = false
                    }

                    const vatPrice = { vat: VAT_Price, value: this.round(roundedIncVat - roundedExclVat) }

                    let finalPrices = {
                        opcPrice: opcPrice,
                        opcPriceDetail: opcPriceDetail,
                        cemePrice: cemePrice,
                        cemePriceDetail: cemePriceDetail,
                        vatPrice: vatPrice,
                        othersPrice: otherPrices,
                        totalPrice: totalPrice
                    }

                    chargingSession.total_cost = totalPrice;
                    chargingSession.finalPrices = finalPrices;
                    console.log("finalPrices", JSON.stringify(finalPrices));

                    let bodySession = {
                        timeCharged: timeChargedinSeconds,
                        totalPower: totalPowerConsumed_W,
                        kwh: totalPowerConsumed_Kw,
                        CO2Saved: CO2emitted,
                        cdrId: cdr.id,
                        start_date_time: cdr.start_date_time,
                        end_date_time: cdr.end_date_time,
                        total_energy: cdr.total_energy,
                        total_cost: totalPrice,
                        finalPrices: finalPrices,
                        invoiceLines: invoiceLines,
                        charging_periods,
                        paymentStatus: 'UNPAID',
                    };

                    const cdrValidationResult = await this.checkToApplyValidationCDR(cdr, bodySession, false);

                    bodySession.status = cdrValidationResult.status;
                    bodySession.suspensionReason = cdrValidationResult.reason;

                    if(chargingSession.start_date_time && chargingSession.timeZone) {
                        bodySession.local_start_date_time = moment(chargingSession.start_date_time).tz(chargingSession.timeZone).format("YYYY-MM-DDTHH:mm:ss");
                        chargingSession.local_start_date_time = bodySession.local_start_date_time
                    }

                    if(chargingSession.end_date_time && chargingSession.timeZone) {
                        bodySession.local_end_date_time = moment(chargingSession.end_date_time).tz(chargingSession.timeZone).format("YYYY-MM-DDTHH:mm:ss");
                        chargingSession.local_end_date_time = bodySession.local_end_date_time
                    }

                    bodySession.minimumBillingConditions = minimumBillingConditions
                    console.log("hasMinimumBillingConditions: ", minimumBillingConditions)

                    this.updateSession(sessionId, bodySession);

                    if (cdrValidationResult.valid && chargingSession.paymentType == "AD_HOC" && chargingSession.paymentMethod != process.env.PaymentMethodTypeTransfer) {
                        //Billing

                        //Call Payments Microservice
                        let bodyPayment = {
                            amount: { currency: cdr.currency, value: minimumBillingConditions ? (totalPrice?.incl_vat >= 0 ? totalPrice.incl_vat : 0) : 0 },
                            userId: chargingSession.userIdWillPay,
                            sessionId: chargingSession._id,
                            listOfSessions: [],
                            hwId: chargingSession.location_id,
                            chargerType: chargingSession.chargerType,
                            paymentMethod: chargingSession.paymentMethod,
                            paymentMethodId: chargingSession.paymentMethodId,
                            transactionId: chargingSession.transactionId,
                            adyenReference: chargingSession.adyenReference,
                            reservedAmount: chargingSession.reservedAmount,
                            clientName: chargingSession.clientName
                        }

                        if(isDevice){
                            const devicesPreAuthorization = new DevicesPreAuthorizationService(deviceType);
                            const isCaptureSuccess = await devicesPreAuthorization.capturePreAuthorization(chargingSession, bodyPayment.amount.value)

                            //If success (40) - Save paymentId and transactionId and change status to PAID
                            //If success (10/20) - Save paymentId and transactionId
                            bodySession.paymentSubStatus = isCaptureSuccess ? "PAID AND WAITING FOR ADYEN NOTIFICATION" : "PAYMENT FAILED FOR ANY REASON";
                            console.log(`Pre-authorization ${deviceType} session capture ${isCaptureSuccess ? 'success' : 'failed' } for session ${chargingSession._id}`);
                            this.updateSession(sessionId, bodySession);
                            sendSessionToHistoryQueue(chargingSession?._id, `${context} - pre-authorization ${deviceType}`);
                        }else{
                            this.makePayment(bodyPayment).then(async (result) => {

                                //If success (40) - Save paymentId and transactionId and change status to PAID
                                //If success (10/20) - Save paymentId and transactionId
                                bodySession.paymentId = result._id;
                                bodySession.transactionId = result.transactionId;

                                //console.log("result payment", result);
                                if (result.status == "40") {
                                    bodySession.paymentStatus = 'PAID';
                                    bodySession.paymentSubStatus = "PAID AND CLOSED";

                                    if (minimumBillingConditions && chargingSession.billingPeriod == "AD_HOC" && totalPrice?.incl_vat >= 0) {
                                    const disabledBillingV2InvoiceOcpi = await toggle.isEnable('billing-v2-invoice-magnifinance-disable');
                                    if(!disabledBillingV2InvoiceOcpi) {
                                        console.info("BillingV2 - feature billing-v2-invoice-magnifinance-disable is disabled, old billing will be used");
                                        Utils.billingRoaming(cdr, chargingSession.userIdToBilling, chargingSession, result._id, invoiceLines, totalPrice, flat, energy, time, parking).then((res) => {
                                            bodySession.invoiceStatus = true;
                                            bodySession.invoiceId = res.invoiceId;
                                            this.updateSession(sessionId, bodySession);
                                            sendSessionToHistoryQueue(chargingSession?._id, `${context} - Billing Roaming - Success`);
                                        }).catch((err) => {
                                            Sentry.captureException(err);
                                            if (err?.response?.data) {
                                                bodySession.invoiceSubStatus = JSON.stringify(err?.response?.data)
                                            } else {
                                                bodySession.invoiceSubStatus = err?.message
                                            }
                                            this.updateSession(sessionId, bodySession);
                                            sendSessionToHistoryQueue(chargingSession?._id, `${context} - Catch Billing Roaming`);
                                        });
                                    }
                                    } else {
                                        console.log("No minimum billing conditions were found")
                                        this.updateSession(sessionId, bodySession);
                                        sendSessionToHistoryQueue(chargingSession?._id, `${context} - No minimum billing conditions were found`);
                                    }
                                }
                                else if (result.status == "10" || result.status == "20") {
                                    bodySession.paymentSubStatus = "PAID AND WAITING FOR ADYEN NOTIFICATION";
                                    this.updateSession(sessionId, bodySession);
                                    sendSessionToHistoryQueue(chargingSession?._id, `${context} - Payment status 10 || 20`);
                                }
                                else {
                                    bodySession.paymentSubStatus = "PAYMENT FAILED FOR ANY REASON";
                                    this.updateSession(sessionId, bodySession);
                                    sendSessionToHistoryQueue(chargingSession?._id, `${context} - Payment failed for any reason`);
                            }

                            }).catch((err) => {
                                Sentry.captureException(err);
                                console.log("Error calling payment microservice : ", err?.message)
                                bodySession.paymentSubStatus = "PAYMENT FAILED FOR ANY REASON - " + err?.message;
                                this.updateSession(sessionId, bodySession);
                                sendSessionToHistoryQueue(chargingSession?._id, `${context} - Catch Payment failed for any reason`);
                            });
                            
                        }

                        //BillingV2
                        console.info("Starting new invoice process")
                        try {
                            const enableBillingV2AdHoc = await toggle.isEnable('billing-v2-session_adhoc');
                            if (minimumBillingConditions && enableBillingV2AdHoc) {
                                console.info(`Preparing message to send | sessionId: ${chargingSession._id.toString()}`);
                                const payload = { sessionId: chargingSession._id.toString(), cdrId: cdr.id };
                                sendMessage({ method: 'invoiceAdHoc', payload }, 'billing_v2_key');
                            }
                        } catch (error) {
                            console.error("Error new invoice process", error);
                        }
                    }
                    else {
                        //Monthly Billing
                        this.updateSession(sessionId, bodySession);
                        sendSessionToHistoryQueue(chargingSession?._id, `${context} - Monthly Billing`);
                    }
                }
                catch (err) {
                    Sentry.captureException(err);
                    console.log("Billing CDR - err", err)
                    this.updateSession(sessionId, { status: global.SessionStatusStopped });
                    sendSessionToHistoryQueue(chargingSession?._id, `${context} - Catch Billing CDR - err`);
                }
            }
            else {
                console.log("[Utils - processBillingAndPaymentRoaming] - Charging session " + sessionId + " not found");
            }
        });
    },
    billingRoaming: function (cdr, userId, chargingSession, paymentId, invoiceLines, totalPrice, flat, energy, time, parking) {
        return new Promise(async (resolve, reject) => {
            //var invoiceLines = await this.getInvoiceLines(cdr, userId, chargingSession);
            console.log(JSON.stringify(invoiceLines))
            let body = await this.drawSingle_Ad_HocInvoiceRoaming(cdr, userId, chargingSession, paymentId, invoiceLines, totalPrice, flat, energy, time, parking);

            console.log(`billingRoaming id : ${chargingSession.id} - source : ${cdr.source} - Enums.ChargerNetworks.Hubject : ${Enums.ChargerNetworks.Hubject}`)
            if (cdr.source === Enums.ChargerNetworks.Hubject) {
                body = CdrsService.buildInvoice(chargingSession)
                console.log(`Hubject billingRoaming : ${JSON.stringify(body)}`)
            }
            let host = global.billingRoamingEndpoint
            let headers = {
                'userid': userId
            }

            if (chargingSession.clientName !== process.env.evioClientName) {
                host = global.billingEndpointWL
                headers = {
                    ...headers,
                    'clientname': chargingSession.clientName,
                    'source': process.env.sourceInternational,
                    'ceme': "EVIO",
                }
            }
            axios.post(host, body, { headers }).then(function (response) {
                if (typeof response.data !== 'undefined') {
                    resolve(response.data);
                }
                else
                    reject(false);
            }).catch(function (error) {
                reject(error);
            });

        });

    },
    drawSingle_Ad_HocInvoiceRoaming: function (cdr, userId, chargingSession, paymentId, invoiceLines, totalPrice, flat, energy, time, parking) {
        return new Promise(async (resolve, reject) => {
            let footer = {
                total_exc_vat: totalPrice.excl_vat,
                total_inc_vat: totalPrice.incl_vat
            }

            let others = 0;
            let activationFee = 0;

            // others += activationFee;
            let CEME_PERCENTAGE = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "percentage")
            let evioPercentage = CEME_PERCENTAGE ? CEME_PERCENTAGE.price : 0

            let opcDetail = chargingSession.finalPrices.opcPriceDetail
            let cemeDetail = chargingSession.finalPrices.cemePriceDetail
            let gireveActivationFee = Number(process.env.GireveCommission)

            let timeCost = this.round(opcDetail.timePrice.excl_vat) + this.round(cemeDetail.timePrice.excl_vat) + this.round((opcDetail.timePrice.excl_vat) * evioPercentage)
            let energyCost = this.round(opcDetail.powerPrice.excl_vat) + this.round(cemeDetail.powerPrice.excl_vat) + this.round((opcDetail.powerPrice.excl_vat) * evioPercentage)
            let flatCost = this.round(opcDetail.flatPrice.excl_vat) + this.round(cemeDetail.flatPrice.excl_vat) + this.round((opcDetail.flatPrice.excl_vat) * evioPercentage) + this.round(gireveActivationFee)

            let city = jsonCountryNames[chargingSession.country_code]
            if (chargingSession.address) {
                if (chargingSession.address.city !== null && chargingSession.address.city !== undefined) {
                    city = chargingSession.address.city
                }
            }

            let unitPriceRoamingEnergy = energyCost > 0 && chargingSession.kwh > 0 ? energyCost / (chargingSession.kwh) : 0
            let unitPriceRoamingTime = timeCost > 0 && chargingSession.timeCharged > 0 ? timeCost / (chargingSession.timeCharged / 60) : 0

            let evDetails = chargingSession.evDetails ?? (chargingSession.evId !== null && chargingSession.evId !== undefined && chargingSession.evId !== "-1" ? await this.getEvDetails(chargingSession.evId) : null)
            let licensePlate = evDetails?.licensePlate ?? null
            let groupDrivers = evDetails ? evDetails.listOfGroupDrivers.find(group => group.listOfDrivers.find(driver => driver._id === chargingSession.userId)) : null
            let fleet = chargingSession.fleetDetails ?? (evDetails && evDetails.fleet !== null && evDetails.fleet !== undefined && evDetails.fleet !== "-1" ? await this.getFleetDetails(evDetails.fleet) : null)

            let userInfo = chargingSession.userIdInfo ?? await this.getUserInfo(chargingSession.userId)
            let userWillPayInfo = chargingSession.userIdWillPayInfo ?? (chargingSession.userIdWillPay !== chargingSession.userId ? await this.getUserInfo(chargingSession.userIdWillPay) : userInfo)

            let averagePower = chargingSession.kwh > 0 && chargingSession.timeCharged > 0 ? chargingSession.kwh / (chargingSession.timeCharged / 3600) : 0
            let realTimeCharging = chargingSession.timeCharged / 60

            if (chargingSession.endOfEnergyDate !== null && chargingSession.endOfEnergyDate !== undefined) {
                realTimeCharging = moment.duration(moment.utc(chargingSession.endOfEnergyDate).diff(chargingSession.start_date_time)).asMinutes()
            }

            if(chargingSession.local_start_date_time) {
                chargingSession.start_date_time = new Date(chargingSession.local_start_date_time).toISOString();
            }
            if(chargingSession.local_end_date_time) {
                chargingSession.end_date_time = new Date(chargingSession.local_end_date_time).toISOString();
            }

            let attachLine = {
                "date": moment(chargingSession.start_date_time ? chargingSession.start_date_time : cdr.start_date_time).format("DD/MM/YYYY"),
                "startTime": moment(chargingSession.start_date_time ? chargingSession.start_date_time : cdr.start_date_time).format("HH:mm"),
                "duration": new Date(chargingSession.timeCharged * 1000).toISOString().substr(11, 8),
                "network": process.env.NetworkInternational,
                "city": chargingSession.address.city,
                "country": jsonCountryNames[chargingSession.country_code],
                "hwId": chargingSession.location_id,
                "partyId": chargingSession.party_id,
                "totalPower": chargingSession.kwh,
                "timeCost": this.round(timeCost),
                "unitPriceRoamingTime": this.round(unitPriceRoamingTime, 3),
                "unitPriceRoamingEnergy": this.round(unitPriceRoamingEnergy, 3),
                "energyCost": this.round(energyCost),
                "flatCost": this.round(flatCost),
                "total_exc_vat": totalPrice.excl_vat,
                "vat": chargingSession.finalPrices.vatPrice.vat * 100,
                "total_inc_vat": totalPrice.incl_vat,
                // "startDateTime": moment(chargingSession.start_date_time).format("DD/MM/YYYY HH:mm:ss"),
                "startDateTime": chargingSession.start_date_time,
                // "endDateTime": moment(chargingSession.end_date_time).format("DD/MM/YYYY HH:mm:ss"),
                "endDateTime": chargingSession.end_date_time,
                "durationMin": this.round(chargingSession.timeCharged / 60),
                "realTimeCharging": this.round(realTimeCharging),
                "averagePower": this.round(averagePower),
                "CO2emitted": chargingSession.CO2Saved,
                "fleetName": fleet?.name ?? "-",
                "licensePlate": licensePlate ?? "-",
                "groupName": groupDrivers?.name ?? "-",
                "userIdName": userInfo?.name ?? "-",
                "userIdWillPayName": userWillPayInfo?.name ?? "-",
                "activationFee": this.round(gireveActivationFee, 4),
            }

            let body = {
                optionalCountryCodeToVAT: chargingSession.fees?.countryCode ?? chargingSession.country_code,
                invoice: {
                    paymentId: paymentId,
                    header: {
                        userId: userId
                    },
                    lines: invoiceLines
                },
                attach: {
                    overview: {
                        footer: footer,
                        lines:
                        {
                            // evio_services: { total_exc_vat: others, vat: this.round(VAT_Price * others) },
                            evio_services: { total_exc_vat: 0, vat: 0 },
                            evio_network: { total_exc_vat: 0, vat: 0 },
                            mobie_network: { total_exc_vat: 0, vat: 0 },
                            // other_networks: { total_exc_vat: this.round(totalPrice.excl_vat - others), vat: this.round(VAT_Price * (totalPrice.excl_vat - others)) },
                            other_networks: { total_exc_vat: this.round(totalPrice.excl_vat), vat: this.round((totalPrice.incl_vat - totalPrice.excl_vat)) },
                            hyundai_network: { total_exc_vat: 0, vat: 0 },
                            goCharge_network: { total_exc_vat: 0, vat: 0 },
                            klc_network: { total_exc_vat: 0, vat: 0 },
                            kinto_network: { total_exc_vat: 0, vat: 0 },
                        }

                    },
                    chargingSessions: {
                        header: {
                            sessions: 1,
                            totalTime: new Date(chargingSession.timeCharged * 1000).toISOString().substr(11, 8),
                            totalEnergy: chargingSession.kwh + " KWh"
                        },
                        lines: [
                            attachLine
                        ],
                        summaryAddress: [
                            {
                                hwId: chargingSession.location_id,
                                city: chargingSession.address.city,
                                voltageLevel: "-",
                            }
                        ],
                        summaryOperator: [
                            {
                                partyId: chargingSession.party_id,
                                operatorName: `${chargingSession.cpoCountryCode}*${chargingSession.party_id}`
                            }
                        ],
                        footer: footer
                    }
                }
            }

            console.log(JSON.stringify(body))
            resolve(body);
        });
    },
    //For roaming
    updateSessionStopMeterValuesRoaming: function (chargingSession) {
        const context = 'Utils updateSessionStopMeterValuesRoaming'
        return new Promise(async (resolve, reject) => {
            //Obter inicio de sessão de carregamento à sessão de carregamento
            const startDate = chargingSession.start_date_time ? chargingSession.start_date_time : new Date().toISOString();
            const end_date_time = chargingSession.end_date_time ? chargingSession.end_date_time : new Date().toISOString();
            const endDate_moment = moment(end_date_time).utc();

            //VAT
            const VAT_Price = chargingSession?.fees?.IVA ?? await vatService.getVATwithViesVAT(chargingSession); //Iva

            //Calcular tempo total de carregamento
            const timeChargedinSeconds = Utils.getChargingTime(startDate, endDate_moment);

            //Obter energia total consumida ao payload do request
            let totalPowerConsumed_Kw = -1;
            let totalPowerConsumed_W = 0;
            let instantPower = -1;
            let instantVoltage = -1;
            let instantAmperage = -1;
            let evBattery = -1;
            let CO2emitted = 0;

            if (chargingSession.kwh >= 0) {
                totalPowerConsumed_Kw = chargingSession.kwh;
                totalPowerConsumed_W = totalPowerConsumed_Kw * 1000;
                CO2emitted = Number(process.env.CarbonIntensity) * totalPowerConsumed_Kw;// Kg CO₂ eq/kWh
                if (CO2emitted < 0)
                    CO2emitted = 0
                if (chargingSession.source == process.env.HubjectPlatformCode && chargingSession.roamingCO2) CO2emitted = this.round(Number(chargingSession.roamingCO2) * totalPowerConsumed_Kw)
            }

            const readingPoints = [{
                totalPower: totalPowerConsumed_W,
                instantPower: instantPower,
                instantVoltage: instantVoltage,
                batteryCharged: evBattery,
                instantAmperage: instantAmperage
            }]

            //Calcular estimativa de custo
            let estimatedPrice_excl_Vat = -1;
            let estimatedPrice_incl_Vat = -1;
            let priceComponents = chargingSession.tariffOPC.elements;
            if (priceComponents !== null && priceComponents !== undefined) {
                priceComponents = this.createTariffElementsAccordingToRestriction(priceComponents, startDate, endDate_moment.format())
            }
            let charging_periods

            //Calculate OPC Prices
            let aux_totalPowerConsumed_Kw = 0;
            if (totalPowerConsumed_Kw >= 0)
                aux_totalPowerConsumed_Kw = totalPowerConsumed_Kw;

            let result = await this.getCharger(chargingSession.location_id, chargingSession.connector_id);

            // Timezone info to get offset of charger
            let timeZone = chargingSession.timeZone
            let countryCode = chargingSession.country_code
            let offset = this.getChargerOffset(timeZone, countryCode)

            // Arbitrary power and voltage values
            let plugPower = 50
            let plugVoltage = 480
            if (result.plug) {
                plugPower = result.plug.power
                plugVoltage = result.plug.voltage
            }

            /*
                This function calculates the final prices for each dimension. If eventually there's a wrong price, the testTariffs file should be used to test new changes
                and add more use cases if necessary.

                Parking time is assumed 0, but is it right?

                When the charging ends and parking begins, do we still receive updates from session?
                In theory, parking is still part of the session

                Update - > This function also returns a key of information about each dimension. That info contains the amount consumed in each charging period and
                            other details about the tariff and its restrictions
            */

            let [flat, energy, time, parking] = this.opcTariffsPrices(null, priceComponents, startDate, endDate_moment.format(), offset, plugPower, plugVoltage, aux_totalPowerConsumed_Kw, timeChargedinSeconds / 3600, 0, chargingSession.source)

            let [
                OCP_PRICE_FLAT,
                OCP_PRICE_ENERGY,
                OCP_PRICE_TIME,
                OCP_PRICE_PARKING_TIME
            ] = [flat.price, energy.price, time.price, parking.price]

            let OPC_Price = this.round(OCP_PRICE_FLAT) + this.round(OCP_PRICE_ENERGY) + this.round(OCP_PRICE_TIME) + this.round(OCP_PRICE_PARKING_TIME)

            let opcPrice = { excl_vat: this.round(OPC_Price), incl_vat: this.round(OPC_Price + (VAT_Price * OPC_Price)) }

            let opcPriceDetail = {
                flatPrice: { excl_vat: this.round(OCP_PRICE_FLAT), incl_vat: this.round(OCP_PRICE_FLAT + (OCP_PRICE_FLAT * VAT_Price)) },
                timePrice: { excl_vat: this.round(OCP_PRICE_TIME), incl_vat: this.round(OCP_PRICE_TIME + (OCP_PRICE_TIME * VAT_Price)) },
                powerPrice: { excl_vat: this.round(OCP_PRICE_ENERGY), incl_vat: this.round(OCP_PRICE_ENERGY + (OCP_PRICE_ENERGY * VAT_Price)) },
                parkingTimePrice: { excl_vat: this.round(OCP_PRICE_PARKING_TIME), incl_vat: this.round(OCP_PRICE_PARKING_TIME + (OCP_PRICE_PARKING_TIME * VAT_Price)) }
            }
            //////////////////////////////////// OPC /////////////////////////////////////////


            //////////////////////////////////// CEME /////////////////////////////////////////
            let CEME_FLAT = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "flat")
            let CEME_POWER = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "energy")
            let CEME_TIME = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "time")
            let CEME_PERCENTAGE = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "percentage")
            // for Hubject
            let CEME_START_PERCENTAGE = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "start_percentage")
            let CEME_ENERGY_PERCENTAGE = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "energy_percentage")
            let CEME_TIME_PERCENTAGE = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "time_percentage")

            let CEME_Price_FLAT = CEME_FLAT ? CEME_FLAT.price : 0
            let CEME_Price_POWER = CEME_POWER ? CEME_POWER.price : 0
            let CEME_Price_TIME = CEME_TIME ? CEME_TIME.price : 0
            let evioPercentage = CEME_PERCENTAGE ? CEME_PERCENTAGE.price : 0
            let evioStartPercentage = CEME_START_PERCENTAGE ? CEME_START_PERCENTAGE.price : 0
            let evioEnergyPercentage = CEME_ENERGY_PERCENTAGE ? CEME_ENERGY_PERCENTAGE.price : 0
            let evioTimePercentage = CEME_TIME_PERCENTAGE ? CEME_TIME_PERCENTAGE.price : 0

            let totalTimeConsumed = timeChargedinSeconds
            if (CEME_TIME && CEME_TIME.uom.includes('min')) {
                totalTimeConsumed = timeChargedinSeconds / 60
            } else if (CEME_TIME && CEME_TIME.uom.includes('h')) {
                totalTimeConsumed = timeChargedinSeconds / 3600
            }

            let minimumBillingConditions = true
            if (
                // (timeChargedinSeconds <= Number(process.env.MinimumChargingTimeToBilling)) ||
                (totalPowerConsumed_W <= Number(process.env.MinimumEnergyToBillingGireve))
            ) {
                minimumBillingConditions = false
            }

            //We should also consider this value, right?
            ////////////////////////////////////////////////
            //Other Prices, 0.15€ activation fee
            let commission = chargingSession.source == "Hubject" ? Number(process.env.HubjectCommission) : Number(process.env.GireveCommission)
            let activationFee = minimumBillingConditions ? commission : 0

            let evioPercentageValue = minimumBillingConditions ? evioPercentage * OPC_Price : 0
            let evioPercentageStartValue = minimumBillingConditions ? evioStartPercentage * OCP_PRICE_FLAT : 0
            let evioPercentageEnergyValue = minimumBillingConditions ? evioEnergyPercentage * OCP_PRICE_ENERGY : 0
            let evioPercentageTimeValue = minimumBillingConditions ? evioTimePercentage * OCP_PRICE_TIME : 0

            let CEME_Price = this.round(CEME_Price_FLAT) + this.round(CEME_Price_POWER * totalPowerConsumed_Kw) + this.round(CEME_Price_TIME * totalTimeConsumed);

            let cemePrice = { excl_vat: this.round(CEME_Price), incl_vat: this.round(CEME_Price + (VAT_Price * CEME_Price)) }

            let cemePriceDetail = {
                flatPrice: { excl_vat: this.round(CEME_Price_FLAT), incl_vat: this.round(CEME_Price_FLAT + (CEME_Price_FLAT * VAT_Price)) },
                timePrice: { excl_vat: this.round(CEME_Price_TIME * totalTimeConsumed), incl_vat: this.round(CEME_Price_TIME * totalTimeConsumed + (CEME_Price_TIME * totalTimeConsumed * VAT_Price)) },
                powerPrice: { excl_vat: this.round(CEME_Price_POWER * totalPowerConsumed_Kw), incl_vat: this.round(CEME_Price_POWER * totalPowerConsumed_Kw + (CEME_Price_POWER * totalPowerConsumed_Kw * VAT_Price)) },
            }

            let otherPrices = [
                { description: `Gireve Activation Fee ${activationFee}`, price: { excl_vat: this.round(activationFee), incl_vat: this.round(activationFee + (VAT_Price * activationFee)) } },
            ]

            if (evioPercentage > 0) otherPrices.push({ description: `EVIO Percentage ${evioPercentage * 100}%`, price: { excl_vat: this.round(evioPercentageValue), incl_vat: this.round(evioPercentageValue + (VAT_Price * evioPercentageValue)) } })
            if (evioStartPercentage > 0) otherPrices.push({ description: `EVIO Start Percentage ${evioStartPercentage * 100}%`, price: { excl_vat: this.round(evioPercentageStartValue), incl_vat: this.round(evioPercentageStartValue + (VAT_Price * evioPercentageStartValue)) } })
            if (evioEnergyPercentage > 0) otherPrices.push({ description: `EVIO Energy Percentage ${evioEnergyPercentage * 100}%`, price: { excl_vat: this.round(evioPercentageEnergyValue), incl_vat: this.round(evioPercentageEnergyValue + (VAT_Price * evioPercentageEnergyValue)) } })
            if (evioTimePercentage > 0) otherPrices.push({ description: `EVIO Time Percentage ${evioTimePercentage * 100}%`, price: { excl_vat: this.round(evioPercentageTimeValue), incl_vat: this.round(evioPercentageTimeValue + (VAT_Price * evioPercentageTimeValue)) } })
            //////////////////////////////////// CEME /////////////////////////////////////////

            estimatedPrice_excl_Vat = this.round(opcPrice.excl_vat) + this.round(cemePrice.excl_vat) + this.round(evioPercentage * opcPrice.excl_vat) + this.round(Number(activationFee)) + this.round(Number(OCP_PRICE_FLAT * evioStartPercentage)) + this.round(Number(OCP_PRICE_FLAT * evioEnergyPercentage)) + this.round(Number(OCP_PRICE_TIME * evioTimePercentage))
            estimatedPrice_incl_Vat = this.round(estimatedPrice_excl_Vat + (VAT_Price * estimatedPrice_excl_Vat));

            let totalCost = { excl_vat: this.round(estimatedPrice_excl_Vat), incl_vat: this.round(estimatedPrice_incl_Vat) }

            let vatPrice = { vat: this.round(VAT_Price), value: this.round((estimatedPrice_incl_Vat - estimatedPrice_excl_Vat)) }
            let finalPrices = {
                opcPrice: opcPrice,
                opcPriceDetail: opcPriceDetail,
                cemePrice: cemePrice,
                cemePriceDetail: cemePriceDetail,
                vatPrice: vatPrice,
                othersPrice: otherPrices,
                totalPrice: totalCost
            }

            let query = { _id: chargingSession._id , cdrId: {$eq : "-1"} };
            let newValues = {
                $set:
                {
                    timeCharged: timeChargedinSeconds,
                    batteryCharged: evBattery,
                    kwh: totalPowerConsumed_Kw,
                    CO2Saved: CO2emitted,
                    total_cost: totalCost,
                    totalPower: totalPowerConsumed_W,
                    finalPrices: finalPrices,
                    end_date_time: end_date_time
                },
                $push: {
                    readingPoints: readingPoints
                }

            };

            console.log("Update stop session: ", finalPrices);

            Session.updateSession(query, newValues, async (err, result) => {
                if (err) {
                    console.log(`[update Session OCPI] Error `, err);
                    resolve(err);
                }
                else {
                    if (result) {
                        sendSessionToHistoryQueue(chargingSession?._id, context)
                        const sessionTimeValid = await Utils.checkSessionTimeIsValidForNotification(timeChargedinSeconds, startDate);
                        const {isDevice = false } = Helpers.verifyIsDeviceRequest(result?.createdWay);
                        if(sessionTimeValid && !isDevice){
                            Utils.sendStopNotification(result)
                        }
                    }
                    resolve();
                };
            });

        });
    },
    getChargerTypeByPlatformCode: function (platformCode) {
        switch (platformCode) {
            case process.env.GirevePlatformCode:
                return process.env.chargerTypeGireve
            case process.env.MobiePlatformCode:
                return process.env.chargerTypeMobie
            case process.env.HubjectPlatformCode:
                return process.env.HubjectCharger
            default:
                return process.env.chargerTypeMobie
        }
    },
    getUserInfo: function (userId) {
        return new Promise(async (resolve, reject) => {
            const params = {
                _id: userId,
            }

            const host = process.env.HostUser + process.env.PathGetUserById
            axios.get(host, { params })
                .then(function (response) {
                    const obj = response.data;

                    if (typeof obj === 'undefined') {
                        resolve(false);
                    }
                    else {
                        resolve(obj);
                    }

                }).catch(function (error) {

                    if (error.response) {
                        console.log("[getUserInfo] error: " + error.response.data);
                        resolve(false);
                    }
                    else {
                        console.log("[getUserInfo] error: " + error.message);
                        resolve(false);
                    }
                });
        });
    },
    countryToCountryCode: function (charger, country, countryCode) {
        try {
            if ((typeof country === 'string' || country instanceof String) && country.length == 3) {
                let countryCode = jsonCountryCodes[country]
                if (countryCode !== null && countryCode !== undefined) {
                    return countryCode
                } else {
                    return (charger.country_code === null || typeof charger.country_code === 'undefined') ? countryCode : charger.country_code
                }
            } else {
                return (charger.country_code === null || typeof charger.country_code === 'undefined') ? countryCode : charger.country_code
            }
        } catch (error) {
            console.log(error.message)
            return (charger.country_code === null || typeof charger.country_code === 'undefined') ? countryCode : charger.country_code
        }
    },
    removeUndefinedValues: function (firstLayerObj) {
        /*
            Really lazy function, it could maybe be improved in the future, not necessary though
        */
        Object.keys(firstLayerObj).forEach(firstLayerKey => {
            if (firstLayerObj[firstLayerKey] === undefined) {
                delete firstLayerObj[firstLayerKey];
            } else if (!this.isEmptyObject(firstLayerObj[firstLayerKey])) {
                let secondLayerObj = firstLayerObj[firstLayerKey]
                Object.keys(secondLayerObj).forEach(secondLayerKey => {
                    if (secondLayerObj[secondLayerKey] === undefined) {
                        delete firstLayerObj[firstLayerKey][secondLayerKey];
                    } else if (!this.isEmptyObject(secondLayerObj[secondLayerKey])) {
                        let thirdLayerObj = secondLayerObj[secondLayerKey]
                        Object.keys(thirdLayerObj).forEach(thirdLayerKey => {
                            if (thirdLayerObj[thirdLayerKey] === undefined) {
                                delete firstLayerObj[firstLayerKey][secondLayerKey][thirdLayerKey];
                            }
                        });
                    }
                });
            }
        });
        return firstLayerObj
    },
    updateChargerInfo: function (chargerInfo) {
        return new Promise(async (resolve, reject) => {
            axios.patch(global.publicNetworkLocationsWrongBehaviorProxy, { chargerInfo })
                .then(function (response) {

                    if (typeof response.data !== 'undefined') {
                        console.log("[updateChargerInfo] Success updating chargers!");
                        resolve(true)
                    }
                    else {
                        console.log("[updateChargerInfo] error: ");
                        resolve(false)
                    }
                }).catch(function (e) {
                    console.log("[updateChargerInfo] error: " + e.message);
                    resolve(false)
                });
        })
    },
    transformTariffElements: function (elements) {
        /*
            Gireve adds some fields that don't exist in the OCPI 2.1.1 documentation. To adapt them to the
            existing implementation, this function transforms a tariff element of type SESSION_TIME into two,
            one of the type TIME and the other PARKING_TIME.

            The restrictions start_time_2 and end_time_2 were also added, implying that two time ranges can occur in the same tariff element.
            That scenario doesn't exist in the current implementation, so, a way to do it is to separate them into two different tariff elements with
            the same restrictions but different start_time and end_time.
        */
        let elementIndex = 0
        for (let tariffElement of elements) {
            let componentIndex = 0
            let restrictions = tariffElement.restrictions
            Utils.adjustRestrictions(restrictions)
            let isEmpty = this.isEmptyObject(restrictions)
            for (let component of tariffElement.price_components) {
                if (component.type === "SESSION_TIME") {
                    let timeComponent = {
                        price: component.price,
                        step_size: component.step_size,
                        type: "TIME"
                    }

                    let parkingTimeComponent = {
                        price: component.price,
                        step_size: component.step_size,
                        type: "PARKING_TIME"
                    }
                    elements[elementIndex].price_components.splice(componentIndex, 1, timeComponent, parkingTimeComponent);
                }
                componentIndex++
            }
            if (!isEmpty) {
                if (
                    ('start_time_2' in restrictions && restrictions['start_time_2'] !== null && restrictions['start_time_2'] !== undefined) &&
                    ('end_time_2' in restrictions && restrictions['end_time_2'] !== null && restrictions['end_time_2'] !== undefined)
                ) {
                    let newRestrictions = { ...restrictions, start_time: restrictions.start_time_2, end_time: restrictions.end_time_2 }
                    delete newRestrictions.start_time_2
                    delete newRestrictions.end_time_2
                    delete elements[elementIndex].restrictions.start_time_2
                    delete elements[elementIndex].restrictions.end_time_2

                    let newElement = {
                        restrictions: newRestrictions,
                        price_components: elements[elementIndex].price_components
                    }

                    elements.splice(elementIndex + 1, 0, newElement)

                } else if ('end_time_2' in restrictions && restrictions['end_time_2'] !== null && restrictions['end_time_2'] !== undefined) {
                    let newRestrictions = { ...restrictions, end_time: restrictions.end_time_2 }
                    delete newRestrictions.end_time_2
                    delete newRestrictions.start_time
                    delete elements[elementIndex].restrictions.end_time_2

                    let newElement = {
                        restrictions: newRestrictions,
                        price_components: elements[elementIndex].price_components
                    }

                    elements.splice(elementIndex + 1, 0, newElement)


                } else if ('start_time_2' in restrictions && restrictions['start_time_2'] !== null && restrictions['start_time_2'] !== undefined) {
                    let newRestrictions = { ...restrictions, start_time: restrictions.start_time_2 }
                    delete newRestrictions.start_time_2
                    delete newRestrictions.end_time
                    delete elements[elementIndex].restrictions.start_time_2

                    let newElement = {
                        restrictions: newRestrictions,
                        price_components: elements[elementIndex].price_components
                    }

                    elements.splice(elementIndex + 1, 0, newElement)
                }
            }
            elementIndex++
        }
        return elements
    },
    createTariffElementsAccordingToRestriction: function (elements, sessionStartDate, sessionStopDate) {
        /*
            Basically, with the current implementation, in the opcTariffsPrices function, a tariff element can only be used in one period of time,
            but in reality, if the element has a restriction start_time and end_time and the total charging time is bigger than 24 hours - (end_time - start_time),
            it can happen that the tariff element is used twice. It's not common, but it can happen in real life, especially if the gap between end_time and start_time
            is too big. Let's say for example, start_time = 06:00 and end_time = 23:00. If the user starts at 22:58 and ends on 06:10 or so, it happens.

            That being said, to solve this issue, with the tariffs that have time restrictions and no date restrictions, I'm creating mutliple equal versions of that element
            but add them date restrictions from start of session to the end of session
        */
        let momentStartDate = moment(sessionStartDate).utc()
        let momentStopDate = moment(sessionStopDate).utc()
        let daysDiff = momentStopDate.diff(momentStartDate, 'days')
        let addElements = daysDiff + 2
        elements = Utils.separateWeekDaysRestriction(JSON.parse(JSON.stringify(elements)), sessionStartDate, daysDiff)
        let elementIndex = 0
        let elementsToPush = []
        for (let tariffElement of elements) {
            let restrictions = tariffElement.restrictions
            Utils.adjustRestrictions(restrictions)
            let isEmpty = this.isEmptyObject(restrictions)

            if (!isEmpty) {
                if (
                    (('start_time' in restrictions && restrictions['start_time'] !== null && restrictions['start_time'] !== undefined) ||
                        ('end_time' in restrictions && restrictions['end_time'] !== null && restrictions['end_time'] !== undefined)) &&
                    (!('start_date' in restrictions && restrictions['start_date'] !== null && restrictions['start_date'] !== undefined) &&
                        !('end_date' in restrictions && restrictions['end_date'] !== null && restrictions['end_date'] !== undefined))
                    && !('day_of_week' in restrictions && restrictions['day_of_week'] !== null && restrictions['day_of_week'] !== undefined)
                ) {
                    let firstDate = moment.utc(sessionStartDate).format("YYYY-MM-DD")
                    let alteredComponents = {
                        index: elementIndex,
                        elements: []
                    }
                    for (let pushIndex = 0; pushIndex < addElements; pushIndex++) {
                        let startHour = restrictions['start_time'] ? parseInt(restrictions['start_time'].slice(0, 2)) : null
                        let endHour = restrictions['end_time'] ? parseInt(restrictions['end_time'].slice(0, 2)) : null

                        let currentDay = moment.utc(firstDate, 'YYYY-MM-DD').add(24 * pushIndex, 'hours').format()
                        let nextDay = moment.utc(currentDay).add(24, 'hours').format()
                        let nextDayMidnight = moment.utc(nextDay).startOf('day')
                        let nextNextDay = moment.utc(nextDay).add(24, 'hours').format()

                        if (startHour && endHour && endHour !== 0 && startHour > endHour) {
                            if (pushIndex === 0) {
                                let previousDay = moment.utc(firstDate, 'YYYY-MM-DD').add(-24, 'hours').format()
                                let currentDayMidnight = moment().utc(firstDate, "HH:mm").startOf('day')
                                let firstElement = {
                                    restrictions: {
                                        ...restrictions,
                                        "end_time": currentDayMidnight.format("HH:mm"),
                                        "start_date": moment.utc(previousDay).format("YYYY-MM-DD"),
                                        "end_date": firstDate,
                                    },
                                    price_components: elements[elementIndex].price_components
                                }

                                let secondElement = {
                                    restrictions: {
                                        ...restrictions,
                                        "start_time": currentDayMidnight.format("HH:mm"),
                                        "start_date": moment.utc(currentDay).format("YYYY-MM-DD"),
                                        "end_date": moment.utc(nextDay).format("YYYY-MM-DD"),
                                    },
                                    price_components: elements[elementIndex].price_components
                                }
                                // elements.splice(elementIndex, 1, firstElement , secondElement)
                                alteredComponents.elements.push(firstElement, secondElement)
                            }

                            let firstElement = {
                                restrictions: {
                                    ...restrictions,
                                    'end_time': nextDayMidnight.format("HH:mm"),
                                    "start_date": moment.utc(currentDay).format("YYYY-MM-DD"),
                                    "end_date": moment.utc(nextDay).format("YYYY-MM-DD"),
                                },
                                price_components: elements[elementIndex].price_components
                            }

                            let secondElement = {
                                restrictions: {
                                    ...restrictions,
                                    'start_time': nextDayMidnight.format("HH:mm"),
                                    "start_date": moment.utc(nextDay).format("YYYY-MM-DD"),
                                    "end_date": moment.utc(nextNextDay).format("YYYY-MM-DD"),
                                },
                                price_components: elements[elementIndex].price_components
                            }

                            // elements.splice(elementIndex + pushedItems + pushIndex , 0, firstElement , secondElement)
                            alteredComponents.elements.push(firstElement, secondElement)
                        } else {
                            if (pushIndex === 0) {
                                let previousDay = moment.utc(firstDate, 'YYYY-MM-DD').add(-24, 'hours').format()
                                let newElement = {
                                    restrictions: {
                                        ...restrictions,
                                        "start_date": moment.utc(previousDay).format("YYYY-MM-DD"),
                                        "end_date": firstDate,
                                    },
                                    price_components: elements[elementIndex].price_components
                                }
                                alteredComponents.elements.push(newElement)
                                // elements.splice(elementIndex, 1, newElement)
                            }

                            // let currentDay = moment.utc(firstDate, 'YYYY-MM-DD').add(24 * pushIndex, 'hours').format()
                            // let nextDay = moment.utc(currentDay).add(24, 'hours').format()
                            let newElement = {
                                restrictions: {
                                    ...restrictions,
                                    "start_date": moment.utc(currentDay).format("YYYY-MM-DD"),
                                    "end_date": moment.utc(nextDay).format("YYYY-MM-DD"),
                                },
                                price_components: elements[elementIndex].price_components
                            }
                            alteredComponents.elements.push(newElement)
                            // elements.splice(elementIndex + pushIndex + 1, 0, newElement)
                        }
                    }
                    elementsToPush.push(alteredComponents)
                }
            }
            elementIndex++
        }

        let addIndex = 0
        for (let elem of elementsToPush) {
            let index = elem.index + addIndex
            elements.splice(index, 1, ...elem.elements)
            addIndex += elem.elements.length - 1
        }

        return elements
    }, separateWeekDaysRestriction: function (elements, sessionStartDate, daysDiff) {
        daysDiff = daysDiff === 0 ? 1 : daysDiff
        let weeks = Math.ceil(daysDiff / 7) + 1
        let elementIndex = 0
        for (let tariffElement of elements) {
            let restrictions = tariffElement.restrictions
            Utils.adjustRestrictions(restrictions)
            let isEmpty = this.isEmptyObject(restrictions)

            let dayOfWeekObj = {
                "SUNDAY": 0,
                "MONDAY": 1,
                "TUESDAY": 2,
                "WEDNESDAY": 3,
                "THURSDAY": 4,
                "FRIDAY": 5,
                "SATURDAY": 6,
            }
            if (!isEmpty) {
                if (
                    ('day_of_week' in restrictions && restrictions['day_of_week'] !== null && restrictions['day_of_week'] !== undefined) &&
                    restrictions['day_of_week'].length > 1
                ) {
                    // console.log("entras 1" , tariffElement)
                    let weekDays = 0
                    let daysOfWeek = 0
                    for (let weekIndex = 0; weekIndex < weeks; weekIndex++) {

                        for (let pushIndex = 0; pushIndex < restrictions['day_of_week'].length; pushIndex++) {
                            let weekDayStartDay = new Date(sessionStartDate).getDay()
                            let restrictionDayStart = dayOfWeekObj[restrictions['day_of_week'][pushIndex]]
                            let diffDays = (restrictionDayStart - weekDayStartDay) + weekDays
                            let startDate = moment.utc(sessionStartDate).add(diffDays, 'days').format("YYYY-MM-DD")
                            let endDate = moment.utc(startDate).add(24, 'hours').format("YYYY-MM-DD")
                            let newElement = {
                                restrictions: {
                                    ...restrictions,
                                    "day_of_week": [restrictions['day_of_week'][pushIndex]],
                                    "start_date": startDate,
                                    "end_date": endDate
                                },
                                price_components: elements[elementIndex].price_components
                            }
                            elements.splice(elementIndex + daysOfWeek + pushIndex + 1, 0, newElement)

                        }
                        weekDays += 7
                        daysOfWeek += restrictions['day_of_week'].length
                    }
                    elements.splice(elementIndex, 1)

                } else if (('day_of_week' in restrictions && restrictions['day_of_week'] !== null && restrictions['day_of_week'] !== undefined) &&
                    !('start_date' in restrictions && restrictions['start_date'] !== null && restrictions['start_date'] !== undefined) &&
                    !('end_date' in restrictions && restrictions['end_date'] !== null && restrictions['end_date'] !== undefined) &&
                    restrictions['day_of_week'].length == 1
                ) {
                    // console.log("entras 2" , tariffElement)
                    let weekDays = 0
                    let daysOfWeek = 0
                    for (let weekIndex = 0; weekIndex < weeks; weekIndex++) {

                        for (let pushIndex = 0; pushIndex < restrictions['day_of_week'].length; pushIndex++) {
                            let weekDayStartDay = new Date(sessionStartDate).getDay()
                            let restrictionDayStart = dayOfWeekObj[restrictions['day_of_week'][pushIndex]]
                            let diffDays = (restrictionDayStart - weekDayStartDay) + weekDays
                            let startDate = moment.utc(sessionStartDate).add(diffDays, 'days').format("YYYY-MM-DD")
                            let endDate = moment.utc(startDate).add(24, 'hours').format("YYYY-MM-DD")
                            let newElement = {
                                restrictions: {
                                    ...restrictions,
                                    "day_of_week": [restrictions['day_of_week'][pushIndex]],
                                    "start_date": startDate,
                                    "end_date": endDate
                                },
                                price_components: elements[elementIndex].price_components
                            }
                            elements.splice(elementIndex + daysOfWeek + pushIndex + 1, 0, newElement)

                        }
                        weekDays += 7
                        daysOfWeek += restrictions['day_of_week'].length
                    }
                    elements.splice(elementIndex, 1)
                }
            }
            elementIndex++
        }
        return elements
    },
    roundingGranularityRules: function (granularity, rule, value) {
        let roundingKeys = {
            "ROUND_UP": (num, decimals) => Math.ceil(Utils.round(num * decimals, 6)) / decimals,
            "ROUND_DOWN": (num, decimals) => Math.floor(Utils.round(num * decimals, 6)) / decimals,
            "ROUND_NEAR": (num, decimals) => Math.round(Utils.round(num * decimals, 6)) / decimals,
        }
        if (granularity === "UNIT") {
            return roundingKeys[rule](value, 1)
        } else if (granularity === "TENTH") {
            return roundingKeys[rule](value, 10)
        } else if (granularity === "HUNDREDTH") {
            return roundingKeys[rule](value, 100)
        } else if (granularity === "THOUSANDTH") {
            return roundingKeys[rule](value, 1000)
        } else {
            return Math.round(value)
        }
    }, roundingsValidation: function (component) {
        let priceRoundGranularity, priceRoundRule, stepRoundGranularity, stepRoundRule
        if (component.price_round !== null && component.price_round !== undefined) {
            priceRoundGranularity = component.price_round.round_granularity
            priceRoundRule = component.price_round.round_rule
        } else {
            priceRoundGranularity = "THOUSANDTH"
            priceRoundRule = "ROUND_NEAR"
        }

        if (component.step_round !== null && component.step_round !== undefined) {
            stepRoundGranularity = component.step_round.round_granularity
            stepRoundRule = component.step_round.round_rule
        } else {
            stepRoundGranularity = "UNIT"
            stepRoundRule = "ROUND_UP"
        }

        return { priceRoundGranularity, priceRoundRule, stepRoundGranularity, stepRoundRule }
    },
    getChargerTariff: function (hwId, plugId) {
        return new Promise(async (resolve, reject) => {
            let query = { hwId, plugId };
            ChargerTariffs.findOne(query, (err, chargerTariff) => {
                if (chargerTariff) {
                    resolve(chargerTariff.tariffId);
                }
                else {
                    resolve("TEST-TARIFF");
                }
            }).catch(function (e) {
                console.log(e.message);
                resolve("TEST-TARIFF");
            });;
        });
    },
    hasMinimumBillingConditionsMobiE: function (cdr) {
        const context = "Function hasMinimumBillingConditionsMobiE"
        try {
            return cdr.total_energy >= Number(process.env.MinimumChargingEnergyToBilling)
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            return true
        }
    },
    getChargerWithEVSE: function (hwId, evse_uid) {
        return new Promise(async (resolve, reject) => {
            const chargersEndpoint = global.publicNetworkChargersProxy + "/" + hwId;
            axios.get(chargersEndpoint, {}, {}).then(function (response) {
                if (typeof response.data !== 'undefined' && response.data !== '') {
                    const charger = response.data;
                    // console.log(JSON.stringify(charger));
                    const plugs = charger.plugs;
                    const plug = _.where(plugs, { uid: evse_uid });
                    if (plug.length === 0) {
                        /*
                            Sometimes MobiE sends wrong uids and we need to fix it a bit
                        */
                        evse_uid = evse_uid.slice(0, evse_uid.length - 2) + evse_uid.slice(evse_uid.length - 1)
                        plug = _.where(plugs, { uid: evse_uid });
                    }
                    //Return tariff Id
                    resolve({ charger: charger, plug: plug[0] });
                }
                else {
                    console.log("Checking OPC Tariff- Charger does nor found " + hwId)
                    resolve(false);
                }
            }).catch(function (e) {
                console.log("[Utils getCharger - Charger does not found " + hwId + ". Error: " + e.message)
                resolve(false);
                return;
            });
        });
    },
    getRoamingPlanTariff: function (params) {
        const context = "Function getRoamingPlanTariff";
        return new Promise((resolve, reject) => {
            try {
                const serviceProxy = process.env.HostPublicTariffs + process.env.PathGetRoamingPlanTariff;

                axios.get(serviceProxy, { params })
                    .then((result) => {

                        resolve(result.data);

                    })
                    .catch((error) => {
                        console.log(`[${context}] Error `, error.message);
                        resolve({});
                    });
            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                resolve({});
            };
        });
    },
    createTariffOPCWithRoamingPlan: function (roamingPlan) {
        const context = "Function createTariffOPCWithRoamingPlan";
        try {
            let OPC_FLAT = roamingPlan.tariff.find(tariff => tariff.type === "flat")
            let OPC_POWER = roamingPlan.tariff.find(tariff => tariff.type === "energy")
            let OPC_TIME = roamingPlan.tariff.find(tariff => tariff.type === "time")

            let OPC_Price_FLAT = OPC_FLAT ? OPC_FLAT.price : 0
            let OPC_Price_POWER = OPC_POWER ? OPC_POWER.price : 0
            let OPC_Price_TIME = OPC_TIME ? OPC_TIME.price : 0

            //We'll use values of €/min in tariffOPC
            if (OPC_TIME && OPC_TIME.uom.includes('h')) {
                OPC_Price_TIME = OPC_Price_TIME / 60
            }

            let tariffOPC = {
                partyId: roamingPlan.partyId,
                elements: [
                    {
                        price_components: [
                            {
                                type: "FLAT",
                                price: OPC_Price_FLAT,
                                step_size: 1
                            }
                        ]
                    },
                    {
                        price_components: [
                            {
                                type: "TIME",
                                price: OPC_Price_TIME,
                                step_size: 1
                            }
                        ]
                    },
                    {
                        price_components: [
                            {
                                type: "ENERGY",
                                price: OPC_Price_POWER,
                                step_size: 1
                            }
                        ]
                    }
                ]
            }
            return tariffOPC
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            return {}
        }
    },
    getEVSEGroup: function (uid) {
        const context = "Function getEVSEGroup";
        return new Promise(async (resolve, reject) => {
            let host = process.env.HostPublicNetwork + process.env.PathGetEVSEGroup;
            let params = { uid: uid };

            axios.get(host, { params })
                .then((result) => {
                    if (result.data) {
                        resolve(result.data);
                    }
                    else {
                        resolve("");
                    };
                })
                .catch((error) => {
                    console.log(`[${context}] Error `, error.message);
                    resolve("");
                });
        });
    },
    buildGireveServiceCost: function (power, countryCode, partyId, evseGroup) {
        const context = "Function buildGireveServiceCost";
        return new Promise(async (resolve, reject) => {
            try {
                let total_charging_time = 0.5; //Time in hours
                let sessionStartDate = moment.utc(new Date().toISOString()).format()
                let sessionStopDate = moment.utc(sessionStartDate).add(total_charging_time, 'hours').format()
                let total_energy = 50
                let source = global.girevePlatformCode
                let total_parking_time = 0

                let params = {
                    country: countryCode,
                    region: countryCode,
                    partyId: partyId,
                    roamingType: source,
                    evseGroup: evseGroup
                }
                let currency = "EUR"
                let roamingPlanCpo = await this.getRoamingPlanTariff(params)

                let opcElements = []
                if (roamingPlanCpo.tariff) {
                    currency = roamingPlanCpo.currency
                    let tariffOPC = this.createTariffOPCWithRoamingPlan(roamingPlanCpo)
                    opcElements = tariffOPC.elements
                }

                let [flat, energy, time, parking] = this.opcTariffsPrices(null, opcElements, sessionStartDate, sessionStopDate, 0, power, null, total_energy, total_charging_time, total_parking_time, null)

                let [
                    OCP_PRICE_FLAT,
                    OCP_PRICE_ENERGY,
                    OCP_PRICE_TIME,
                    OCP_PRICE_PARKING_TIME
                ] = [flat.price, energy.price, time.price, parking.price]

                let OPC_Price = OCP_PRICE_FLAT + OCP_PRICE_ENERGY + OCP_PRICE_TIME + OCP_PRICE_PARKING_TIME

                let [
                    OCP_INFO_FLAT,
                    OCP_INFO_ENERGY,
                    OCP_INFO_TIME,
                    OCP_INFO_PARKING_TIME
                ] = [flat.info, energy.info, time.info, parking.info]

                let OPC_UN_ENERGY = OCP_INFO_ENERGY.length > 0 ? OCP_INFO_ENERGY[0].component.price : 0
                let OPC_UN_TIME = OCP_INFO_TIME.length > 0 ? OCP_INFO_TIME[0].component.price : 0
                let OPC_UN_PARKING_TIME = OCP_INFO_PARKING_TIME.length > 0 ? OCP_INFO_PARKING_TIME[0].component.price : 0

                // ======================= EMSP TARIFFS ======================= //

                let roamingTariff = await this.getTariffCEMERoaming(null, source)

                let CEME_FLAT = roamingTariff.tariff.find(tariff => tariff.type === "flat")
                let CEME_POWER = roamingTariff.tariff.find(tariff => tariff.type === "energy")
                let CEME_TIME = roamingTariff.tariff.find(tariff => tariff.type === "time")
                let CEME_PERCENTAGE = roamingTariff.tariff.find(tariff => tariff.type === "percentage")

                let CEME_Price_FLAT = CEME_FLAT ? CEME_FLAT.price : 0
                let CEME_Price_POWER = CEME_POWER ? CEME_POWER.price : 0
                let CEME_Price_TIME = CEME_TIME ? CEME_TIME.price : 0
                let evioPercentage = CEME_PERCENTAGE ? CEME_PERCENTAGE.price : 0

                let totalTimeConsumed = total_charging_time
                if (CEME_TIME && CEME_TIME.uom.includes('min')) {
                    totalTimeConsumed = total_charging_time * 60
                } else if (CEME_TIME && CEME_TIME.uom.includes('s')) {
                    totalTimeConsumed = total_charging_time * 3600
                }

                flat.price += CEME_Price_FLAT
                energy.price += CEME_Price_POWER * total_energy
                time.price += CEME_Price_TIME * totalTimeConsumed

                // EVIO Percentages
                flat.price += evioPercentage * OCP_PRICE_FLAT
                energy.price += evioPercentage * OCP_PRICE_ENERGY
                time.price += evioPercentage * OCP_PRICE_TIME
                parking.price += evioPercentage * OCP_PRICE_PARKING_TIME

                let EVIO_PERCENTAGE_UN_ENERGY = evioPercentage * OPC_UN_ENERGY
                let EVIO_PERCENTAGE_UN_TIME = evioPercentage * OPC_UN_TIME
                let EVIO_PERCENTAGE_UN_PARKING_TIME = evioPercentage * OPC_UN_PARKING_TIME

                //Gireve Commission
                flat.price += Number(process.env.GireveCommission)

                //Add labels
                let energyLabelValue = OPC_UN_ENERGY + CEME_Price_POWER + EVIO_PERCENTAGE_UN_ENERGY
                let energyLabelUom = `Kwh`
                let timeLabelValue = OPC_UN_TIME + CEME_Price_TIME + EVIO_PERCENTAGE_UN_TIME
                let timeLabelUom = `min`
                let parkingTimeLabelValue = OPC_UN_PARKING_TIME + EVIO_PERCENTAGE_UN_PARKING_TIME
                let parkingTimeLabelUom = `min`

                /*
                    It's always relevant to keep all decimal places and round it up in the end, but for this purpose,
                    I think we can show up to 3 decimals in each dimension e round up to 2 in the final cost (unless mobile rounds it all up)
                */

                flat.label = { value: 1, uom: "un" }
                energy.label = { value: Number(energyLabelValue.toFixed(3)), uom: energyLabelUom }
                time.label = { value: Number(timeLabelValue.toFixed(3)), uom: timeLabelUom }
                parking.label = { value: Number(parkingTimeLabelValue.toFixed(3)), uom: parkingTimeLabelUom }

                flat.price = Number(flat.price.toFixed(3))
                energy.price = Number(energy.price.toFixed(3))
                time.price = Number(time.price.toFixed(3))
                parking.price = Number(parking.price.toFixed(3))

                // let fees = await this.getFees({countryCode})
                let total_exc_vat = flat.price + energy.price + time.price + parking.price

                resolve({
                    initialCost: flat.price,
                    costByTime: [
                        {
                            minTime: 0,
                            cost: time.label.value,
                            uom: time.label.uom
                        }
                    ],
                    costByPower: {
                        cost: energy.label.value,
                        uom: energy.label.uom
                    },
                    currency
                })
            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                resolve({
                    initialCost: -1,
                    costByTime: [
                        {
                            minTime: 0,
                            cost: -1,
                            uom: ""
                        }
                    ],
                    costByPower: {
                        cost: -1,
                        uom: ""
                    }
                })
            }
        });
    },
    getTariffCEMEbyId: function (params) {
        const context = "Function getTariffCEMEbyId";
        return new Promise(async (resolve, reject) => {
            const host = process.env.HostTariffCEME + process.env.PathTariffCEME;
            axios.get(host, { params })
                .then((result) => {
                    resolve(result.data.plan);
                })
                .catch((error) => {
                    console.log(`[${context}] Error `, error.message);
                    reject(error);
                });
        });
    },
    getTariffCEMEbyName: function (params) {
        const context = "Function getTariffCEMEbyName";
        return new Promise(async (resolve, reject) => {
            const host = process.env.HostTariffCEME + process.env.PathTariffCEMEbyName;
            axios.get(host, { params })
                .then((result) => {
                    resolve(result.data[0]);
                })
                .catch((error) => {
                    console.log(`[${context}] Error `, error.message);
                    reject(error);
                });
        });
    },
    getTariffCEMERoaming: function (tariffRoaming, source) {
        const context = "Function getTariffCEMERoaming";
        return new Promise(async (resolve, reject) => {
            if (tariffRoaming) {
                let params = {
                    _id: tariffRoaming
                };

                this.getTariffCEMEbyId(params)
                    .then((result) => {
                        resolve(result);
                    })
                    .catch((error) => {
                        console.log(`[${context}][.catch] Error `, error.message);
                        resolve([]);
                    });
            } else {
                let params = {
                    CEME: `EVIO ${source}`
                };

                this.getTariffCEMEbyName(params)
                    .then((result) => {
                        resolve(result);
                    })
                    .catch((error) => {
                        console.log(`[${context}][.catch] Error `, error.message);
                        resolve([]);
                    });
            }
        });
    },
    getInvoiceDocument: function (invoiceId) {
        const context = "Function getInvoiceDocument";
        return new Promise(async (resolve, reject) => {
            let host = process.env.HostBilling + process.env.PathGetInvoiceDocument;
            let params = { invoiceId: invoiceId };

            axios.get(host, { params })
                .then((result) => {
                    if (result.data) {
                        resolve(result.data);
                    }
                    else {
                        resolve(null);
                    };
                })
                .catch((error) => {
                    console.log(`[${context}] Error `, error.message);
                    resolve(null);
                });
        });
    },
    getEvDetails: async function (evId) {
        const context = "Function getEvDetails";
        try {
            let proxyEV = process.env.HostEvs + process.env.PathGetEVDetails;
            let params = {
                _id: evId
            };

            let foundEv = await axios.get(proxyEV, { params })
            return foundEv.data ? foundEv.data : null
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            return null
        }
    },
    getFleetDetails: async function (fleetId) {
        const context = "Function getFleetDetails";
        try {
            let proxyEV = process.env.HostEvs + process.env.PathGetFleetById;
            let params = {
                _id: fleetId
            };

            let foundFleet = await axios.get(proxyEV, { params })
            return foundFleet.data ? foundFleet.data : null
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            return null
        }
    },
    createRestrictionObjects: function (detailedTariff, componentType, restrictions, price, step, uom, currency) {
        const context = "Function createRestrictionObjects";
        try {
            let restrictionObjArray = []
            for (let restriction in restrictions) {
                if (restriction.includes('time') && restrictions[restriction] !== null && restrictions[restriction] !== undefined) {

                    let equalLineIndex = restrictionObjArray.findIndex(obj => obj.restrictionType == 'time')
                    if (equalLineIndex > -1) {
                        restriction.includes('start') ?
                            restrictionObjArray[equalLineIndex].restrictionValues['start'] = restrictions[restriction] :
                            restrictionObjArray[equalLineIndex].restrictionValues['end'] = restrictions[restriction]

                    } else {
                        let obj = {
                            restrictionType: 'time',
                            restrictionUom: 'h',
                            restrictionValues: {},
                            price,
                            step,
                            uom,
                            currency
                        }
                        restriction.includes('start') ? obj.restrictionValues['start'] = restrictions[restriction] : obj.restrictionValues['end'] = restrictions[restriction]

                        restrictionObjArray.push(obj)
                    }
                } else if (restriction.includes('date') && restrictions[restriction] !== null && restrictions[restriction] !== undefined) {
                    let equalLineIndex = restrictionObjArray.findIndex(obj => obj.restrictionType == 'date')
                    if (equalLineIndex > -1) {
                        restriction.includes('start') ?
                            restrictionObjArray[equalLineIndex].restrictionValues['start'] = restrictions[restriction] :
                            restrictionObjArray[equalLineIndex].restrictionValues['end'] = restrictions[restriction]

                    } else {
                        let obj = {
                            restrictionType: 'date',
                            restrictionUom: 'day',
                            restrictionValues: {},
                            price,
                            step,
                            uom,
                            currency
                        }
                        restriction.includes('start') ? obj.restrictionValues['start'] = restrictions[restriction] : obj.restrictionValues['end'] = restrictions[restriction]

                        restrictionObjArray.push(obj)
                    }
                } else if (restriction.includes('kwh') && restrictions[restriction] !== null && restrictions[restriction] !== undefined) {
                    let equalLineIndex = restrictionObjArray.findIndex(obj => obj.restrictionType == 'kwh')
                    if (equalLineIndex > -1) {
                        restriction.includes('min') ?
                            restrictionObjArray[equalLineIndex].restrictionValues['start'] = restrictions[restriction] :
                            restrictionObjArray[equalLineIndex].restrictionValues['end'] = restrictions[restriction]

                    } else {
                        let obj = {
                            restrictionType: 'kwh',
                            restrictionUom: 'kWh',
                            restrictionValues: {},
                            price,
                            step,
                            uom,
                            currency
                        }
                        restriction.includes('min') ? obj.restrictionValues['start'] = restrictions[restriction] : obj.restrictionValues['end'] = restrictions[restriction]

                        restrictionObjArray.push(obj)
                    }
                } else if (restriction.includes('current') && restrictions[restriction] !== null && restrictions[restriction] !== undefined) {
                    let equalLineIndex = restrictionObjArray.findIndex(obj => obj.restrictionType == 'current')
                    if (equalLineIndex > -1) {
                        restriction.includes('min') ?
                            restrictionObjArray[equalLineIndex].restrictionValues['start'] = restrictions[restriction] :
                            restrictionObjArray[equalLineIndex].restrictionValues['end'] = restrictions[restriction]

                    } else {
                        let obj = {
                            restrictionType: 'current',
                            restrictionUom: 'A',
                            restrictionValues: {},
                            price,
                            step,
                            uom,
                            currency
                        }
                        restriction.includes('min') ? obj.restrictionValues['start'] = restrictions[restriction] : obj.restrictionValues['end'] = restrictions[restriction]

                        restrictionObjArray.push(obj)
                    }
                } else if (restriction.includes('power') && restrictions[restriction] !== null && restrictions[restriction] !== undefined) {
                    let equalLineIndex = restrictionObjArray.findIndex(obj => obj.restrictionType == 'power')
                    if (equalLineIndex > -1) {
                        restriction.includes('min') ?
                            restrictionObjArray[equalLineIndex].restrictionValues['start'] = restrictions[restriction] :
                            restrictionObjArray[equalLineIndex].restrictionValues['end'] = restrictions[restriction]

                    } else {
                        let obj = {
                            restrictionType: 'power',
                            restrictionUom: 'kW',
                            restrictionValues: {},
                            price,
                            step,
                            uom,
                            currency
                        }
                        restriction.includes('min') ? obj.restrictionValues['start'] = restrictions[restriction] : obj.restrictionValues['end'] = restrictions[restriction]

                        restrictionObjArray.push(obj)
                    }
                } else if (restriction.includes('duration') && restrictions[restriction] !== null && restrictions[restriction] !== undefined) {
                    let equalLineIndex = restrictionObjArray.findIndex(obj => obj.restrictionType == 'duration')
                    if (equalLineIndex > -1) {
                        restriction.includes('min') ?
                            restrictionObjArray[equalLineIndex].restrictionValues['start'] = restrictions[restriction] :
                            restrictionObjArray[equalLineIndex].restrictionValues['end'] = restrictions[restriction]

                    } else {
                        let obj = {
                            restrictionType: 'duration',
                            restrictionUom: 's',
                            restrictionValues: {},
                            price,
                            step,
                            uom,
                            currency
                        }
                        restriction.includes('min') ? obj.restrictionValues['start'] = restrictions[restriction] : obj.restrictionValues['end'] = restrictions[restriction]

                        restrictionObjArray.push(obj)
                    }
                } else if (restriction.includes('day_of_week') && restrictions[restriction] !== null && restrictions[restriction] !== undefined) {

                    restrictions[restriction].forEach(dayOfWeek => restrictionObjArray.push({
                        restrictionType: 'day',
                        restrictionUom: 'day',
                        restrictionValues: {
                            'start': dayOfWeek,
                            'end': dayOfWeek,
                        },
                        price,
                        step,
                        uom,
                        currency
                    }))
                }
            }

            restrictionObjArray.forEach(obj => {
                let equalRestrictionIndex = detailedTariff[componentType].findIndex(restr => restr.restrictionType == obj.restrictionType)
                if (equalRestrictionIndex > -1) {
                    detailedTariff[componentType][equalRestrictionIndex].values.push(
                        {
                            restrictionUom: obj.restrictionUom,
                            restrictionValues: obj.restrictionValues,
                            price: obj.price,
                            step: obj.step,
                            uom: obj.uom,
                            currency: obj.currency
                        }
                    )
                } else {
                    detailedTariff[componentType].push(
                        {
                            restrictionType: obj.restrictionType,
                            values: [
                                {
                                    restrictionUom: obj.restrictionUom,
                                    restrictionValues: obj.restrictionValues,
                                    price: obj.price,
                                    step: obj.step,
                                    uom: obj.uom,
                                    currency: obj.currency
                                }
                            ]
                        }
                    )
                }
            })
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
        }
    },
    getTariffCemeByDate: function (cemeTariff, startDate) {
        let context = "Function getTariffCemeByDate";
        try {
            if (cemeTariff.tariffsHistory && cemeTariff.tariffsHistory.length > 0) {
                let found = cemeTariff.tariffsHistory.find(obj => startDate >= obj.startDate && startDate <= obj.stopDate)
                if (found) {
                    return found.tariff
                } else {
                    return cemeTariff.tariff
                }
            } else {
                return cemeTariff.tariff
            }
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            return cemeTariff.tariff
        }
    },
    getTimezone: function (latitude, longitude) {
        const context = "Function getTimezone";
        let timeZone = ""
        try {
            if (latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined) {
                timeZone = geoTimeZone.find(latitude, longitude)[0]
            }
            return timeZone
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            return timeZone
        }
    },
    getCEMEandTar: async function (planId, timeZone, source, clientName = "EVIO") {
        const context = "Function getCEMEandTar";
        try {
            let params = {}
            if (planId) {
                params = {
                    _id: String(planId),
                    timeZone,
                };
            } else {
                params = {
                    CEME: `EVIO ${source}`,
                    timeZone,
                };
                if (source === process.env.MobiePlatformCode) {
                    params = {
                        planName: `server_plan_${clientName}`,
                        timeZone,
                    };
                }
            }

            let { tariffCEME, tariffTAR, TAR_Schedule } = await Utils.getPlanScheduleTar(params)

            //If these values are null and default ones
            if (Utils.isEmptyObject(tariffCEME)) {
                tariffCEME = await Utils.getTariffCEME(clientName);
            }

            if (Utils.isEmptyObject(tariffTAR) || Utils.isEmptyObject(TAR_Schedule)) {
                const {
                    schedule,
                    tariffTar,
                } = await getTarTariff(tariffCEME.country, tariffCEME.tariffType, tariffCEME.cycleType, timeZone)
                tariffTAR = tariffTar
                TAR_Schedule = schedule
            }

            return { tariffCEME, tariffTAR, TAR_Schedule }
        } catch (error) {
            console.log(`[${context}] Error `, error.message);

            //CEME
            let tariffCEME = await Utils.getTariffCEME(clientName);

            const {
                schedule,
                tariffTar,
            } = await getTarTariff(tariffCEME.country, tariffCEME.tariffType, tariffCEME.cycleType, timeZone)
            return { tariffCEME, tariffTAR: tariffTar, TAR_Schedule: schedule }
        }
    },
    getPlanScheduleTar: function (params) {
        const context = "Function getPlanScheduleTar";
        return new Promise((resolve, reject) => {
            const host = process.env.HostTariffCEME + process.env.PathTariffCemeAndTar;
            axios.get(host, { params })
                .then((result) => {
                    resolve(result.data);
                })
                .catch((error) => {
                    console.log(`[${context}] Error `, error.message);
                    Sentry.captureException(error);
                    resolve({});
                });
        });
    },
    getChargerLatitudeLongitude: function (geometry) {
        const context = "Function getChargerLatitudeLongitude";
        try {
            let latitude = geometry.coordinates[1]
            let longitude = geometry.coordinates[0]
            return { latitude, longitude }
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            return {}
        }
    },
    calculateCemeAndTar: function (TAR_Schedule, tariffCEME, tariffTAR, total_charging_time, total_energy, sessionStartDate, sessionStopDate, voltageLevel) {
        const context = "Function calculateCemeAndTar"
        try {
            let ceme = {
                flat: {
                    // price: tariffCEME.activationFee ? ( tariffCEME.activationFee.value > 0 ? tariffCEME.activationFee.value : Number(process.env.AD_HOC_Activation_Fee_Wallet) ) : Number(process.env.AD_HOC_Activation_Fee_Wallet)
                    price: 0
                },
                time: {
                    price: 0
                },
                energy: {
                    price: 0
                },
                price: 0,
                info: [],
                tariff: tariffCEME,
            }

            let tar = {
                price: 0,
                info: [],
                tariff: tariffTAR,
            }

            if (TAR_Schedule) {
                let schedules = TAR_Schedule.schedules
                let schedulesWithoutRestrictions = schedules.every(schedule => schedule.weekDays === "all" && schedule.season === "all")
                if (schedulesWithoutRestrictions) {
                    let firstIntervals = schedules.map(schedule => { return Utils.getIntervals(schedule, total_charging_time, total_energy, sessionStartDate, sessionStopDate, voltageLevel, ceme, tar) })
                    Utils.dailyIntervals(firstIntervals, total_charging_time, total_energy, sessionStartDate, sessionStopDate, voltageLevel, ceme, tar)
                    delete ceme.tariff
                    delete tar.tariff
                    return { ceme, tar }
                } else {
                    delete ceme.tariff
                    delete tar.tariff
                    //TODO Contemplate seasons and weekdays restrictions
                    return { ceme, tar }

                }
            } else {
                delete ceme.tariff
                delete tar.tariff
                return { ceme, tar }
            }
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            return {
                ceme: {
                    price: 0,
                    info: [],
                },
                tar: {
                    price: 0,
                    info: [],
                }
            }
        }
    },
    getIntervals: function (schedule, total_charging_time, total_energy, sessionStartDate, sessionStopDate, voltageLevel, ceme, tar) {
        const context = "Function getIntervals"
        try {
            /*
                Get timestamp intervals for each scheduleCEME
            */
            // Start
            let scheduleStartHours = parseInt(schedule.startTime.slice(0, 2))
            let scheduleStartMinutes = parseInt(schedule.startTime.slice(3))

            let momentObjStart = moment(sessionStartDate).utc()
            momentObjStart.set({ hour: scheduleStartHours, minute: scheduleStartMinutes, second: 0, millisecond: 0 })
            let startDateString = momentObjStart.toISOString()
            let startDateTimestamp = Date.parse(startDateString)

            // End

            let scheduleEndHours = parseInt(schedule.endTime.slice(0, 2))
            let scheduleEndMinutes = parseInt(schedule.endTime.slice(3))

            let momentObjEnd = moment(sessionStartDate).utc()
            momentObjEnd.set({ hour: scheduleEndHours, minute: scheduleEndMinutes, second: 0, millisecond: 0 })
            let endDateString = momentObjEnd.toISOString()
            let endDateTimestamp = Date.parse(endDateString)

            let sessionStartDateTimestamp = Date.parse(sessionStartDate)
            let sessionStopDateTimestamp = Date.parse(sessionStopDate)

            let totalChargingTimeMinutes = Utils.round(total_charging_time * 60, 6)
            let consumedEnergyPerMinute = totalChargingTimeMinutes > 0 ? Utils.round(total_energy / totalChargingTimeMinutes, 6) : 0

            let { periodInMinutes, periodConsumedEnergy, startPeriod, endPeriod } = Utils.getPeriodTimeAndEnergy(sessionStartDateTimestamp, startDateTimestamp, sessionStopDateTimestamp, endDateTimestamp, consumedEnergyPerMinute)

            // CEME
            Utils.calculateCEME(schedule.tariffType, periodConsumedEnergy, periodInMinutes, ceme, startPeriod, endPeriod, voltageLevel)

            // TAR
            Utils.calculateTAR(schedule.tariffType, periodConsumedEnergy, periodInMinutes, voltageLevel, tar, startPeriod, endPeriod)

            return {
                start: startDateTimestamp,
                stop: endDateTimestamp,
                tariffType: schedule.tariffType
            }
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            return null
        }
    },
    getPeriodTimeAndEnergy: function (sessionStartDateTimestamp, startDateTimestamp, sessionStopDateTimestamp, endDateTimestamp, consumedEnergyPerMinute) {
        try {
            let periodInMinutes = 0
            let periodConsumedEnergy = 0
            let startPeriod = new Date(startDateTimestamp).toISOString()
            let endPeriod = new Date(endDateTimestamp).toISOString()
            if (sessionStartDateTimestamp <= startDateTimestamp && sessionStopDateTimestamp >= endDateTimestamp) {
                periodInMinutes = (endDateTimestamp - startDateTimestamp) / (1000 * 60)
                periodConsumedEnergy = Utils.round(consumedEnergyPerMinute * periodInMinutes, 4)
                startPeriod = new Date(startDateTimestamp).toISOString()
                endPeriod = new Date(endDateTimestamp).toISOString()
            } else if (sessionStartDateTimestamp >= startDateTimestamp && sessionStopDateTimestamp <= endDateTimestamp) {
                periodInMinutes = (sessionStopDateTimestamp - sessionStartDateTimestamp) / (1000 * 60)
                periodConsumedEnergy = Utils.round(consumedEnergyPerMinute * periodInMinutes, 4)
                startPeriod = new Date(sessionStartDateTimestamp).toISOString()
                endPeriod = new Date(sessionStopDateTimestamp).toISOString()
            } else if (sessionStartDateTimestamp <= startDateTimestamp && sessionStopDateTimestamp > startDateTimestamp) {
                periodInMinutes = (sessionStopDateTimestamp - startDateTimestamp) / (1000 * 60)
                periodConsumedEnergy = Utils.round(consumedEnergyPerMinute * periodInMinutes, 4)
                startPeriod = new Date(startDateTimestamp).toISOString()
                endPeriod = new Date(sessionStopDateTimestamp).toISOString()
            } else if (sessionStartDateTimestamp < endDateTimestamp && sessionStopDateTimestamp >= endDateTimestamp) {
                periodInMinutes = (endDateTimestamp - sessionStartDateTimestamp) / (1000 * 60)
                periodConsumedEnergy = Utils.round(consumedEnergyPerMinute * periodInMinutes, 4)
                startPeriod = new Date(sessionStartDateTimestamp).toISOString()
                endPeriod = new Date(endDateTimestamp).toISOString()
            }
            return { periodInMinutes, periodConsumedEnergy, startPeriod, endPeriod }
        } catch (error) {
            return { periodInMinutes: 0, periodConsumedEnergy: 0, startPeriod: new Date(startDateTimestamp).toISOString(), endPeriod: new Date(endDateTimestamp).toISOString() }
        }
    },
    calculateCEME: function (tariffType, periodConsumedEnergy, periodInMinutes, ceme, startPeriod, endPeriod, voltageLevel) {
        const context = "Function calculateCEME"
        try {
            // let CEME_FLAT = ceme.tariff.tariff.find(elem => ( elem.tariffType === tariffType && elem.uom.includes(process.env.flatDimension) ) )
            let CEME_POWER = ceme.tariff.tariff.find(elem => (elem.tariffType === tariffType && elem.uom.includes(process.env.powerDimension) && elem.voltageLevel === voltageLevel))
            let CEME_TIME = ceme.tariff.tariff.find(elem => (elem.tariffType === tariffType && elem.uom.includes(process.env.timeDimension) && elem.voltageLevel === voltageLevel))

            // let CEME_Price_FLAT = CEME_FLAT ? CEME_FLAT.price : 0
            let CEME_Price_POWER = CEME_POWER ? CEME_POWER.price : 0
            let CEME_Price_TIME = CEME_TIME ? CEME_TIME.price : 0

            // let flatPrice = CEME_Price_FLAT
            let energyPrice = Utils.round(CEME_Price_POWER * periodConsumedEnergy, 6)
            let timePrice = Utils.round(CEME_Price_TIME * periodInMinutes, 6)

            let cemePrice = /*flatPrice + */ energyPrice + timePrice
            if (periodConsumedEnergy > 0 || periodInMinutes > 0) {
                //Add prices
                // ceme.price += cemePrice
                // ceme.flat.price += flatPrice
                ceme.energy.price += energyPrice
                ceme.time.price += timePrice

                //Push details
                ceme.info.push({
                    startPeriod,
                    endPeriod,
                    // flatPrice,
                    energyPrice,
                    timePrice,
                    totalPrice: cemePrice,
                    consumedEnergykWh: periodConsumedEnergy,
                    consumedTimeMinutes: periodInMinutes,
                    tariff: ceme.tariff.tariff.find(element => element.tariffType === tariffType && element.voltageLevel === voltageLevel),
                })
            }
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
        }
    },
    calculateTAR: function (tariffType, periodConsumedEnergy, periodInMinutes, voltageLevel, tar, startPeriod, endPeriod) {
        const context = "Function calculateTAR"
        try {
            let tarTariff = tar.tariff.tariff.find(element => element.voltageLevel === voltageLevel && element.tariffType === tariffType)
            let tarPrice = Utils.round(tarTariff.price * periodConsumedEnergy, 6)
            if (periodConsumedEnergy > 0 || periodInMinutes > 0) {
                tar.price += tarPrice
                tar.info.push({
                    startPeriod,
                    endPeriod,
                    totalPrice: tarPrice,
                    consumedEnergykWh: periodConsumedEnergy,
                    consumedTimeMinutes: periodInMinutes,
                    tariff: tarTariff
                })
            }
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
        }
    },
    dailyIntervals: function (firstIntervals, total_charging_time, total_energy, sessionStartDate, sessionStopDate, voltageLevel, ceme, tar) {
        // We add one day just to be sure to cover all charging time period
        let multiplier = Math.ceil(total_charging_time / 24) + 1
        let hoursInDay = 24
        for (let i = 1; i <= multiplier; i++) {
            let millisecondsToAdd = i * hoursInDay * 3600 * 1000
            Utils.calculateOtherIntervals(firstIntervals, millisecondsToAdd, total_charging_time, total_energy, sessionStartDate, sessionStopDate, voltageLevel, ceme, tar)
        }
        ceme.price = ceme.flat.price + ceme.time.price + ceme.energy.price
    },
    calculateOtherIntervals: function (firstIntervals, millisecondsToAdd, total_charging_time, total_energy, sessionStartDate, sessionStopDate, voltageLevel, ceme, tar) {
        const context = "Function calculateOtherIntervals"
        try {
            for (let interval of firstIntervals) {

                // Start
                let startDateTimestamp = interval.start + millisecondsToAdd

                // End
                let endDateTimestamp = interval.stop + millisecondsToAdd

                let sessionStartDateTimestamp = Date.parse(sessionStartDate)
                let sessionStopDateTimestamp = Date.parse(sessionStopDate)

                let totalChargingTimeMinutes = Utils.round(total_charging_time * 60, 6)
                let consumedEnergyPerMinute = Utils.round(total_energy / totalChargingTimeMinutes, 6)

                let { periodInMinutes, periodConsumedEnergy, startPeriod, endPeriod } = Utils.getPeriodTimeAndEnergy(sessionStartDateTimestamp, startDateTimestamp, sessionStopDateTimestamp, endDateTimestamp, consumedEnergyPerMinute)

                // CEME
                Utils.calculateCEME(interval.tariffType, periodConsumedEnergy, periodInMinutes, ceme, startPeriod, endPeriod, voltageLevel)

                // TAR
                Utils.calculateTAR(interval.tariffType, periodConsumedEnergy, periodInMinutes, voltageLevel, tar, startPeriod, endPeriod)
            }
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
        }
    },
    getTarUnitPrices: function (tariffTAR) {
        const context = "Function calculateOtherIntervals"
        try {
            let unitPriceTAREmptyBT = -0.018
            let unitPriceTAREmptyMT = -0.0215
            let unitPriceTAROutEmptyBT = 0.0299
            let unitPriceTAROutEmptyMT = 0.0164
            if (tariffTAR) {
                if (tariffTAR.tariff) {
                    let emptyBT = tariffTAR.tariff.find(element => element.tariffType === process.env.TariffTypeEmpty && element.voltageLevel === process.env.voltageLevelBT)
                    let emptyMT = tariffTAR.tariff.find(element => element.tariffType === process.env.TariffTypeEmpty && element.voltageLevel === process.env.voltageLevelMT)
                    let outEmptyBT = tariffTAR.tariff.find(element => element.tariffType === process.env.TariffTypeOutEmpty && element.voltageLevel === process.env.voltageLevelBT)
                    let outEmptyMT = tariffTAR.tariff.find(element => element.tariffType === process.env.TariffTypeOutEmpty && element.voltageLevel === process.env.voltageLevelMT)

                    if (emptyBT) {
                        unitPriceTAREmptyBT = emptyBT.price
                    }

                    if (emptyMT) {
                        unitPriceTAREmptyMT = emptyMT.price
                    }

                    if (outEmptyBT) {
                        unitPriceTAROutEmptyBT = outEmptyBT.price
                    }

                    if (outEmptyMT) {
                        unitPriceTAROutEmptyMT = outEmptyMT.price
                    }
                }
            }
            return {
                unitPriceTAREmptyBT,
                unitPriceTAREmptyMT,
                unitPriceTAROutEmptyBT,
                unitPriceTAROutEmptyMT,
            }
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            return {
                "unitPriceTAREmptyBT": -0.018,
                "unitPriceTAREmptyMT": -0.0215,
                "unitPriceTAROutEmptyBT": 0.0299,
                "unitPriceTAROutEmptyMT": 0.0164,
            }
        }
    },
    getCemeUnitPrice: function (tariffCEME, tariffType, voltageLevel) {
        const context = "Function getCemeUnitPrice"
        try {
            let cemePrice = 0.2
            if (tariffCEME) {
                if (tariffCEME.tariff) {
                    let cemeTariff = tariffCEME.tariff.find(elem => elem.tariffType === tariffType && elem.voltageLevel === voltageLevel)
                    if (!cemeTariff) {
                        cemePrice = tariffCEME.tariff.find(elem => elem.tariffType === tariffType).price
                    } else {
                        cemePrice = cemeTariff.price
                    }
                }
            }
            return cemePrice ? cemePrice : 0.2
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            return 0.2
        }
    },
    walletFindOne: async function (userId) {
        const context = "Funciton walletFindOne";
        try {
            let host = process.env.HostPayments + process.env.PathGetWalletByUser + userId
            let foundWallet = await axios.get(host)
            return foundWallet.data ? foundWallet.data : null
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return null
        }
    },
    findOnePlatform: async function (query) {
        return await Platforms.findOne(query).lean()
    },
    validateEV: function (evId, userId, evDetails) {
        const context = "Function validateEV";
        return new Promise(async (resolve, reject) => {
            try {

                let userIdWillPay;
                let userIdToBilling;

                //console.log("evId", evId)
                if (evId != '-1') {
                    let evFound = evDetails ?? await Utils.getEvDetails(evId)
                    if (evFound) {

                        if (evFound.userId === userId) {

                            let response = {
                                evFound: evFound,
                                userIdWillPay: userId,
                                userIdToBilling: userId,
                            };

                            resolve(response);
                        } else {

                            let foundDriver = evFound.listOfDrivers.find(driver => {
                                return driver.userId === userId;
                            });

                            let foundGourpDriver = evFound.listOfGroupDrivers.filter(groups => {
                                return groups.listOfDrivers.find(driver => {
                                    return driver.driverId === userId;
                                });
                            });

                            if (foundDriver) {
                                //validate who pays
                                if (foundDriver.paymenteBy === process.env.EVPaymenteByDriver) {
                                    userIdWillPay = userId;
                                } else {
                                    userIdWillPay = evFound.userId;
                                };

                                //validate who to bill
                                if (foundDriver.billingBy === process.env.EVBillingByDriver) {
                                    userIdToBilling = userId;
                                } else {
                                    userIdToBilling = evFound.userId;
                                };

                            } else if (foundGourpDriver.length > 0) {

                                //validate who pays
                                if (foundGourpDriver[0].paymenteBy === process.env.EVPaymenteByDriver) {
                                    userIdWillPay = userId;
                                } else {
                                    userIdWillPay = evFound.userId;
                                };

                                //validate who to bill
                                if (foundGourpDriver[0].billingBy === process.env.EVBillingByDriver) {
                                    userIdToBilling = userId;
                                } else {
                                    userIdToBilling = evFound.userId;
                                };
                            } else {
                                userIdWillPay = userId;
                                userIdToBilling = userId;
                            };

                            let response = {
                                evFound: evFound,
                                userIdWillPay: userIdWillPay,
                                userIdToBilling: userIdToBilling,
                            };
                            resolve(response);

                        };

                    } else {

                        let response = {
                            evFound: '-1',
                            userIdWillPay: userId,
                            userIdToBilling: userId,
                        };
                        resolve(response);
                    };
                } else {
                    let response = {
                        evFound: '-1',
                        userIdWillPay: userId,
                        userIdToBilling: userId,
                    };
                    resolve(response);

                };

            } catch (error) {
                console.log(`[${context}] Error `, error.message);

                let response = {
                    evFound: '-1',
                    userIdWillPay: userId,
                    userIdToBilling: userId,
                };
                resolve(response);
            }
        })
    },
    createExcelBuffer: async (excelName, columns, lines) => {
        const context = "Function createExcelBuffer"
        try {
            let workbook = new Excel.Workbook();
            let worksheet = workbook.addWorksheet(`${excelName}`);
            worksheet.columns = columns;
            let data = lines;
            data.forEach((e) => {
                worksheet.addRow(e);
            });
            const buffer = await workbook.xlsx.writeBuffer();
            return buffer
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            return null
        }
    },
    getEmailToSend: function () {
        const context = "Function getEmailToSend"
        try {
            let emailTo = ''
            let emailCc = ''
            if (process.env.NODE_ENV === 'production') {
                emailTo = process.env.EMAIL_USER
                emailCc = ''
            }
            else if (process.env.NODE_ENV === 'pre-production') {
                emailTo = process.env.EMAIL_PRE
                emailCc = ''
            }
            else {
                emailTo = process.env.EMAIL_PRE
                emailCc = ''
            }
            return { emailTo, emailCc }
        } catch (error) {
            console.log(`[${context}] Error `, error.message)
            return { emailTo: '', emailCc: '' }

        }
    },
    sendExcelToEmail: function (buffer, email, subject, fileName, emailscc, html) {
        const context = "Function sendExcelToEmail";
        try {
            const transporter = nodemailer.createTransport({
                maxConnections: 2,
                maxMessages: 1,
                pool: true,
                host: 'smtp.office365.com',
                port: 587,
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASSWORD
                }
            });

            const mailOptions = {
                source: '"evio Support" <support@go-evio.com>',
                from: '"evio Support" <support@go-evio.com>',
                to: email,
                cc: emailscc,
                subject: subject,
                html: html,
                attachments:
                {
                    filename: fileName,
                    content: buffer,
                    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                }
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log(error);
                } else {
                    console.log('Email sent!');
                };
            });
        }
        catch (error) {
            console.log(`[${context}] Error `, error.message);
        }
    },
    getOcpiActivationFee: function (end_date_time, chargingSession, opcPrice, tarPrice, cemePrice, iecPrice, mobiEGrant, vat, mobieGrantVat) {
        const context = "Function getOcpiActivationFee"
        let activationFee = Number(process.env.AD_HOC_Activation_Fee_Wallet)
        try {
            if (end_date_time.getFullYear() == 2021) {
                if (chargingSession.paymentType == "AD_HOC" && chargingSession.paymentMethod == "card") {
                    activationFee = Number(process.env.AD_HOC_Activation_Fee_Card_2021);
                } else if (chargingSession.paymentType == "AD_HOC" && chargingSession.paymentMethod == "wallet") {
                    activationFee = Number(process.env.AD_HOC_Activation_Fee_Wallet_2021);
                } else {
                    activationFee = Number(process.env.AD_HOC_Activation_Fee_Wallet_2021);
                }
            }
            else {
                if (chargingSession.paymentType == "AD_HOC" && chargingSession.paymentMethod == "card") {
                    activationFee = chargingSession.tariffCEME.activationFeeAdHoc ? (chargingSession.tariffCEME.activationFeeAdHoc.value > 0 ? chargingSession.tariffCEME.activationFeeAdHoc.value : Number(process.env.AD_HOC_Activation_Fee_Card)) : Number(process.env.AD_HOC_Activation_Fee_Card)
                } else if (chargingSession.paymentType == "AD_HOC" && chargingSession.paymentMethod == "wallet") {
                    activationFee = chargingSession.tariffCEME.activationFee ? (chargingSession.tariffCEME.activationFee.value > 0 ? chargingSession.tariffCEME.activationFee.value : Number(process.env.AD_HOC_Activation_Fee_Wallet)) : Number(process.env.AD_HOC_Activation_Fee_Wallet)
                } else {
                    activationFee = chargingSession.tariffCEME.activationFee ? (chargingSession.tariffCEME.activationFee.value > 0 ? chargingSession.tariffCEME.activationFee.value : Number(process.env.AD_HOC_Activation_Fee_Wallet)) : Number(process.env.AD_HOC_Activation_Fee_Wallet)
                }
            }

            if (chargingSession.paymentStatus === "PAID" && end_date_time.toISOString() < process.env.adjustEvioTariffDeployDate) {
                return activationFee
            } else {
                if ((opcPrice + tarPrice + cemePrice + iecPrice) < Number(process.env.minimumBilingValue)) {
                    // const fixValue = (opcPrice + tarPrice + cemePrice + iecPrice + activationFee + mobiEGrant)
                    // return activationFee - fixValue
                    activationFee = ((-mobiEGrant * (1 + mobieGrantVat)) / (1 + vat)) - (opcPrice + tarPrice + cemePrice + iecPrice)
                    return activationFee
                } else {
                    return activationFee
                }
            }
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            if (chargingSession.paymentType == "AD_HOC" && chargingSession.paymentMethod == "card") {
                activationFee = Number(process.env.AD_HOC_Activation_Fee_Card);
            } else if (chargingSession.paymentType == "AD_HOC" && chargingSession.paymentMethod == "wallet") {
                activationFee = Number(process.env.AD_HOC_Activation_Fee_Wallet);
            } else {
                activationFee = Number(process.env.AD_HOC_Activation_Fee_Wallet);
            }

            if (chargingSession.paymentStatus === "PAID" && end_date_time.toISOString() < process.env.adjustEvioTariffDeployDate) {
                return activationFee
            } else {
                if ((opcPrice + tarPrice + cemePrice + iecPrice) < Number(process.env.minimumBilingValue)) {
                    // const fixValue = (opcPrice + tarPrice + cemePrice + iecPrice + activationFee + mobiEGrant)
                    // return activationFee - fixValue
                    activationFee = ((-mobiEGrant * (1 + mobieGrantVat)) / (1 + vat)) - (opcPrice + tarPrice + cemePrice + iecPrice)
                    return activationFee
                } else {
                    return activationFee
                }
            }
        }
    },
    getMobiEDiscount: function (cdr) {
        const context = "Function getMobiEDiscount"
        try {
            if (cdr) {
                if (cdr.mobie_cdr_extension) {
                    if (cdr.mobie_cdr_extension.usage) {
                        return cdr?.mobie_cdr_extension?.usage?.apoio_mobilidade_eletrica_ceme ? -cdr?.mobie_cdr_extension?.usage?.apoio_mobilidade_eletrica_ceme : 0
                    }
                }
            }
            return null
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            return null
        }
    },
    getDefaultOPCTariff: async function () {
        const context = "Function getDefaultOPCTariff"
        try {
            const fields = {
                _id: 0,
                __v: 0,
                createdAt: 0,
                updatedAt: 0,
                source: 0,
                "elements._id": 0,
                "elements.restrictions._id": 0,
                "elements.price_components._id": 0,
                "elements.price_components._id": 0,
                "elements.price_components.price_round._id": 0,
                "elements.price_components.step_round._id": 0
            }
            return await DefaultTariffs.findOne({} , fields).lean()
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            return null
        }
    },
    adjustRestrictions: function (restrictions) {
        const context = "Function adjustRestrictions"
        try {
            if (restrictions) {
                delete restrictions._id
                if (restrictions['day_of_week'] && restrictions['day_of_week'].length === 0) {
                    delete restrictions['day_of_week']
                }
            }
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
        }
    },
    getOperationalStatus: function (plugs) {
        const context = "Function getOperationalStatus";
        try {
            return plugs.every(plug => plug.subStatus === "REMOVED") ? "REMOVED" : "APPROVED"
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            return "APPROVED"
        };
    },
    notificationManagement: async function (session) {
        const context = "Function notificationManagement";
        try {
            /*
                The algorithm runs on a specific setting of parameters.
                The first of them is the minimum number of readingPoints.
                The longer the number, the better.

                Sometimes there can be sessions with a really small value of readingPoints, that's why the
                minimum value is so low (5)

                Only the readingPoints of the last hour are valid, to prevent communication errors and misleading notifications

                The lastReadingPoint must be from the last 15 minutes
            */

            //  ===== Parameters and restrictions ===== //
            let minimumValidReadingPoints = 5
            let allReadingPointsIntervalOfTime = 60 //minutes
            let lastReadingPointIntervalOfTime = 15 //minutes
            let endOfChargeLimit = 0.05
            //  ======================================= //


            let { userId, readingPoints, _id, chargerType, endOfEnergyDate, clientName, tariff, tariffOPC, notificationsHistory } = session
            // Get all needed values with applied restrictions
            let {
                validReadingPoints,
                nLastValidPoints,
                allReadingPointsDateLimit,
                lastReadingPointDateLimit,
                firstReadDate,
                lastReadDate,
                currentDate
            } = Utils.readingPointsRestrictions(readingPoints, minimumValidReadingPoints, allReadingPointsIntervalOfTime, lastReadingPointIntervalOfTime)

            // The algorithm runs if theres a minimum of valid reading points
            if (validReadingPoints.length >= minimumValidReadingPoints) {

                // The algorithm runs if valid reading points are newer than the limit of allReadingPointsIntervalOfTime
                if (firstReadDate >= allReadingPointsDateLimit) {

                    // The algorithm runs if the last reading point is newer than the limit of lastReadingPointIntervalOfTime
                    if (lastReadDate >= lastReadingPointDateLimit) {

                        //Check if no energy has been consumed comparing the last readingPoint with the first of the last 5
                        if (Utils.sendNoChargingNotification(notificationsHistory) && Utils.noEnergyConsumed(nLastValidPoints)) {
                            let updateDate = moment.utc(nLastValidPoints[0].readDate).format()
                            let updateEnergy = nLastValidPoints[0].totalPower

                            let newValues = {
                                $push: {
                                    notificationsHistory: {
                                        type: NotificationType.CHARGING_SESSION_EV_NOT_CHARGING,
                                        timestamp: updateDate,
                                        totalPower: updateEnergy,
                                    }
                                },
                                $set: {
                                    endOfEnergyDate: updateDate
                                }
                            }
                            await Utils.updateSessionValues(_id, newValues)
                            await notifySessionEvNotCharging(tariffOPC, userId);
                        } else {
                            if (Utils.energyConsumed(nLastValidPoints)) {

                                if (Utils.sendChargingNotification(notificationsHistory)) {
                                    let updateDate = moment.utc(nLastValidPoints[nLastValidPoints.length - 1].readDate).format()
                                    let updateEnergy = nLastValidPoints[nLastValidPoints.length - 1].totalPower

                                    let newValues = {
                                        $push: {
                                            notificationsHistory: {
                                                type: NotificationType.CHARGING_SESSION_EV_CHARGING,
                                                timestamp: updateDate,
                                                totalPower: updateEnergy,
                                            }
                                        }
                                    }

                                    await Utils.updateSessionValues(_id, newValues)
                                    await notifySessionEvCharging(userId);
                                }
                            }
                        }
                    }
                } else {
                    console.log(`[${context}] Session with id ${_id} and chargerType ${chargerType} not descending its readingPoints`)
                }

            } else {
                if (readingPoints.length >= minimumValidReadingPoints) {

                    //Check if no energy has been consumed comparing the last readingPoint with the first of the last 5
                    let lastValidPoints = readingPoints.slice(-minimumValidReadingPoints)
                    if (Utils.sendNoChargingNotification(notificationsHistory) && lastValidPoints.every(element => !element.totalPower)) {
                        let updateDate = moment.utc(lastValidPoints[0].readDate).format()
                        let updateEnergy = lastValidPoints[0].totalPower

                        let newValues = {
                            $push: {
                                notificationsHistory: {
                                    type: NotificationType.CHARGING_SESSION_EV_NOT_CHARGING,
                                    timestamp: updateDate,
                                    totalPower: updateEnergy,
                                }
                            },
                            $set: {
                                endOfEnergyDate: updateDate
                            }
                        }
                        await Utils.updateSessionValues(_id, newValues)
                        await notifySessionEvNotCharging(tariffOPC, userId);
                    } else {
                        let positiveIndex = lastValidPoints.findLastIndex(elem => elem.totalPower > 0)
                        let positivePoints = positiveIndex >= 0 ? lastValidPoints.slice(0, positiveIndex + 1) : []
                        if (positivePoints.length > 1 && Utils.energyConsumed(positivePoints)) {

                            if (Utils.sendChargingNotification(notificationsHistory)) {
                                let updateDate = moment.utc(positivePoints[positivePoints.length - 1].readDate).format()
                                let updateEnergy = positivePoints[positivePoints.length - 1].totalPower

                                let newValues = {
                                    $push: {
                                        notificationsHistory: {
                                            type: NotificationType.CHARGING_SESSION_EV_CHARGING,
                                            timestamp: updateDate,
                                            totalPower: updateEnergy,
                                        }
                                    }
                                }

                                await Utils.updateSessionValues(_id, newValues)
                                await notifySessionEvCharging(userId);
                            }
                        }
                    }
                } else {
                    let positiveIndex = readingPoints.findLastIndex(elem => elem.totalPower > 0)
                    let positivePoints = positiveIndex >= 0 ? readingPoints.slice(0, positiveIndex + 1) : []
                    if (positivePoints.length > 1 && Utils.energyConsumed(positivePoints)) {

                        if (Utils.sendChargingNotification(notificationsHistory)) {
                            let updateDate = moment.utc(positivePoints[positivePoints.length - 1].readDate).format()
                            let updateEnergy = positivePoints[positivePoints.length - 1].totalPower

                            let newValues = {
                                $push: {
                                    notificationsHistory: {
                                        type: NotificationType.CHARGING_SESSION_EV_CHARGING,
                                        timestamp: updateDate,
                                        totalPower: updateEnergy,
                                    }
                                }
                            }

                            await Utils.updateSessionValues(_id, newValues)
                            await notifySessionEvCharging(userId);
                        }
                    }
                }
            }
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
        }
    },
    readingPointsRestrictions: function (readingPoints, minimumValidReadingPoints, allReadingPointsIntervalOfTime, lastReadingPointIntervalOfTime) {
        const context = "Function readingPointsRestrictions";
        try {
            let currentDate = moment.utc(new Date().toISOString())
            //We evaluate only reading points with a totalPower bigger than 0
            let validReadingPoints = readingPoints.filter(point => point.totalPower > 0)

            // Last minimumValidReadingPoints
            let nLastValidPoints = validReadingPoints.slice(-minimumValidReadingPoints)

            // All Reading Points Restriction
            let allReadingPointsDateLimit = moment.utc(currentDate).add(-allReadingPointsIntervalOfTime, 'minutes').format()

            // Last reading point Restriction
            let lastReadingPointDateLimit = moment.utc(currentDate).add(-lastReadingPointIntervalOfTime, 'minutes').format()

            //First valid read date
            let firstReadDate = nLastValidPoints.length > 0 ? moment.utc(nLastValidPoints[0].readDate).format() : ""

            //Last valid read date
            let lastReadDate = nLastValidPoints.length > 0 ? moment.utc(nLastValidPoints[nLastValidPoints.length - 1].readDate).format() : ""

            return { validReadingPoints, nLastValidPoints, allReadingPointsDateLimit, lastReadingPointDateLimit, firstReadDate, lastReadDate, currentDate }

        } catch {
            console.log(`[${context}] Error `, error.message);
            return { validReadingPoints: [], nLastValidPoints: [], allReadingPointsDateLimit: "", lastReadingPointDateLimit: "", firstReadDate: "", lastReadDate: "" }
        }
    },
    noEnergyConsumed: function (nLastValidPoints) {
        const context = "Function noEnergyConsumed"
        try {
            let energyDiff = (nLastValidPoints[nLastValidPoints.length - 1].totalPower - nLastValidPoints[0].totalPower) / 1000
            let firstPointDate = moment.utc(nLastValidPoints[0].readDate)
            let lastPointDate = moment.utc(nLastValidPoints[nLastValidPoints.length - 1].readDate)
            let timeDiff = moment.duration(lastPointDate.diff(firstPointDate)).asHours()
            return timeDiff > 0 ? ((energyDiff / timeDiff) < 1 ? true : false) : false
        } catch (error) {
            console.log(`[${context}] Error `, error)
            return false
        }
    },

    sendNoChargingNotification: function (notificationsHistory) {
        const context = "Function sendNoChargingNotification"
        try {
            if (notificationsHistory) {
                let lastRelevantNotification = notificationsHistory.findLast(element => element.type !== 'CHARGING_SESSION_DATA')
                return lastRelevantNotification?.type === 'CHARGING_SESSION_START' || lastRelevantNotification?.type === 'CHARGING_SESSION_EV_CHARGING'
            } else {
                return false
            }
        } catch (error) {
            console.log(`[${context}] Error `, error)
            return false
        }
    },
    energyConsumed: function (nLastValidPoints) {
        const context = "Function energyConsumed"
        try {
            let energyDiff = (nLastValidPoints[nLastValidPoints.length - 1].totalPower - nLastValidPoints[nLastValidPoints.length - 2].totalPower) / 1000
            let firstPointDate = moment.utc(nLastValidPoints[nLastValidPoints.length - 2].readDate)
            let lastPointDate = moment.utc(nLastValidPoints[nLastValidPoints.length - 1].readDate)
            let timeDiff = moment.duration(lastPointDate.diff(firstPointDate)).asHours()
            return timeDiff > 0 ? ((energyDiff / timeDiff) >= 1 ? true : false) : false
        } catch (error) {
            console.log(`[${context}] Error `, error)
            return false
        }
    },
    sendChargingNotification: function (notificationsHistory) {
        const context = "Function sendChargingNotification"
        try {
            if (notificationsHistory) {
                let lastRelevantNotification = notificationsHistory.findLast(element => element.type !== 'CHARGING_SESSION_DATA')
                if (!lastRelevantNotification) return false
                let lastRelevantReadDate = moment.utc(lastRelevantNotification.timestamp)
                let currentDate = moment.utc()
                let timeDiff = moment.duration(currentDate.diff(lastRelevantReadDate)).asMinutes()
                return (lastRelevantNotification.type === 'CHARGING_SESSION_START' && timeDiff >= 10) || lastRelevantNotification.type === 'CHARGING_SESSION_EV_NOT_CHARGING'
            } else {
                return false
            }
        } catch (error) {
            console.log(`[${context}] Error `, error)
            return false
        }
    },
    updateSessionValues: async function (_id, body) {
        let context = "Function updateSessionValues";
        try {
            if (body['$push']) {
                if (body['$push'].notificationsHistory) {
                    if (body['$push'].notificationsHistory.type === 'CHARGING_SESSION_EV_CHARGING') {
                        body['$unset'] = { endOfEnergyDate: 1 }
                    }
                }
            }

            let foundSession = await Session.findOneAndUpdate({ _id }, body, { new: true })

        } catch (error) {
            console.log(`[${context}] Error `, error.message);
        }
    },

    getRequest: async function (host, params) {
        const context = "Function getRequest";
        try {
            let resp = await axios.get(host, { params })
            if (resp.data) {
                return resp.data
            } else {
                return []
            }
        } catch (error) {
            console.log(`[${context}] Error `, error.data ? error.data : error.message);
            return []
        }
    },

    sendStartNotification: async function (session) {
        const context = "Function sendStartNotification"
        try {
            if (session.status === global.SessionStatusRunning && session.notificationsHistory && !session.notificationsHistory.find(elem => elem.type === 'CHARGING_SESSION_START')) {
                UtilsFirebase.startFirebaseNotification([session]);
            }
        } catch (error) {
            console.log(`[${context}] Error `, error)
        }
    },
    sendStopNotification: async function (session) {
        const context = "Function sendStopNotification"
        try {
            if (session.status === global.SessionStatusStopped && session.notificationsHistory && !session.notificationsHistory.find(elem => elem.type === 'CHARGING_SESSION_STOP')) {
                UtilsFirebase.stopFirebaseNotification([session]);
            }
        } catch (error) {
            console.log(`[${context}] Error `, error)
        }
    },
    getHubjectCharger: function (plugId) {
        const context = "[Function getHubjectCharger]"
        return new Promise(function (resolve, reject) {
            try {
                if (!plugId) {
                    console.log(`[${context}] Error - Missing input plugId`)
                    reject(null)
                }
                let params = {
                    plugId: plugId
                }
                axios.get(global.publicNetworkHubjectChargerByPlugID, { params }).then(function (charger) {
                    if (charger) resolve(charger.data)
                    else {
                        console.log(`[${context}] No charger returned for plugID : `, plugId)
                        resolve(null)
                    }
                })
            } catch (error) {
                console.log(`[${context}] Error `, error)
                reject(null)
            }
        })
    },
    getHubjectTariffIdStart: async function (plug, startDate, chargerCountryCode) {
        const context = "[Function getHubjectTariffIdStart]"
        try {
            if (!plug || !startDate || !chargerCountryCode) {
                console.log(`[${context}] Error - Missing input fields`)
                return null
            }
            // console.log("le plug: ", plug)
            if (!plug.tariffId || plug.tariffId.length < 1) {
                console.log(`[${context}] Error - no tariffsID for Hubject plug`, plug.tariffId)
                return null
            }
            // it will always be used to this type of start the now date
            let tariffPlug = {}
            for (let tarifID of plug.tariffId) {
                tariff = await Utils.getTariffOPC(tarifID)
                if (!tariff) continue

                if (!Utils.passTariffRestrictions(tariff.elements, plug.power, plug.connectorPowerType, startDate, chargerCountryCode)) continue

                tariffPlug.tariffId = tarifID
                // check if tariff is the default
                let defaultTariffName = tariff.party_id + "_Default"
                // in case is not the default we must add the elements of the default tariff for the charging session, if exist's
                if (defaultTariffName !== tarifID) {
                    let tariffDefault = await Utils.getTariffOPC(defaultTariffName)
                    if (tariffDefault) {
                        for (let defaultElement of tariffDefault.elements) {
                            tariff.elements.push(defaultElement)
                        }
                    }
                }
                tariffPlug.tariffOPC = tariff
                return tariffPlug
            }
            console.log(`${context} Error - No tariff found to be eligible to start the transaction`)
            return null
        } catch (error) {
            console.log(`${context} Error `, error)
            return null
        }
    },
    sendStartHubject: function (session, hwID) {
        const context = "[Function sendStartHubject]"
        return new Promise(function (resolve, reject) {
            try {
                if (!session || !hwID) {
                    console.log(`${context} Error - Missing input fields`)
                    reject({ status: false, message: "Missing input fields" })
                }
                let body = {
                    contractId: session.cdr_token.contract_id,
                    evseId: session.evse_uid,
                    sessionId: session._id
                }
                axios.post(`${process.env.OICPServiceHost}/charging/remote/start`, body).then(function (resp) {
                    if (resp.data.success) resolve({ status: true, message: "success", sessionId: resp.data.sessionId })
                    else resolve({ status: false, message: "Fail without indication of why, should not happen!" })
                }).catch(function (error) {
                    console.log(`${context} Error - Fail catch the Start Hubject Remote `, error)
                    resolve({ status: false, message: error.message })
                })
            } catch (error) {
                console.log(`${context} Error `, error.message)
                resolve({ status: false, message: error.message })
            }
        })
    },
    sendStopHubject: function (session) {
        const context = "[Function sendStopHubject]"
        return new Promise(function (resolve, reject) {
            try {
                if (!session) {
                    console.log(`${context} Error - Missing input fields`)
                    reject({ status: false, message: "Missing input fields" })
                }

                let body = {
                    sessionId: session.id,
                    evseId: session.evse_uid,
                }
                console.log('Sending OICP stop:', body);

                axios.post(`${process.env.OICPServiceHost}/charging/remote/stop`, body)
                    .then(function (resp) {
                        const { success, sessionId, data } = resp.data;

                        console.log('OICP Response:', sessionId, data, success);
                        if (success) {
                            resolve({ status: true, message: data?.description || 'success', sessionId });
                        } else {
                            reject({ status: false, message: data?.description || 'Unexpected error', code: data?.code });
                        }
                    })
                    .catch(function (error) {
                        console.error(`${context} Error - Fail catch the Stop Hubject Remote`, {
                        message: error.message,
                        code: error.code,
                        responseData: error.response?.data,
                        status: error.response?.status,
                        });

                        resolve({
                        status: false,
                        message: error.response?.data?.data?.description || error.message || 'Unknown error',
                        code: error.response?.data?.data?.code || error.code,
                        });
                    });
            } catch (error) {
                console.log(`${context} Error `, error.message)
                resolve({ status: false, message: error.message })
            }
        })
    },
    passTariffRestrictions: function (tariffElemets, power, connectorPowerType, startDate, chargerCountryCode) {
        const context = "[Utills passTariffRestrictions]"
        try {
            if (!Array.isArray(tariffElemets) || !power || !connectorPowerType || (!startDate && startDate instanceof Date) || !chargerCountryCode) {
                console.log(`${context} Error - Missing input fields`)
                console.log(`${context} tariffElemets ${tariffElemets} power: ${power}   connectorPowerType: ${connectorPowerType}  startDate: ${startDate}  chargerCountryCode: ${chargerCountryCode}- Missing input fields`)
                return false
            }
            for (let elements of tariffElemets) {
                // tariff with element without restrictions so it pass the test :)
                if (!elements.restrictions) return true

                // check start of restriction time
                if (elements.restrictions.start_time) {
                    let startRestriction = new Date(elements.restrictions.start_time).getTime()
                    if (startRestriction > startDate.getTime()) continue
                }
                // check end of restriction time
                if (elements.restrictions.end_time) {
                    let endRestriction = new Date(elements.restrictions.start_time).getTime()
                    if (startDate.getTime() > endRestriction) continue
                }
                // check day of the week restriction
                if (elements.restrictions.day_of_week) {
                    let dayStart = dayOfTheWeek(startDate)
                    let found = elements.restrictions.day_of_week.find(day => day == dayStart)
                    if (!found) continue
                }
                // check max power restriction
                if (elements.max_power && power > elements.max_power) continue
                // check min power restriction
                if (elements.min_power && power < elements.min_power) continue
                // check if element has country limitation
                if (elements.countryCode && elements.countryCode != chargerCountryCode) continue
                // check if element has currentType limitation
                if (elements.currentType && elements.currentType !== connectorPowerType) continue

                // it pass all the test, he is the chosen one!! xD
                return true
            }

            // this tariff is not eligible to be used to charge now in this plug
            return false
        } catch (error) {
            console.log(`${context} Error - `, error)
            return false
        }
    },
    getHubjectCEMETariff: function () {
        const context = "[Utills getHubjectCEMETariff]"
        try {
            return new Promise((resolve, reject) => {
                try {
                    const params = {
                        CEME: "EVIO Hubject"
                    }
                    axios.get(process.env.HostPublicTariffs + process.env.PathHubjectCEMETariff, { params }).then(function (tariff) {
                        if (tariff.data) resolve(tariff.data[0])
                        else reject(null)
                    }).catch(function (err) {
                        console.log(`${context} Error `, err)
                        reject(null)
                    })
                } catch (error) {
                    console.log(`${context} Error `, error)
                    reject(null)
                }
            })
        } catch (error) {
            console.log(`${context} Error - `, error)
            return false
        }
    },
    getHubjectSession(roamingId) {
        const context = "[Utils getHubjectSession]"
        return new Promise((resolve, reject) => {
            try {
                if (!roamingId) {
                    console.log(`${context} Error - Missing input fields`)
                    return null
                }

                let query = {
                    source: "Hubject",
                    roamingTransactionID: roamingId
                }

                Session.findOne(query, (err, session) => {
                    if (err) {
                        console.log(`${context} findOne Error- `, err)
                        return reject(null)
                    }
                    if (!session) return resolve(null)
                    else return resolve(session)
                })
            } catch (error) {
                console.log(`${context} Error - `, error)
                return reject(null)
            }
        })
    },
    updatePreAuthorize: async function (reference, active) {
        const context = "[Utils updatePreAuthorize]"
        try {
            const data = {
                reference,
                active
            }
            const host = process.env.HostPayments + process.env.PathUpdatePreAuthorize
            await axios.patch(host, data)
        } catch (error) {
            console.log(`${context} Error `, error.message)
        }
    },
    logsOut: function (req, res, body) {
        const context = "[Utils logsOut]"
        try {
            let log = new LogsOut();
            log.requestBody = req.body;
            log.path = req.url;
            log.reqID = req.headers['reqID'];
            log.userId = req.headers['userid'];
            log.responseBody = JSON.stringify(body);
            log.responseStatus = res.statusCode;
            queryData = req.query,
                paramsData = req.params,
                clientType = req.headers['client'],

                LogsOut.create(log);
        } catch (error) {
            console.log(`${context} Error `, error.message)
        }
    },
    getUserIdByEv: function (ev) {
        const context = "[Utils getUserIdByEv]"
        try {
            if (ev) {
                if (ev.listOfGroupDrivers.length === 0 && ev.listOfDrivers.length === 0) {
                    return ev.userId
                }
                else {
                    if (ev.listOfGroupDrivers.length > 0) {
                        return ev.userId
                    }
                    else {
                        if (ev.listOfDrivers.length > 1) {
                            return ev.userId
                        }
                        else {
                            return ev.listOfDrivers[0].userId || ev.userId
                        }
                    }
                }
            }
            else {
                return null
            };
        } catch (error) {
            console.log(`${context} Error `, error.message)
            return null
        }
    },
    getAllUserInfo: function (userId, userIdWillPay, userIdToBilling) {
        const context = "Function getAllUserInfo";
        return new Promise(async (resolve, reject) => {
            let host = process.env.HostUser + process.env.PathGetAllUserInfo
            let params = { userId, userIdWillPay, userIdToBilling };

            axios.get(host, { params })
                .then((result) => {
                    if (result.data) {
                        resolve(result.data);
                    }
                    else {
                        resolve({});
                    };
                })
                .catch((error) => {
                    console.log(`[${context}] Error `, error.message);
                    if (error.response)
                        reject({ message: JSON.stringify(error.response.data), status: error.response.status, });
                    else
                        reject({ message: error.message, status: StatusCodes.INTERNAL_SERVER_ERROR, });
                });
        });
    },
    sleep: function (ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    },
    addKmsToEV: function (evID, kms, sessionID, chargerType, isFleetManager = false) {
        const context = "Function addKmsToEV";
        return new Promise(async (resolve, reject) => {
            try {
                if (!evID || !kms || !sessionID || !chargerType || typeof isFleetManager !== "boolean") {
                    console.log(`[${context}] Error - Missing input values `, evID, kms, sessionID, chargerType, isFleetManager);
                    reject(false);
                }
                let body = {
                    evID: evID,
                    kms: kms,
                    sessionID: sessionID,
                    chargerType: chargerType,
                    FleetManager: isFleetManager
                }

                axios.post(process.env.HostEvs + process.env.PathAddKmToEV, body).then(function (response) {
                    if (!response?.data?.message?.auth) {
                        console.log(`[${context}] Error - `, response?.data?.message);
                        reject(false);
                    } else resolve(true)

                }).catch(function (error) {
                    console.log(`[${context}] Error `, error.message);
                    reject(false);
                })
            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(false);
            }
        })
    },
    getChargingSessionByID: function (sessionID, chargerType) {
        const context = " sessionsKms getChargingSessionByID"
        return new Promise((resolve, reject) => {
            try {
                let host = process.env.LISTCHARGERSOCPI.includes(chargerType) ? process.env.HostOCPI + process.env.PathGetSessions : process.env.HostCharger + process.env.PathGetChargingSession

                let params = {
                    sessionID: sessionID
                }
                axios.get(host, { params: params }).then(function (session) {
                    resolve(session)

                }).catch(function (error) {
                    console.log(`[${context}] Error `, error);
                    reject(null)
                })

            } catch (error) {
                console.log(`[${context}] Error `, error);
                reject(null)
            }
        });
    },
    updateSessionStatistics: function (sessionID) {
        const context = " Utils updateSessionStatistics"
        return new Promise((resolve, reject) => {
            try {
                const data = {
                    sessionID: sessionID,
                    updateKMs: false,
                }

                axios.patch(process.env.HostStatistics + process.env.PathPatchSessionsUpdateKMs, data).then(function (sessionUpdated) {
                    if (sessionUpdated && sessionUpdated.data) resolve(true)
                    else resolve(false)

                }).catch(function (error) {
                    console.log(`[${context}] Error `, error);
                    reject(error.message)
                })
            } catch (error) {
                console.log(`[${context}] Error `, error);
                reject(error.message)
            }
        })
    },
    findTariffId: function (source, tariffId) {
        const context = "Function findTariffId";
        return new Promise(async (resolve, reject) => {
            let host = process.env.HostPublicNetwork + process.env.PathFindTariffId;
            let params = { source, tariffId };

            axios.get(host, { params })
                .then((result) => {
                    if (result.data) {
                        resolve(result.data);
                    }
                    else {
                        resolve(null);
                    };
                })
                .catch((error) => {
                    console.log(`[${context}] Error `, error.message);
                    resolve(undefined);
                });
        });
    },
    removeKmsFromSession: function (sessionID, idSession) {
        const context = " Utils removeKmsFromEV"
        return new Promise((resolve, reject) => {
            try {
                if (!sessionID && !idSession) {
                    console.log(`[${context}] Error - Missing input data`);
                    return reject('Missing input data')
                }
                if (idSession) {
                    let query = {
                        _id: idSession
                    }
                } else {
                    let query = {
                        id: sessionID
                    }
                }

                Session.findOne(query).then(function (session) {
                    if (!session) {
                        console.log(`[${context}] Error - Unknown sessioID: `, sessionID);
                        return reject('Unknown sessioID')
                    }

                    if (!session.evKms || session.evKms.length < 1 || !session.evId || session.evId !== '-1') return resolve(true)

                    Utils.removeKmsFromEV(session.evId, session.id).then(function (removed) {
                        if (!removed) {
                            console.log(`[${context}] Error - Fail to remove km from ev`);
                            return reject('Fail to remove km from ev')
                        }

                        // remove kms from session
                        Session.updateOne(query, { $unset: { 'evKms': '' } }).then(function (updated) {
                            return resolve(true)

                        }).catch(function (error) {
                            console.log(`[${context}] Error `, error);
                            reject(error.message)
                        })
                    }).catch(function (error) {
                        console.log(`[${context}] Error `, error);
                        reject(error.message ? error.message : error)
                    })

                }).catch(function (error) {
                    console.log(`[${context}] Error `, error);
                    reject(error.message)
                })

            } catch (error) {
                console.log(`[${context}] Error `, error);
                reject(error.message)
            }
        })
    },
    removeKmsFromEV: function (evId, sessionId) {
        const context = " Utils removeKmsFromEV"
        return new Promise((resolve, reject) => {
            try {
                if (!evId || !sessionId) {
                    console.log(`[${context}] Error - Missing input data`);
                    return reject('Missing input data')
                }

                let data = {
                    evID: evId,
                    sessionID: sessionId
                }

                axios.delete(global.evsDeletekmsFromEV, { data: data }).then(function (result) {
                    if (!result?.data?.message?.auth) {
                        console.log(`[${context}] Error - Fail to remove kms from EV`);
                        return reject(result?.data?.message?.message ? result.data.message.message : 'Fail to remove kms from EV')

                    } else return resolve(true)
                })
            } catch (error) {
                console.log(`[${context}] Error `, error);
                reject(error.message)
            }
        })
    },
    saveDifferentCdr: async function (oldCdr, newCdr) {
        const context = " Utils saveDifferentCdr"
        try {
            oldCdr = oldCdr[0]
            if (!(newCdr.id.slice(0, 4) === 'ftp-')) {
                if (oldCdr.id !== newCdr.id) {
                    let costDifference = oldCdr.total_cost.excl_vat - newCdr.total_cost.excl_vat
                    let energyDifference = oldCdr.total_energy - newCdr.total_energy
                    if (Math.abs(costDifference) >= 0.01 || Math.abs(energyDifference) >= 0.01) {
                        const foundCdr = await DifferentCdrs.findOne({ id: newCdr.id }).lean()
                        if (!foundCdr) {
                            let query = {
                                id: newCdr.session_id
                            }

                            let cdrSession = newCdr.session_id ? await Utils.chargingSessionFindOne(query) : null
                            if (cdrSession) {
                                newCdr.source = cdrSession.source
                            }

                            const createdCdr = new DifferentCdrs(newCdr);
                            await DifferentCdrs.create(createdCdr)
                        }
                    }
                }
            }
        } catch (error) {
            console.log(`[${context}] Error `, error);
        }
    },
    calculateCdrTotalValues: function (cdr, chargingSession) {
        const context = " Utils calculateCdrTotalValues"
        try {
            let opcFlat = 0
            let opcTime = 0
            let opcPower = 0
            let TAR_Price = 0
            let CEME_Price = 0
            let IEC_Price = cdr.total_energy * chargingSession.fees.IEC;
            let mobiEGrant = cdr?.mobie_cdr_extension?.usage?.apoio_mobilidade_eletrica_ceme > 0 ? -cdr?.mobie_cdr_extension?.usage?.apoio_mobilidade_eletrica_ceme : 0

            let tariffCemePriceEmpty = Utils.getCemeUnitPrice(chargingSession.tariffCEME, process.env.TariffTypeEmpty, chargingSession.voltageLevel)
            let tariffCemePriceOutEmpty = Utils.getCemeUnitPrice(chargingSession.tariffCEME, process.env.TariffTypeOutEmpty, chargingSession.voltageLevel)
            cdr?.mobie_cdr_extension?.subUsages?.forEach(subUsage => {
                opcFlat += subUsage.preco_unitario_opc_ativacao * 1
                opcTime += subUsage.preco_unitario_opc_tempo * subUsage.periodDuration
                opcPower += subUsage.preco_unitario_opc_energia * subUsage.energia_total_periodo
                TAR_Price += subUsage.preco_unitario_com_desconto_acesso_redes_fora_vazio * subUsage.energia_fora_vazio + subUsage.preco_unitario_com_desconto_acesso_redes_vazio * subUsage.energia_vazio
                CEME_Price += tariffCemePriceOutEmpty * subUsage.energia_fora_vazio + tariffCemePriceEmpty * subUsage.energia_vazio
            })

            return {
                opcFlat,
                opcTime,
                opcPower,
                TAR_Price,
                CEME_Price,
                IEC_Price,
                mobiEGrant,
            }
        } catch (error) {
            console.log(`[${context}] Error `, error);
            return {
                opcFlat: 0,
                opcTime: 0,
                opcPower: 0,
                TAR_Price: 0,
                CEME_Price: 0,
                IEC_Price: 0,
                mobiEGrant: 0,
            }
        }
    },
    calculateTotals: function (totalPrice, total_energy, totalKmToUse, evEfficiencyPerKwhPerKm) {
        let totalBykWh = total_energy > 0 ? Utils.round(totalPrice / total_energy) : 0;
        let totalByKmh = total_energy > 0
            ? Utils.round(
                (totalPrice / (total_energy / evEfficiencyPerKwhPerKm)) * totalKmToUse
            )
            : 0;
        return {
            total: totalPrice,
            totalBykWh: totalBykWh,
            totalByKmh: totalByKmh
        };
    }, calculateActivationFee: function (tariffCEME) {
        if (!tariffCEME.activationFee || tariffCEME.activationFee.value <= 0) {
            return Number(process.env.AD_HOC_Activation_Fee_Wallet);
        }
        return tariffCEME.activationFee.value;
    },
    updateEntry: function (emsp, index, activationFee, mobieDiscountEntry) {
        emsp.entries[index].unitPrice = activationFee;
        emsp.entries[index].total = Utils.round(activationFee);

        let totalActivationWithDiscount = Utils.round(
            Utils.round(activationFee) + mobieDiscountEntry.total,
            2
        );
        let totalUnitPriceActivationWithDiscount = Utils.round(
            activationFee + mobieDiscountEntry.unitPrice,
            4
        );

        emsp.entries[index].unitPrice = totalUnitPriceActivationWithDiscount;
        emsp.entries[index].total = totalActivationWithDiscount;

        return { totalActivationWithDiscount, totalUnitPriceActivationWithDiscount };
    },
    calculateTotalPrice: function (totalPriceEmsp, totalPriceCpo, fees) {
        let totalUnitPriceVat = Utils.round(totalPriceEmsp + totalPriceCpo);
        let totalPriceVat = Utils.round(totalUnitPriceVat * fees.IVA);

        return { totalUnitPriceVat, totalPriceVat };
    },


    forceValidatePayment: async function (session) {
        const newValues = {
            $set: {}
        }
        const tokenUid = await Utils.getUserIdActiveteOrInactive(session?.cdr_token?.uid || session.token_uid)

        let evOwner = "-1"
        let evId = "-1"
        let invoiceType = "-1"
        let invoiceCommunication = "-1"
        let evDetails, fleetDetails
        let userId = "Unknown"

        if (tokenUid) {
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
            newValues["$set"].userId = userId
            newValues["$set"].evId = evId
            newValues["$set"].evOwner = evOwner
            newValues["$set"].invoiceType = invoiceType
            newValues["$set"].invoiceCommunication = invoiceCommunication
            newValues["$set"].evDetails = evDetails
            newValues["$set"].fleetDetails = fleetDetails
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
            paymentConditions = await Utils.getPaymentConditions(userId, evId, session.location_id, session.connector_id, process.env.chargerTypeMobie, session.fees).catch((e) => {
                console.log("Get payment conditions failed. Reason ", e)
                newValues["$set"].notes = "Get payment conditions failed - " + JSON.stringify(e.message)
                userIdWillPay = e.userIdWillPay ? e.userIdWillPay : ""
                userIdToBilling = e.userIdToBilling ? e.userIdToBilling : ""
            });
            if (!paymentConditions) {

                if (userIdWillPay && userIdToBilling) {
                    paymentConditionsInit.userIdWillPay = userIdWillPay;
                    paymentConditionsInit.userIdToBilling = userIdToBilling;
                } else {
                    let evValidation = await Utils.validateEV(evId, userId, evDetails)
                    if (evValidation.userIdWillPay && evValidation.userIdToBilling) {
                        paymentConditionsInit.userIdWillPay = evValidation.userIdWillPay
                        paymentConditionsInit.userIdToBilling = evValidation.userIdToBilling
                    } else {
                        paymentConditionsInit.userIdWillPay = userId;
                        paymentConditionsInit.userIdToBilling = userId;
                    }

                }
                let { userIdInfo, userIdWillPayInfo, userIdToBillingInfo } = await getAllUserInfo({ userId, userIdWillPay: paymentConditionsInit.userIdWillPay, userIdToBilling: paymentConditionsInit.userIdToBilling })
                newValues["$set"].userIdInfo = userIdInfo
                newValues["$set"].userIdWillPayInfo = userIdWillPayInfo
                newValues["$set"].userIdToBillingInfo = userIdToBillingInfo
                // let userInfo = await Utils.getUserInfo(paymentConditionsInit.userIdWillPay)
                if (userIdWillPayInfo) {
                    paymentConditionsInit.clientType = userIdWillPayInfo?.clientType
                    paymentConditionsInit.clientName = userIdWillPayInfo?.clientName
                    paymentConditionsInit.paymentType = userIdWillPayInfo?.paymentPeriod ?? "AD_HOC"
                }
                paymentConditions = paymentConditionsInit;
            } else {
                let { userIdInfo, userIdWillPayInfo, userIdToBillingInfo } = await getAllUserInfo({ userId, userIdWillPay: paymentConditions.userIdWillPay, userIdToBilling: paymentConditions.userIdToBilling })
                newValues["$set"].userIdInfo = userIdInfo
                newValues["$set"].userIdWillPayInfo = userIdWillPayInfo
                newValues["$set"].userIdToBillingInfo = userIdToBillingInfo
            }
        }
        else {
            paymentConditions = paymentConditionsInit;
            newValues["$set"].userId = "Unknown";
        }


        if (paymentConditions.clientType) {

            newValues["$set"].paymentType = paymentConditions.paymentType;
        }
        else {
            newValues["$set"].paymentType = paymentConditionsInit.paymentType;
        }

        if (paymentConditions.clientName) {
            newValues["$set"].clientName = paymentConditions.clientName;
        } else {
            newValues["$set"].clientName = paymentConditionsInit.clientName;
        }

        // Check if tariffCEME is sent
        /*
            When charging in MobiE, paymentConditions.ceme is an object with the keys plan,schedule and tar
        */
        let tariffCEME = ""
        if (paymentConditions.ceme) {
            if (!Utils.isEmptyObject(paymentConditions.ceme.plan)) {
                // newValues["$set"].tariffCEME = paymentConditions.ceme.plan
                tariffCEME = paymentConditions.ceme.plan
                let tariffArray = Utils.getTariffCemeByDate(tariffCEME, session.start_date_time)
                tariffCEME.tariff = tariffArray
                newValues["$set"].tariffCEME = tariffCEME
            } else {
                // newValues["$set"].tariffCEME = await Utils.getTariffCEME(newValues["$set"].clientName);
                tariffCEME = await getEmspTariffWithIdTag(tokenUid?.uid, session.source);
                if (!tariffCEME) tariffCEME = await Utils.getTariffCEME(newValues["$set"].clientName);
                let tariffArray = Utils.getTariffCemeByDate(tariffCEME, session.start_date_time)
                tariffCEME.tariff = tariffArray
                newValues["$set"].tariffCEME = tariffCEME
            }
        } else {
            //Default value for now
            // newValues["$set"].tariffCEME = await Utils.getTariffCEME(newValues["$set"].clientName);
            tariffCEME = await getEmspTariffWithIdTag(tokenUid?.uid, session.source);
            if (!tariffCEME) tariffCEME = await Utils.getTariffCEME(newValues["$set"].clientName);
            let tariffArray = Utils.getTariffCemeByDate(tariffCEME, session.start_date_time)
            tariffCEME.tariff = tariffArray
            newValues["$set"].tariffCEME = tariffCEME
        }

        // GET TAR AND SCHEDULES
        let { tariffTAR, TAR_Schedule } = await Utils.getCEMEandTar(tariffCEME._id, session.timeZone, "MobiE", newValues["$set"].clientName)

        newValues["$set"].schedulesCEME = TAR_Schedule
        newValues["$set"].tariffTAR = tariffTAR
        newValues["$set"].timeZone = session.timeZone

        if (paymentConditions.billingPeriod) {
            newValues["$set"].billingPeriod = paymentConditions.billingPeriod;
        } else {
            newValues["$set"].billingPeriod = newValues["$set"].userIdToBillingInfo?.billingPeriod
        }

        newValues["$set"].paymentMethod = paymentConditions.paymentMethod;
        newValues["$set"].paymentMethodId = paymentConditions.paymentMethodId;
        newValues["$set"].walletAmount = paymentConditions.walletAmount;
        newValues["$set"].reservedAmount = paymentConditions.reservedAmount;
        newValues["$set"].confirmationAmount = paymentConditions.confirmationAmount;
        newValues["$set"].plafondId = paymentConditions.plafondId;

        newValues["$set"].viesVAT = paymentConditions.viesVAT

        if (paymentConditions.userIdWillPay)
            newValues["$set"].userIdWillPay = paymentConditions.userIdWillPay;
        else
            newValues["$set"].userIdWillPay = paymentConditionsInit.userIdWillPay;

        if (paymentConditions.userIdToBilling)
            newValues["$set"].userIdToBilling = paymentConditions.userIdToBilling;
        else
            newValues["$set"].userIdToBilling = paymentConditionsInit.userIdToBilling;


        await Session.findOneAndUpdate({ _id: session._id }, newValues)
    },
    checkSessionTimeIsValidForNotification: async function(timeChargedinSeconds, startDate, previousActiveFlag = null){
        const isFeatureFlagActive = previousActiveFlag === null ?
            await toggle.isEnable('charge-314-not-notify-user-session-expensive')
            : previousActiveFlag;
        if(isFeatureFlagActive){
            const isSessionDurationLessThanThreeDays = timeChargedinSeconds < Constants.THREE_DAYS_IN_SECONDS;
            const didSessionOccurLessThanThreeDaysAgo = Utils.getChargingTime(startDate, moment()) < Constants.THREE_DAYS_IN_SECONDS;

            return isSessionDurationLessThanThreeDays && didSessionOccurLessThanThreeDaysAgo;
        }
        return true;
    },
    verifyFlagIsActiveToSendIdTagToPaymentConditions: async function (idTag) {
        if(!idTag || idTag.toString().toUpperCase() === 'UNKNOWN'){
            return '';
        }
        const enableSendUid = await toggle.isEnable('charge-315-fix-session-cardnumber-associate_d');
        return enableSendUid ? idTag : ''
    },
    checkToApplyValidationCDR: async function(cdr, session, isMobiE){
        const cdrValidationToggled = await toggle.isEnable('charge-277');

        let cdrValidationResult = { 
            status: global.SessionStatusStopped,
            reason: null,
            valid: true
        }

        if (cdrValidationToggled) {
            const valuesTovalidation = await retrieveValidationCDRConfig();     

            if(valuesTovalidation && Object.keys(valuesTovalidation).length) {
                cdrValidationResult = validationCDR(cdr, session, valuesTovalidation, isMobiE);
            }
        }

        return cdrValidationResult;
    },
    validateSessionUpdate: async function (query , data) {
        const session = await Session.findOne(query , {status: 1 , id : 1}).lean();
        if (session && (session.status === global.SessionStatusStopped || (session.id && session.id !== data.id))) {
            saveSessionLogs({
                userId: '--put session--',
                hwId: '',
                plugId: '',
                stage: "OCPI [validateSessionUpdate]",
                action: "start",
                status: Enums.SessionFlowLogsStatus.ERROR,
                errorType: Enums.SessionFlowLogsErrorTypes.VALIDATION_ERROR,
                errorMessage: 'Session cannot be updated',
                sessionId: session.id
            })
            throw new Error({id : session.id , message : "Session cannot be updated"});
        }
    },
    getHubjectTariff: async function(
      charger,
      tariffs,
      latitude,
      longitude,
      plugPower,
      userId,
      evOwner = "-1"
    ) {
      try {
        const sessionStartDate = new Date().toISOString();
        const offset = TariffsService.getChargerOffset(
          charger.timeZone,
          charger.countryCode,
          latitude,
          longitude
        );
        const localSessionStartDate = moment
          .utc(sessionStartDate)
          .add(offset, "minutes")
          .format();
        const matchingTariff = TariffsService.findMatchingTariff(
          tariffs,
          localSessionStartDate
        );
        const defaultDynamicId = `default_dynamic_${charger.partyId}`;
        const tariffUserId = evOwner !== "-1" ? evOwner : userId;
        const tariff = await TariffsService.getCpoTariff(
          matchingTariff?.id,
          defaultDynamicId,
          tariffUserId,
          charger.partyId,
          charger.countryCode,
          plugPower
        );
        return tariff;
      } catch (error) {
        console.error("Error in getHubjectTariff", error);
        return null;
      }
    },
    calculateUserOrDeviceCpoTariff: function (cdr, chargingSession) {
        const {isDevice = false } = Helpers.verifyIsDeviceRequest(chargingSession?.createdWay);
        if (chargingSession?.tariffOPC?.type === Enums.OcpiTariffType.User || isDevice) {
            let priceComponents = chargingSession?.tariffOPC?.elements || [];
            const offset = Utils.getChargerOffset(chargingSession.timeZone, chargingSession.country_code, null, null)
            priceComponents &&= Utils.createTariffElementsAccordingToRestriction(priceComponents, cdr.start_date_time, cdr.end_date_time)
            const [{price:flat}, {price:energy}, {price:time}, {price:parking}] = Utils.opcTariffsPrices(null, priceComponents, cdr.start_date_time, cdr.end_date_time, offset, chargingSession.plugPower, chargingSession.plugVoltage, cdr.total_energy, cdr.total_time, 0, chargingSession.source)
            return {
                isUserTariffOrDevice: true,
                flat,
                energy,
                time,
                parking
            }
        }
        return {
            isUserTariffOrDevice: false
        }
    },
    addUserTariffsInvoiceLines: function (invoiceLines, cdr, vat, flat, energy, time) {
        const totalEnergy = cdr.total_energy;
        const totalTime = cdr.total_time * 60;
        let line4_OPC_FLAT = {
            "code": global.Item_OPC_FLAT, "description": "Tarifas de ativação de utilização dos OPC", "unitPrice": flat, "uom": "UN", "quantity": 1, "vat": vat, "discount": 0, "total": 0
        }

        let line5_OPC_ENERGY = {
            "code": global.Item_OPC_KWH, "description": "Tarifas de utilização dos OPC por kWh", "unitPrice": (energy / totalEnergy), "uom": "KWh", "quantity": totalEnergy, "vat": vat, "discount": 0, "total": 0
        }

        let line6_OPC_TIME = {
            "code": global.Item_OPC_TIME, "description": "Tarifas de utilização dos OPC por min", "unitPrice": (time/totalTime), "uom": "min", "quantity": totalTime, "vat": vat, "discount": 0, "total": 0
        }

        if (vat == 0) {
            line4_OPC_FLAT.taxExemptionReasonCode = Constants.TAX_EXEMPTION_REASON_CODE_M40;
            line5_OPC_ENERGY.taxExemptionReasonCode = Constants.TAX_EXEMPTION_REASON_CODE_M40;
            line6_OPC_TIME.taxExemptionReasonCode = Constants.TAX_EXEMPTION_REASON_CODE_M40;
        }

        if (flat > 0) {
            invoiceLines.push(line4_OPC_FLAT);
        }

        if (energy > 0) {
            invoiceLines.push(line5_OPC_ENERGY);
        }

        if (time > 0) {
            invoiceLines.push(line6_OPC_TIME);
        }
    },

    getEvInfo: async function(evId, contractUserId) {
        if (!evId || evId === '-1') {
            return buildAnonymousEvInfo(contractUserId);
        }

        const { ev, fleet } = await findEvAndFleetById(evId);

        if (ev) {
            ev.listOfGroupDrivers = await getListOfGroupDrivers(ev);
        }

        return {
            evOwner: (ev && ev.userId) ?? '-1',
            invoiceType: (ev && ev.invoiceType) ?? '-1',
            invoiceCommunication: (ev && ev.invoiceCommunication) ?? '-1',
            evDetails: ev,
            fleetDetails: fleet,
            userId: getEvDriver(ev, contractUserId),
        };
    },
    mongoUpsertOperation: function(filter, data) {
        return {
            updateOne: {
            filter,
            update: {
                $set: data,
                $setOnInsert: { createdAt: new Date() }, 
                $currentDate: { updatedAt: true } },
            upsert: true,
            },
        }
    }
}

// TODO: refactor to avoid circular dependency
function remoteStopSessionUtil(req, changingSource) {
    const { post: remoteStopSessionPost } = changingSource == global.mobiePlatformCode ? require('./2.2/sender/commands/remoteStopSession') : require('./2.1.1/sender/commands/remoteStopSession');
    return remoteStopSessionPost(req)
}


async function getListOfGroupDrivers(ev) {
  const groupIds = extractGroupIds(ev && ev.listOfGroupDrivers);
  const groupDrivers = await findGroupDrivers(groupIds);
  return (ev && ev.listOfGroupDrivers
    ? ev.listOfGroupDrivers.map(findGroupDriverInfo(groupDrivers))
    : []
  );
}

function extractGroupIds(listOfGroupDrivers) {
  return (listOfGroupDrivers
    ? listOfGroupDrivers.map((groupDriver) => groupDriver.groupId)
    : []
  );
}

function findGroupDriverInfo(groupDrivers) {
  return (groupDriver) => {
    const match = groupDrivers.find((group) => group._id === groupDriver.groupId) || {};
    const listOfDrivers = match.listOfDrivers || [];
    const name = match.name || '';
    return { ...groupDriver, listOfDrivers, name };
  };
}

function buildAnonymousEvInfo(userId) {
  return {
    evOwner: '-1',
    invoiceType: '-1',
    invoiceCommunication: '-1',
    evDetails: undefined,
    fleetDetails: undefined,
    userId,
  };
}

function getEvDriver(ev, contractUserId) {
  if (!ev) return contractUserId;

  const { listOfGroupDrivers = [], listOfDrivers = [], userId } = ev;

  if (
    listOfGroupDrivers.length > 0 ||
    listOfDrivers.length > 1 ||
    (listOfGroupDrivers.length === 0 && listOfDrivers.length === 0)
  ) {
    return userId;
  }

  return (listOfDrivers[0] && listOfDrivers[0].userId) || userId || contractUserId;
}



function isValidDateForPreAuthorization(startDate) {
    const now = moment().subtract(Constants.maxDaysForPreAuthorizations, 'days');
    return now.isBefore(moment(startDate));
}

module.exports = Utils;

