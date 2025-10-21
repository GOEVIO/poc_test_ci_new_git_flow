const JsonFind = require('json-find');
const moment = require('moment');
const timeZoneMoment = require('moment-timezone');
const { ChargingSessionReadRepository } = require('evio-library-chargers');
const global = require('./global');
const axios = require('axios');
var _ = require("underscore");
const geoTimeZone = require('geo-tz')
const regex = /<U\+([0-9A-Z]{4})>/gm;
const subst = `\\u$1`;
var Platforms = require('./models/platforms');
var User = require('./models/user');
var validTokens = require('./ControlCenter/authenticationTokens/validTokens');
const mappingCountryCodes = require('./models/mappingCountryCodes.json');
const mappingNames = require('./models/mappingCountryCodesToNames.json');
const UtilsFirebase = require('./utils_firebase')
var LocationsQueue = require('./models/locationsQueue');
var TariffsQueue = require('./models/tariffsQueue');
var CommandsQueue = require('./models/commandsQueue');
var SessionsQueue = require('./models/sessionsQueue');
var Tariff = require('./models/tariff');
var Versions = require('./models/ocpiCredentialsVersions');
var Details = require('./models/ocpiCredentialsDetails');
var OcpiLog = require('./models/ocpiLog');
var CDR = require('./models/cdrs');
const addressS = require("./services/address")
const Sentry = require('@sentry/node');


const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

var Utils = {
    round: function (value, decimals = 2) {
        //return Number(formatter.format(value))
        return Number(value.toFixed(decimals))
    },
    diffDateSeconds: function (startDate) {

        var dateNow = moment();
        //console.log(dateNow)

        var duration = moment.duration(dateNow.diff(startDate));
        var dif = duration.asSeconds();
        return dif;

    },
    generateToken: function (length) {
        var uid = require('rand-token').uid;
        var token = uid(length);

        return token;
    },
    response: function (data, statusCode, statusMessage) {
        var message = {};

        if (data !== null)
            message = { data: data, status_code: statusCode, status_message: statusMessage, timestamp: new Date().toISOString(), }
        else
            message = { status_code: statusCode, status_message: statusMessage, timestamp: new Date().toISOString(), }

        return message;
    },
    getPlatformInfo: function (token) {
        return new Promise(function (resolve, reject) {

            if (!token) {
                resolve(null);
            }
            else {
                var query = {
                    cpoActiveCredentialsToken: {
                        $elemMatch: { token: token }
                    }
                };

                Platforms.findOne(query, (err, platform) => {
                    if (err) {
                        console.error(`[find] Error `, err);
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
        for (var key in obj) {
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

        // let mapping_list = jsonFile[mapping_type];

        // var value = Object.keys(mapping_list).find(key => mapping_list[key] === data.toString());
        // if (value === undefined) {
        //     value = Object.keys(mapping_list).find(key => mapping_list[key].includes(data.toString()));
        //     if (value === undefined)
        //         value = "unknown";
        // };


        //console.log(data);
        let mapping_list = jsonFile[mapping_type];

        var value = "unknown";

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

                var obj = response.data;

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
            let query = { uid: idTag, valid: true };
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
    getCharger: function (hwId, plugId) {
        return new Promise(async (resolve, reject) => {
            var chargersEndpoint = global.publicNetworkChargersProxy + "/" + hwId;
            axios.get(chargersEndpoint, {}, {}).then(function (response) {

                if (typeof response.data !== 'undefined' && response.data !== '') {

                    var charger = response.data;
                    //console.log(charger);
                    var plugs = charger.plugs;
                    var plug = _.where(plugs, { plugId: plugId });

                    if (plug[0])
                        console.log("Checking opc tariff: ", plug[0].tariffId[0])

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
    getTariffOPC: function (tariffId) {
        return new Promise(async (resolve, reject) => {
            let query = { id: tariffId }
            Tariff.findOne(query, { _id: 0, __v: 0, createdAt: 0, updatedAt: 0, source: 0 }, (err, tariff) => {
                if (tariff) {

                    resolve(tariff);

                }
                else
                    resolve({});
            }).catch(function (e) {
                console.log(e);
                resolve({});
                return;
            });;
        });
    },
    getTariffCEME: function (ceme) {

        // TODO FOR now it's ok. Later, we need to check which CEME is charging and return specific tariff and maybe, throught axios get tariff in public tariffs microservice
        return new Promise(async (resolve, reject) => {
            var tariffCEME = {
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
                        "price": 0.0900
                    },
                    {
                        "type": "energy",
                        "power": "all",
                        "uom": "€/kWh",
                        "tariffType": "server_out_empty",
                        "voltageLevel": "BTN",
                        "price": 0.0900
                    }
                ]
            }

            resolve(tariffCEME);
        });
    },
    getTariffTAR: function (ceme) {

        // TODO FOR now it's ok. 

        var tariffTAR = {
            "country": "PT",
            "tariffType": "server_bi_hour",
            "tariff": [
                {
                    "uom": "€/kWh",
                    "tariffType": "server_empty",
                    "voltageLevel": "BTN",
                    "price": 0.0172
                },
                {
                    "uom": "€/kWh",
                    "tariffType": "server_out_empty",
                    "voltageLevel": "BTN",
                    "price": 0.0663
                },
                {
                    "uom": "€/kWh",
                    "tariffType": "server_empty",
                    "voltageLevel": "BTE",
                    "price": 0.0172
                },
                {
                    "uom": "€/kWh",
                    "tariffType": "server_out_empty",
                    "voltageLevel": "BTE",
                    "price": 0.0663
                },
                {
                    "uom": "€/kWh",
                    "tariffType": "server_empty",
                    "voltageLevel": "MT",
                    "price": 0.0137
                },
                {
                    "uom": "€/kWh",
                    "tariffType": "server_out_empty",
                    "voltageLevel": "MT",
                    "price": 0.0528
                }
            ]
        }

        return tariffTAR;

    },
    getCemeScheduleTime: function () {


        return mobieScheduleTimeJson;

    },
    getPaymentConditions: function (userId, evId, hwId, plugId, chargerType, fees) {

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
                    fees: fees
                }
            }

            axios.get(global.paymentCheckConditionsEndpoint, { data }).then(function (response) {

                var paymentConditions = response.data;

                if (typeof paymentConditions === 'undefined') {
                    resolve();
                }
                else {
                    resolve(paymentConditions);
                }

            }).catch(function (error) {

                if (error.response)
                    reject(error.response.data);
                else
                    reject({ message: error.message });
            });


        });
    },
    getFees: function (charger) {
        return new Promise(async (resolve, reject) => {

            var fees = { IEC: 0.001, IVA: 0.23 }
            try {

                let countryCode;
                let postalCode;

                //TODO: This function and the fees endpoint need to change in order to accommodate new countries and fees
                if (charger.countryCode !== null && typeof charger.countryCode !== "undefined") {
                    countryCode = charger.countryCode

                    if (charger.address != undefined) {
                        if (charger.address.zipCode != undefined && charger.address.zipCode !== "") {
                            let result = charger.address.zipCode.split("-");
                            if (result.length > 1) {
                                postalCode = result[0];
                            }
                            else {
                                postalCode = '';
                            }
                        }
                        else {
                            postalCode = '';
                        }
                    } else {
                        postalCode = ''
                    }
                } else if (charger.address != undefined) {
                    if (charger.address.country) {
                        if (charger.address.country === 'Portugal' || charger.address.country === '') {
                            countryCode = 'PT';
                        }
                        else {
                            countryCode = charger.address.country;
                        }
                    }
                    else {
                        countryCode = 'PT';
                    }

                    if (charger.address.zipCode != undefined && charger.address.zipCode !== "") {
                        let result = charger.address.zipCode.split("-");
                        if (result.length > 1) {
                            postalCode = result[0];
                        }
                        else {
                            postalCode = '';
                        }
                    }
                    else {
                        postalCode = '';
                    }
                }
                else {
                    countryCode = 'PT';
                }

                var params = {
                    countryCode: countryCode,
                    postalCode: postalCode
                }


                axios.get(global.feesConfigEndpoint, { params })
                    .then((res) => {
                        if (res.data) {
                            resolve(res.data);
                        } else {

                            resolve(fees);
                        }
                    })
                    .catch((error) => {
                        console.log("[Error getFees] " + error.message);
                        resolve(fees);
                    });

            } catch (error) {
                console.log("Error getFees " + error.message);
                resolve(fees);
            };

        });

    },
    updateMeterValues: function (chargingSession, payload, sendNotification) {
        return new Promise(async (resolve, reject) => {
            //Obter inicio de sessão de carregamento à sessão de carregamento
            var startDate
            if ('start_date_time' in payload) {
                startDate = payload.start_date_time;
            } else {
                startDate = chargingSession.start_date_time
            }

            var dateNow = moment();
            //console.log("startDate:", startDate)
            //console.log("dateNow:", dateNow)

            //Calcular tempo total de carregamento
            var timeChargedinSeconds = Utils.getChargingTime(startDate, dateNow);

            //Obter energia total consumida ao payload do request
            var totalPowerConsumed_Kw = -1;
            var totalPowerConsumed_W = 0;
            var instantPower = -1;
            var instantVoltage = -1;
            var instantAmperage = -1;
            var evBattery = -1;
            var CO2emitted = 0;

            if (payload.kwh >= 0) {
                totalPowerConsumed_Kw = payload.kwh;
                totalPowerConsumed_W = totalPowerConsumed_Kw * 1000;
                CO2emitted = Number(process.env.CarbonIntensity) * totalPowerConsumed_Kw;// Kg CO₂ eq/kWh
                if (CO2emitted < 0)
                    CO2emitted = 0
            }

            var readingPoints = [{
                totalPower: totalPowerConsumed_W,
                instantPower: instantPower,
                instantVoltage: instantVoltage,
                batteryCharged: evBattery,
                instantAmperage: instantAmperage
            }]

            //Calcular estimativa de custo
            var estimatedPrice_excl_Vat = -1;
            var estimatedPrice_incl_Vat = -1;
            var priceComponents = chargingSession.tariffOPC.elements;

            //Calculate OPC Prices
            var OPC_Price_FLAT = 0;
            var OPC_Price_TIME = 0;
            var OPC_Price_POWER = 0;
            priceComponents.map(function (item) {

                if (item.price_components[0].type == 'FLAT') {
                    OPC_Price_FLAT = item.price_components[0].price;
                }
                else if (item.price_components[0].type == 'TIME') {
                    OPC_Price_TIME = item.price_components[0].price;
                }
                else if (item.price_components[0].type == 'ENERGY') {
                    OPC_Price_POWER = item.price_components[0].price;
                }
            });

            //Sometimes charging station sent negative values in kw attribute. 
            var aux_totalPowerConsumed_Kw = 0;
            if (totalPowerConsumed_Kw >= 0)
                aux_totalPowerConsumed_Kw = totalPowerConsumed_Kw;

            var OPC_Price = OPC_Price_FLAT + ((timeChargedinSeconds / 60) * OPC_Price_TIME) + (aux_totalPowerConsumed_Kw * OPC_Price_POWER);


            // var CEME_Price_POWER = chargingSession.tariffCEME.tariff[0].price;
            // var CEME_Price = CEME_Price_POWER * aux_totalPowerConsumed_Kw;

            var IEC_Price = chargingSession.fees.IEC * aux_totalPowerConsumed_Kw;

            var voltageLevel = "BTN";

            if (chargingSession.voltageLevel !== undefined && chargingSession.voltageLevel !== null) {
                voltageLevel = chargingSession.voltageLevel;
            }

            //TAR FEE
            var scheduleTime = this.getCemeScheduleTime();


            var time = dateNow.format('HH:mm');

            var tariffType = "server_empty";
            var TAR_Schedule = _.where(scheduleTime, { tariffType: chargingSession.tariffCEME.tariffType, cycleType: chargingSession.tariffCEME.cycleType }); //Taxa TAR
            if (time >= '00:00' && time <= '08:00') {
                tariffType = TAR_Schedule[0].schedules[0].tariffType;
            }
            if (time > '08:00' && time <= '22:00') {
                tariffType = TAR_Schedule[0].schedules[1].tariffType;
            }
            if (time > '22:00' && time <= '24:00') {
                tariffType = TAR_Schedule[0].schedules[2].tariffType;
            }

            var CEME_Price_POWER = chargingSession.tariffCEME.tariff.find(elem => elem.tariffType === tariffType).price
            var CEME_Price = CEME_Price_POWER * aux_totalPowerConsumed_Kw;

            //TODO
            //No futuro devemos melhorar isto para somar os valores corretos em função do horário de carregamento (vazio, fora vazio, ponta, cheias, etc. Ver exemplos da Mobie nos CDRs)
            var TAR_Tariffs = this.getTariffTAR("").tariff;
            var TAR_Tariff = _.where(TAR_Tariffs, { voltageLevel: voltageLevel, tariffType: tariffType }); //Taxa TAR

            var TAR_Price = TAR_Tariff[0].price * aux_totalPowerConsumed_Kw;

            //VAT
            var VAT_Price = await this.getVATwithViesVAT(chargingSession); //Iva

            //Final PRICES
            estimatedPrice_excl_Vat_without_FEES = OPC_Price + CEME_Price + TAR_Price;
            estimatedPrice_excl_Vat = OPC_Price + CEME_Price + IEC_Price + TAR_Price;
            estimatedPrice_incl_Vat = estimatedPrice_excl_Vat + (VAT_Price * estimatedPrice_excl_Vat);

            console.log({ estimatedPrice_excl_Vat_without_FEES: estimatedPrice_excl_Vat_without_FEES, energy: aux_totalPowerConsumed_Kw, time: (timeChargedinSeconds / 60), opc_price: OPC_Price, ceme_price: CEME_Price, iec_price: IEC_Price, tar_price: TAR_Price, tar_tariff: TAR_Tariff[0].price })

            var totalCost = { excl_vat: estimatedPrice_excl_Vat, incl_vat: estimatedPrice_incl_Vat }

            var query = { _id: chargingSession._id };
            var newValues = {
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

            Session.updateSession(query, newValues, (err, result) => {
                if (err) {
                    console.error(`[update Session OCPI] Error `, err);
                    resolve(err);
                }
                else {

                    let notificationBody = {
                        totalPower: totalPowerConsumed_W,
                        estimatedPrice: totalCost.incl_vat,
                        timeCharged: timeChargedinSeconds,
                        batteryCharged: evBattery
                    }

                    if (sendNotification) {
                        UtilsFirebase.dataFirebaseNotification(chargingSession, notificationBody);
                    }

                    resolve();
                };
            });

        });
    },
    getChargingTime: function (startDate, stopDate) {

        // var dateNow = moment();
        //console.log(dateNow)

        // Fucking bug of dates....moment(chargingSession.startDate, "YYYY-MM-DD'T'HH:mm:ss");

        var duration = moment.duration(stopDate.diff(startDate));
        var timeChargedinSeconds = duration.asSeconds();
        return timeChargedinSeconds;

    },
    calculatePrice: function (startDate, stopDate) {

        var price = -1;


        return price;

    },
    billing: function (cdr, userId, chargingSession, paymentId, invoiceLines, totalPrice) {
        return new Promise(async (resolve, reject) => {

            //var invoiceLines = await this.getInvoiceLines(cdr, userId, chargingSession);
            var body = await this.drawSingle_Ad_HocInvoice(cdr, userId, chargingSession, paymentId, invoiceLines, totalPrice);

            axios.post(global.billingEndpoint, body, { headers: { 'userid': userId } }).then(function (response) {

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

            var invoiceLines = [];

            var cdr_end_date_time = new Date(cdr.end_date_time)
            var vat = await this.getVATwithViesVAT(chargingSession);

            var others = 0;
            if (cdr_end_date_time.getFullYear() == 2021) {
                if (chargingSession.paymentType == "AD_HOC" && chargingSession.paymentMethod == "card") {
                    others = Number(process.env.AD_HOC_Activation_Fee_Card_2021);
                } else if (chargingSession.paymentType == "AD_HOC" && chargingSession.paymentMethod == "wallet") {
                    others = Number(process.env.AD_HOC_Activation_Fee_Wallet_2021);
                } else {
                    others = Number(process.env.AD_HOC_Activation_Fee_Wallet_2021);
                }
            }
            else {

                if (chargingSession.paymentType == "AD_HOC" && chargingSession.paymentMethod == "card") {
                    others = Number(process.env.AD_HOC_Activation_Fee_Card);
                } else if (chargingSession.paymentType == "AD_HOC" && chargingSession.paymentMethod == "wallet") {
                    others = Number(process.env.AD_HOC_Activation_Fee_Wallet);
                } else {
                    others = Number(process.env.AD_HOC_Activation_Fee_Wallet);
                }
            }

            let mobiEGrant = cdr?.mobie_cdr_extension?.usage?.apoio_mobilidade_eletrica_ceme > 0 ? -cdr.mobie_cdr_extension.usage.apoio_mobilidade_eletrica_ceme : 0

            let tariffCemePriceEmpty = chargingSession.tariffCEME.tariff.find(elem => elem.tariffType === process.env.TariffTypeEmpty).price
            let tariffCemePriceOutEmpty = chargingSession.tariffCEME.tariff.find(elem => elem.tariffType === process.env.TariffTypeOutEmpty).price

            for (let subUsage of cdr?.mobie_cdr_extension?.subUsages) {

                let equalLineIndex=0;
                
                if (chargingSession.voltageLevel == "BT" || chargingSession.voltageLevel == "BTN") {


                    //CEME
                    var line1_BT = {
                        "code": global.Item_Energy_OutEmpty_BT, "description": "Energia consumida Fora do Vazio BT", "unitPrice": tariffCemePriceOutEmpty, "uom": "KWh", "quantity": subUsage.energia_fora_vazio, "vat": vat, "discount": 0, "total": 0
                    }

                    var line2_BT = {
                        "code": global.Item_Energy_Empty_BT, "description": "Energia consumida Vazio BT", "unitPrice": tariffCemePriceEmpty, "uom": "KWh", "quantity": subUsage.energia_vazio, "vat": vat, "discount": 0, "total": 0
                    }

                    //TAR
                    var line3_TAR_BT = {
                        "code": global.Item_TAR_OutEmpty_BT, "description": "Tarifas Acesso às Redes Fora do Vazio BT", "unitPrice": subUsage.preco_unitario_com_desconto_acesso_redes_fora_vazio, "uom": "KWh", "quantity": subUsage.energia_fora_vazio, "vat": vat, "discount": 0, "total": 0
                    }

                    var line4_TAR_BT = {
                        "code": global.Item_TAR_Empty_BT, "description": "Tarifas Acesso às Redes Vazio BT", "unitPrice": subUsage.preco_unitario_com_desconto_acesso_redes_vazio, "uom": "KWh", "quantity": subUsage.energia_vazio, "vat": vat, "discount": 0, "total": 0
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
                    var line1_MT = {
                        "code": global.Item_Energy_OutEmpty_MT, "description": "Energia consumida Fora do Vazio MT", "unitPrice": tariffCemePriceOutEmpty, "uom": "KWh", "quantity": subUsage.energia_fora_vazio, "vat": vat, "discount": 0, "total": 0
                    }

                    var line2_MT = {
                        "code": global.Item_Energy_Empty_MT, "description": "Energia consumida Vazio MT", "unitPrice": tariffCemePriceEmpty, "uom": "KWh", "quantity": subUsage.energia_vazio, "vat": vat, "discount": 0, "total": 0
                    }

                    var line3_TAR_MT = {
                        "code": global.Item_TAR_OutEmpty_MT, "description": "Tarifas Acesso às Redes Fora do Vazio MT", "unitPrice": subUsage.preco_unitario_com_desconto_acesso_redes_fora_vazio, "uom": "KWh", "quantity": subUsage.energia_fora_vazio, "vat": vat, "discount": 0, "total": 0
                    }

                    var line4_TAR_MT = {
                        "code": global.Item_TAR_Empty_MT, "description": "Tarifas Acesso às Redes Vazio MT", "unitPrice": subUsage.preco_unitario_com_desconto_acesso_redes_vazio, "uom": "KWh", "quantity": subUsage.energia_vazio, "vat": vat, "discount": 0, "total": 0
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

                var line4_OPC_FLAT = {
                    "code": global.Item_OPC_FLAT, "description": "Tarifas de ativação de utilização dos OPC", "unitPrice": subUsage.preco_unitario_opc_ativacao, "uom": "UN", "quantity": 1, "vat": vat, "discount": 0, "total": 0
                }



                var line5_OPC_ENERGY = {
                    "code": global.Item_OPC_KWH, "description": "Tarifas de utilização dos OPC por kWh", "unitPrice": subUsage.preco_unitario_opc_energia, "uom": "KWh", "quantity": subUsage.energia_total_periodo, "vat": vat, "discount": 0, "total": 0
                }
                var line6_OPC_TIME = {
                    "code": global.Item_OPC_TIME, "description": "Tarifas de utilização dos OPC por min", "unitPrice": subUsage.preco_unitario_opc_tempo, "uom": "min", "quantity": subUsage.periodDuration, "vat": vat, "discount": 0, "total": 0
                }

                equalLineIndex = invoiceLines.findIndex(obj => obj.code == global.Item_OPC_FLAT && obj.unitPrice == 1)
                if (equalLineIndex > -1) {
                    invoiceLines[equalLineIndex].quantity += subUsage.preco_unitario_opc_ativacao
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
            var line7_IEC = {
                "code": global.Item_IEC, "description": "IEC – Imposto Especial sobre o Consumo", "unitPrice": chargingSession.fees.IEC, "uom": "kWh", "quantity": cdr.total_energy, "vat": vat, "discount": 0, "total": 0
            }

            if (cdr.total_energy > 0) {
                invoiceLines.push(line7_IEC);
            }

            var line8_OTHERS = {
                "code": global.Item_OTHERS, "description": "Tarifa de serviço EVIO", "unitPrice": others, "uom": "UN", "quantity": 1, "vat": vat, "discount": 0, "total": 0
            }

            if (this.hasMinimumBillingConditionsMobiE(cdr)) {
                invoiceLines.push(line8_OTHERS);
            }

            var line9_MOBIE_Grant = {
                "code": global.Item_Public_Grant, "description": "Apoio Público à Mobilidade Elétrica", "unitPrice": mobiEGrant, "uom": "UN", "quantity": 1, "vat": vat, "discount": 0, "total": 0, "taxExemptionReasonCode": process.env.TaxExemptionM01
            }

            console.log(`[Function getInvoiceLines] MobiE apoio taxExemptionReasonCode added`)

            if (cdr_end_date_time.getFullYear() > 2021 && this.hasMinimumBillingConditionsMobiE(cdr)) {
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
                Sentry.captureMessage(`Invoice line with negativa value. Debug Data: ${JSON.stringify({subUsages: cdr?.mobie_cdr_extension?.subUsages, invoiceLines})}`);
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

            var footer = {
                total_exc_vat: totalPrice.excl_vat,
                total_inc_vat: totalPrice.incl_vat
            }

            var others = 0;
            var activationFee = 0;

            var cdr_end_date_time = new Date(cdr.end_date_time)
            if (cdr_end_date_time.getFullYear() == 2021) {
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
                    activationFee = Number(process.env.AD_HOC_Activation_Fee_Card);
                } else if (chargingSession.paymentType == "AD_HOC" && chargingSession.paymentMethod == "wallet") {
                    activationFee = Number(process.env.AD_HOC_Activation_Fee_Wallet);
                } else {
                    activationFee = Number(process.env.AD_HOC_Activation_Fee_Wallet);
                }
            }



            others += activationFee;
            var VAT_Price = await this.getVATwithViesVAT(chargingSession); //Iva

            chargingSession.start_date_time = new Date(chargingSession.local_start_date_time ?? chargingSession.start_date_time).toISOString() 

            let iecPrice_excl_vat;

            if (chargingSession.finalPrices && chargingSession.finalPrices.iecPrice) {
                iecPrice_excl_vat = chargingSession.finalPrices.iecPrice.excl_vat;
            } else {
                iecPrice_excl_vat = 0;
            };
            let mobiEGrant = cdr?.mobie_cdr_extension?.usage?.apoio_mobilidade_eletrica_ceme > 0 ? -cdr.mobie_cdr_extension.usage.apoio_mobilidade_eletrica_ceme : 0

            var attachLine = {
                "date": moment(chargingSession.start_date_time).format("DD/MM/YYYY"),
                "startTime": moment(chargingSession.start_date_time).format("HH:mm"),
                "duration": new Date(chargingSession.timeCharged * 1000).toISOString().substr(11, 8),
                "city": chargingSession.address.city,
                "network": chargingSession.source,
                "hwId": chargingSession.location_id,
                "totalPower": chargingSession.kwh,
                "energyCost": chargingSession.finalPrices.cemePriceDetail.powerPrice.excl_vat,
                "tar": chargingSession.finalPrices.tarPrice.excl_vat,
                "mobiEGrant": mobiEGrant,//TODO
                "activationFee": activationFee,
                "opcTimeCost": cdr?.mobie_cdr_extension?.subUsages?.map(obj => obj.preco_opc_tempo)?.reduce((a, b) => a + b, 0) ?? 0,
                "opcEnergyCost": cdr?.mobie_cdr_extension?.subUsages?.map(obj => obj.preco_opc_energia)?.reduce((a, b) => a + b, 0) ?? 0,
                "opcFlatCost": cdr?.mobie_cdr_extension?.subUsages?.map(obj => obj.preco_opc_ativacao)?.reduce((a, b) => a + b, 0) ?? 0,
                //"others": this.round(others + iecPrice_excl_vat),
                "iec": iecPrice_excl_vat,
                "total_exc_vat": totalPrice.excl_vat,
                "vat": chargingSession.fees.IVA * 100,
                "total_inc_vat": totalPrice.incl_vat,

            }
            var body = {
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
                            evio_services: { total_exc_vat: others, vat: this.round(VAT_Price * others) },
                            evio_network: { total_exc_vat: 0, vat: 0 },
                            mobie_network: { total_exc_vat: this.round(totalPrice.excl_vat - others), vat: this.round(VAT_Price * (totalPrice.excl_vat - others)) },
                            other_networks: { total_exc_vat: 0, vat: 0 }
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
                                address: chargingSession.address.street
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
    updateStopSessionMeterValues: function (chargingSession) {
        return new Promise(async (resolve, reject) => {
            //Obter inicio de sessão de carregamento à sessão de carregamento
            var end_date_time = new Date().toISOString();
            var startDate = chargingSession.start_date_time;
            var endDate_moment = moment(end_date_time);

            //VAT
            var VAT_Price = await this.getVATwithViesVAT(chargingSession); //Iva

            //Calcular tempo total de carregamento
            var timeChargedinSeconds = Utils.getChargingTime(startDate, endDate_moment);

            //Obter energia total consumida ao payload do request
            var totalPowerConsumed_Kw = -1;
            var totalPowerConsumed_W = 0;
            var instantPower = -1;
            var instantVoltage = -1;
            var instantAmperage = -1;
            var evBattery = -1;
            var CO2emitted = 0;

            if (chargingSession.kwh >= 0) {
                totalPowerConsumed_Kw = chargingSession.kwh;
                totalPowerConsumed_W = totalPowerConsumed_Kw * 1000;
                CO2emitted = Number(process.env.CarbonIntensity) * totalPowerConsumed_Kw;// Kg CO₂ eq/kWh
                if (CO2emitted < 0)
                    CO2emitted = 0
            }

            var readingPoints = [{
                totalPower: totalPowerConsumed_W,
                instantPower: instantPower,
                instantVoltage: instantVoltage,
                batteryCharged: evBattery,
                instantAmperage: instantAmperage
            }]

            //Calcular estimativa de custo
            var estimatedPrice_excl_Vat = -1;
            var estimatedPrice_incl_Vat = -1;
            var priceComponents = chargingSession.tariffOPC.elements;

            //Calculate OPC Prices
            var OPC_Price_FLAT = 0;
            var OPC_Price_TIME = 0;
            var OPC_Price_POWER = 0;
            priceComponents.map(function (item) {

                if (item.price_components[0].type == 'FLAT') {
                    OPC_Price_FLAT = item.price_components[0].price;
                }
                else if (item.price_components[0].type == 'TIME') {
                    OPC_Price_TIME = item.price_components[0].price;
                }
                else if (item.price_components[0].type == 'ENERGY') {
                    OPC_Price_POWER = item.price_components[0].price;
                }
            });

            //Sometimes charging station sent negative values in kw attribute. 
            var aux_totalPowerConsumed_Kw = 0;
            if (totalPowerConsumed_Kw >= 0)
                aux_totalPowerConsumed_Kw = totalPowerConsumed_Kw;

            //////////////////////////////////// OPC /////////////////////////////////////////
            var OPC_PRICE_TIME_TOTAL = ((timeChargedinSeconds / 60) * OPC_Price_TIME);
            var OPC_PRICE_POWER_TOTAL = aux_totalPowerConsumed_Kw * OPC_Price_POWER;
            var OPC_Price = OPC_Price_FLAT + OPC_PRICE_TIME_TOTAL + OPC_PRICE_POWER_TOTAL;

            var opcPrice = { excl_vat: this.round(OPC_Price), incl_vat: this.round(OPC_Price + (VAT_Price * OPC_Price)) }

            var opcPriceDetail = {
                flatPrice: { excl_vat: this.round(OPC_Price_FLAT), incl_vat: this.round(OPC_Price_FLAT + (OPC_Price_FLAT * VAT_Price)) },
                timePrice: { excl_vat: this.round(OPC_PRICE_TIME_TOTAL), incl_vat: this.round(OPC_PRICE_TIME_TOTAL + (OPC_PRICE_TIME_TOTAL * VAT_Price)) },
                powerPrice: { excl_vat: this.round(OPC_PRICE_POWER_TOTAL), incl_vat: this.round(OPC_PRICE_POWER_TOTAL + (OPC_PRICE_POWER_TOTAL * VAT_Price)) }
            }
            //////////////////////////////////// OPC /////////////////////////////////////////
            var Ad_Hoc_activationFee = 0;
            let object_end_date_time = new Date(end_date_time)
            if (object_end_date_time.getFullYear() == 2021) {
                //Other Prices, 0.15€ activation fee

                if (chargingSession.paymentType == "AD_HOC" && chargingSession.paymentMethod == "card") {
                    Ad_Hoc_activationFee = Number(process.env.AD_HOC_Activation_Fee_Card_2021);
                } else if (chargingSession.paymentType == "AD_HOC" && chargingSession.paymentMethod == "wallet") {
                    Ad_Hoc_activationFee = Number(process.env.AD_HOC_Activation_Fee_Wallet_2021);
                } else {
                    Ad_Hoc_activationFee = Number(process.env.AD_HOC_Activation_Fee_Wallet_2021);
                }
            }
            else {
                if (chargingSession.paymentType == "AD_HOC" && chargingSession.paymentMethod == "card") {
                    Ad_Hoc_activationFee = Number(process.env.AD_HOC_Activation_Fee_Card);
                } else if (chargingSession.paymentType == "AD_HOC" && chargingSession.paymentMethod == "wallet") {
                    Ad_Hoc_activationFee = Number(process.env.AD_HOC_Activation_Fee_Wallet);
                } else {
                    Ad_Hoc_activationFee = Number(process.env.AD_HOC_Activation_Fee_Wallet);
                }
            }

            let dateNow = new Date();
            let mobiEGrant
            
            if (dateNow < new Date("2024-01-01T00:00:00.000Z"))
                mobiEGrant = Number(process.env.MobiE_Grant)
            else if(dateNow < new Date("2025-01-01T00:00:00.000Z"))
                mobiEGrant = Number(process.env.MobiE_GrantNew)
            else mobiEGrant = 0

            var otherPrices = [
                { description: `Activation Fee ${Ad_Hoc_activationFee}`, price: { excl_vat: Ad_Hoc_activationFee, incl_vat: this.round(Ad_Hoc_activationFee + (VAT_Price * Ad_Hoc_activationFee)) } },
                { description: `MobiE Grant ${mobiEGrant}`, price: { excl_vat: mobiEGrant, incl_vat: this.round(mobiEGrant + (VAT_Price * mobiEGrant)) } },
            ]


            // //////////////////////////////////// CEME /////////////////////////////////////////
            // var CEME_Price_POWER = chargingSession.tariffCEME.tariff[0].price;
            // var CEME_Price_Power = CEME_Price_POWER * aux_totalPowerConsumed_Kw;
            // var CEME_Price_TOTAL = CEME_Price_Power + Ad_Hoc_activationFee + mobiEGrant;
            // let CEME_Price_Flat = this.round(Ad_Hoc_activationFee) + this.round(mobiEGrant)
            // var CEME_PRICE_inc_vat = CEME_Price_TOTAL + (VAT_Price * CEME_Price_TOTAL);
            // var cemePrice = { excl_vat: this.round(CEME_Price_TOTAL), incl_vat: this.round(CEME_PRICE_inc_vat) }
            // var cemePriceDetail = {
            //     flatPrice: { excl_vat: this.round(CEME_Price_Flat), incl_vat: this.round(CEME_Price_Flat + (CEME_Price_Flat * VAT_Price)) },
            //     timePrice: { excl_vat: 0, incl_vat: 0 },
            //     powerPrice: { excl_vat: this.round(CEME_Price_Power), incl_vat: this.round(CEME_Price_Power + (CEME_Price_Power * VAT_Price)) }
            // }
            // //////////////////////////////////// CEME /////////////////////////////////////////

            var IEC_Price = chargingSession.fees.IEC * aux_totalPowerConsumed_Kw;
            var iecPrice = { excl_vat: this.round(IEC_Price), incl_vat: this.round(IEC_Price + (VAT_Price * IEC_Price)) }

            var voltageLevel = "BTN";

            if (chargingSession.voltageLevel !== undefined && chargingSession.voltageLevel !== null) {
                voltageLevel = chargingSession.voltageLevel;
            }

            //TAR FEE
            var scheduleTime = this.getCemeScheduleTime();


            var time = endDate_moment.format('HH:mm');

            var tariffType = "server_empty";
            var TAR_Schedule = _.where(scheduleTime, { tariffType: chargingSession.tariffCEME.tariffType, cycleType: chargingSession.tariffCEME.cycleType }); //Taxa TAR
            if (time >= '00:00' && time <= '08:00') {
                tariffType = TAR_Schedule[0].schedules[0].tariffType;
            }
            if (time > '08:00' && time <= '22:00') {
                tariffType = TAR_Schedule[0].schedules[1].tariffType;
            }
            if (time > '22:00' && time <= '24:00') {
                tariffType = TAR_Schedule[0].schedules[2].tariffType;
            }

            //////////////////////////////////// CEME /////////////////////////////////////////
            var CEME_Price_POWER = chargingSession.tariffCEME.tariff.find(elem => elem.tariffType === tariffType).price
            var CEME_Price_Power = CEME_Price_POWER * aux_totalPowerConsumed_Kw;
            var CEME_Price_TOTAL = CEME_Price_Power + Ad_Hoc_activationFee + mobiEGrant;
            let CEME_Price_Flat = this.round(Ad_Hoc_activationFee) + this.round(mobiEGrant)
            var CEME_PRICE_inc_vat = CEME_Price_TOTAL + (VAT_Price * CEME_Price_TOTAL);
            var cemePrice = { excl_vat: this.round(CEME_Price_TOTAL), incl_vat: this.round(CEME_PRICE_inc_vat) }
            var cemePriceDetail = {
                flatPrice: { excl_vat: this.round(CEME_Price_Flat), incl_vat: this.round(CEME_Price_Flat + (CEME_Price_Flat * VAT_Price)) },
                timePrice: { excl_vat: 0, incl_vat: 0 },
                powerPrice: { excl_vat: this.round(CEME_Price_Power), incl_vat: this.round(CEME_Price_Power + (CEME_Price_Power * VAT_Price)) }
            }
            //////////////////////////////////// CEME /////////////////////////////////////////

            //TODO
            //No futuro devemos melhorar isto para somar os valores corretos em função do horário de carregamento (vazio, fora vazio, ponta, cheias, etc. Ver exemplos da Mobie nos CDRs)
            var TAR_Tariffs = this.getTariffTAR("").tariff;
            var TAR_Tariff = _.where(TAR_Tariffs, { voltageLevel: voltageLevel, tariffType: tariffType }); //Taxa TAR

            var TAR_Price = TAR_Tariff[0].price * aux_totalPowerConsumed_Kw;
            var tarPrice = { excl_vat: this.round(TAR_Price), incl_vat: this.round(TAR_Price + (VAT_Price * TAR_Price)) }


            //Final PRICES
            // estimatedPrice_excl_Vat_without_FEES = OPC_Price + CEME_Price_TOTAL + TAR_Price;
            // estimatedPrice_excl_Vat = OPC_Price + CEME_Price_TOTAL + IEC_Price + TAR_Price;
            // estimatedPrice_incl_Vat = estimatedPrice_excl_Vat + (VAT_Price * estimatedPrice_excl_Vat);

            estimatedPrice_excl_Vat = opcPrice.excl_vat + cemePrice.excl_vat + tarPrice.excl_vat + iecPrice.excl_vat;
            estimatedPrice_incl_Vat = opcPrice.incl_vat + cemePrice.incl_vat + tarPrice.incl_vat + iecPrice.incl_vat;

            var totalCost = { excl_vat: this.round(estimatedPrice_excl_Vat), incl_vat: this.round(estimatedPrice_incl_Vat) }

            var vatPrice = { vat: this.round(VAT_Price), value: this.round((estimatedPrice_incl_Vat - estimatedPrice_excl_Vat)) }
            var finalPrices = {
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



            var query = { _id: chargingSession._id };
            var newValues = {
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

            Session.updateSession(query, newValues, (err, result) => {
                if (err) {
                    console.error(`[update Session OCPI] Error `, err);
                    resolve(err);
                }
                else {
                    resolve();
                };
            });

        });
    },
    processBillingAndPayment: function (sessionId, cdr) {

        let query = { id: sessionId };
        console.log("sessionId", sessionId);

        var totalPowerConsumed_Kw = cdr.total_energy;

        this.chargingSessionFindOne(query).then(async (chargingSession) => {

            if (chargingSession) {

                try {
                    let minimumBillingConditions = this.hasMinimumBillingConditionsMobiE(cdr)

                    var VAT_Price = await this.getVATwithViesVAT(chargingSession); //Iva

                    ////////////////////////////////////////////////
                    //OPC Cost
                    var OPC_Price = minimumBillingConditions ? cdr.total_cost.excl_vat : 0;
                    var opcPrice = { excl_vat: this.round(OPC_Price), incl_vat: this.round(OPC_Price + (VAT_Price * OPC_Price)) }
                    var opcFlat = minimumBillingConditions ? cdr.mobie_cdr_extension.subUsages.map(obj => obj.preco_opc_ativacao).reduce((a, b) => a + b, 0) : 0;
                    var opcTime = minimumBillingConditions ? cdr.mobie_cdr_extension.subUsages.map(obj => obj.preco_opc_tempo).reduce((a, b) => a + b, 0) : 0;
                    var opcPower = cdr.mobie_cdr_extension.subUsages.map(obj => obj.preco_opc_energia).reduce((a, b) => a + b, 0);

                    var opcPriceDetail = {
                        flatPrice: { excl_vat: this.round(opcFlat), incl_vat: this.round(opcFlat + (opcFlat * VAT_Price)) },
                        timePrice: { excl_vat: this.round(opcTime), incl_vat: this.round(opcTime + (opcTime * VAT_Price)) },
                        powerPrice: { excl_vat: this.round(opcPower), incl_vat: this.round(opcPower + (opcPower * VAT_Price)) }
                    }

                    var cdr_end_date_time = new Date(cdr.end_date_time)
                    var Ad_Hoc_activationFee = 0;
                    if (cdr_end_date_time.getFullYear() == 2021) {

                        if (chargingSession.paymentType == "AD_HOC" && chargingSession.paymentMethod == "card") {
                            Ad_Hoc_activationFee = Number(process.env.AD_HOC_Activation_Fee_Card_2021);
                        } else if (chargingSession.paymentType == "AD_HOC" && chargingSession.paymentMethod == "wallet") {
                            Ad_Hoc_activationFee = Number(process.env.AD_HOC_Activation_Fee_Wallet_2021);
                        } else {
                            Ad_Hoc_activationFee = Number(process.env.AD_HOC_Activation_Fee_Wallet_2021);
                        }

                        Ad_Hoc_activationFee = minimumBillingConditions ? Ad_Hoc_activationFee : 0
                    }
                    else {

                        if (chargingSession.paymentType == "AD_HOC" && chargingSession.paymentMethod == "card") {
                            Ad_Hoc_activationFee = Number(process.env.AD_HOC_Activation_Fee_Card);
                        } else if (chargingSession.paymentType == "AD_HOC" && chargingSession.paymentMethod == "wallet") {
                            Ad_Hoc_activationFee = Number(process.env.AD_HOC_Activation_Fee_Wallet);
                        } else {
                            Ad_Hoc_activationFee = Number(process.env.AD_HOC_Activation_Fee_Wallet);
                        }

                        Ad_Hoc_activationFee = minimumBillingConditions ? Ad_Hoc_activationFee : 0
                    }

                    let mobiEGrant = minimumBillingConditions ? cdr.mobie_cdr_extension.usage.apoio_mobilidade_eletrica_ceme > 0 ? -cdr.mobie_cdr_extension.usage.apoio_mobilidade_eletrica_ceme : 0 : 0
                    var otherPrices = [
                        { description: `Activation Fee ${Ad_Hoc_activationFee}`, price: { excl_vat: Ad_Hoc_activationFee, incl_vat: this.round(Ad_Hoc_activationFee + (VAT_Price * Ad_Hoc_activationFee)) } },
                        { description: `MobiE Grant ${mobiEGrant}`, price: { excl_vat: mobiEGrant, incl_vat: this.round(mobiEGrant + (VAT_Price * mobiEGrant)) } },
                    ]


                    ////////////////////////////////////////////////
                    //CEME Price
                    var CEME_Price = 0
                    let tariffCemePriceEmpty = chargingSession.tariffCEME.tariff.find(elem => elem.tariffType === process.env.TariffTypeEmpty).price
                    let tariffCemePriceOutEmpty = chargingSession.tariffCEME.tariff.find(elem => elem.tariffType === process.env.TariffTypeOutEmpty).price

                    cdr.mobie_cdr_extension.subUsages.forEach(subUsage => {

                        CEME_Price += this.round(tariffCemePriceOutEmpty * subUsage.energia_fora_vazio) + this.round(tariffCemePriceEmpty * subUsage.energia_vazio)
                    })
                    let CEME_Price_total = this.round(CEME_Price) + this.round(Ad_Hoc_activationFee) + this.round(mobiEGrant)
                    let CEME_Price_Flat = this.round(Ad_Hoc_activationFee) + this.round(mobiEGrant)
                    var cemePrice = { excl_vat: this.round(CEME_Price_total), incl_vat: this.round(CEME_Price_total + (VAT_Price * CEME_Price_total)) }

                    var cemePriceDetail = {
                        flatPrice: { excl_vat: this.round(CEME_Price_Flat), incl_vat: this.round(CEME_Price_Flat + (CEME_Price_Flat * VAT_Price)) },
                        timePrice: { excl_vat: 0, incl_vat: 0 },
                        powerPrice: { excl_vat: this.round(CEME_Price), incl_vat: this.round(CEME_Price + (CEME_Price * VAT_Price)) }
                    }

                    ////////////////////////////////////////////////
                    //TAR Price
                    var TAR_Price = cdr.mobie_cdr_extension.subUsages.map(obj => obj.preco_com_desconto_acesso_redes).reduce((a, b) => a + b, 0);
                    var tarPrice = { excl_vat: this.round(TAR_Price), incl_vat: this.round(TAR_Price + (VAT_Price * TAR_Price)) }

                    ////////////////////////////////////////////////
                    //IEC Price
                    var IEC_Price = totalPowerConsumed_Kw * chargingSession.fees.IEC;
                    var iecPrice = { excl_vat: this.round(IEC_Price), incl_vat: this.round(IEC_Price + (VAT_Price * IEC_Price)) }


                    var invoiceLines = await Utils.getInvoiceLines(cdr, chargingSession.userIdWillPay, chargingSession);
                    var total_exc_vat = 0;
                    var total_inc_vat = 0;
                    invoiceLines.forEach(line => {
                        total_exc_vat += this.round(line.quantity * line.unitPrice);
                    });

                    total_inc_vat = total_exc_vat + (total_exc_vat * VAT_Price);
                    var totalPrice = { excl_vat: this.round(total_exc_vat), incl_vat: this.round(total_inc_vat) };

                    var vatPrice = { vat: VAT_Price, value: this.round(total_inc_vat - total_exc_vat) }

                    var finalPrices = {
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

                    var timeChargedinSeconds = Utils.getChargingTime(moment(cdr.start_date_time), moment(cdr.end_date_time));

                    var CO2emitted = 0;

                    var totalPowerConsumed_W = 0;
                    if (totalPowerConsumed_Kw >= 0) {
                        totalPowerConsumed_W = totalPowerConsumed_Kw * 1000;
                        CO2emitted = this.round(Number(process.env.CarbonIntensity) * totalPowerConsumed_Kw);// Kg CO₂ eq/kWh
                        if (CO2emitted < 0)
                            CO2emitted = 0
                    }

                    chargingSession.timeCharged = timeChargedinSeconds;
                    chargingSession.kwh = totalPowerConsumed_Kw

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
                        paymentStatus: 'UNPAID',
                        status: global.SessionStatusStopped
                    };
                    // let minimumBillingConditions = this.hasMinimumBillingConditionsMobiE(cdr)
                    bodySession.minimumBillingConditions = minimumBillingConditions

                    if (chargingSession.paymentType == "AD_HOC") {
                        //Billing

                        //Call Payments Microservice
                        var bodyPayment = {
                            amount: { currency: cdr.currency, value: minimumBillingConditions ? totalPrice.incl_vat : 0 },
                            userId: chargingSession.userIdWillPay,
                            sessionId: chargingSession._id,
                            listOfSessions: [],
                            hwId: chargingSession.location_id,
                            chargerType: chargingSession.chargerType,
                            paymentMethod: chargingSession.paymentMethod,
                            paymentMethodId: chargingSession.paymentMethodId,
                            transactionId: chargingSession.transactionId,
                            adyenReference: chargingSession.adyenReference,
                            reservedAmount: chargingSession.reservedAmount
                        }

                        this.makePayment(bodyPayment).then((result) => {

                            //If success (40) - Save paymentId and transactionId and change status to PAID 
                            //If success (10/20) - Save paymentId and transactionId  
                            bodySession.paymentId = result._id;
                            bodySession.transactionId = result.transactionId;

                            //console.log("result payment", result);
                            if (result.status == "40") {
                                bodySession.paymentStatus = 'PAID';
                                bodySession.paymentSubStatus = "PAID AND CLOSED";
                                if (minimumBillingConditions) {
                                    Utils.billing(cdr, chargingSession.userIdWillPay, chargingSession, result._id, invoiceLines, totalPrice).then((res) => {
                                        bodySession.invoiceStatus = true;
                                        bodySession.invoiceId = res.invoiceId;
                                        this.updateSession(sessionId, bodySession);
                                    }).catch((err) => {
                                        if (err?.response?.data) {
                                            bodySession.invoiceSubStatus = JSON.stringify(err?.response?.data)
                                        } else {
                                            bodySession.invoiceSubStatus = err?.message
                                        }
                                        this.updateSession(sessionId, bodySession);
                                    });
                                } else {
                                    console.log("No minimum billing conditions were found")
                                    this.updateSession(sessionId, bodySession);
                                }
                            }
                            else if (result.status == "10" || result.status == "20") {
                                bodySession.paymentSubStatus = "PAID AND WAITING FOR ADYEN NOTIFICATION";
                                this.updateSession(sessionId, bodySession);
                            }
                            else {
                                bodySession.paymentSubStatus = "PAYMENT FAILED FOR ANY REASON";
                                this.updateSession(sessionId, bodySession);
                            }

                        }).catch((err) => {
                            console.log("Error calling payment microservice: ", err?.message)
                            bodySession.paymentSubStatus = "PAYMENT FAILED FOR ANY REASON - " + err?.message;
                            this.updateSession(sessionId, bodySession);
                        });


                    }
                    else {
                        //Monthly Billing
                        console.log("bodySession", bodySession)
                        this.updateSession(sessionId, bodySession);
                    }

                }
                catch (err) {
                    console.log("Billing CDR - err", err)
                    this.updateSession(sessionId, { status: global.SessionStatusStopped });
                }

            }
            else {
                console.log("[Utils - processBillingAndPayment] - Charging session " + sessionId + " not found");
            }

        });


    },
    chargingSessionFindOne: function (query) {
        var context = "Funciton chargingSessionFindOne";
        return new Promise((resolve, reject) => {
            Session.findOne(query, (err, chargingSessionFound) => {
                if (err) {
                    console.error(`[${context}][findOne] Error `, err.message);
                    reject(err);
                }
                else {
                    resolve(chargingSessionFound);
                };
            });
        });
    },
    updateOrCreateCharger: function (charger) {
        return new Promise((resolve, reject) => {
            //console.log(charger.operator);
            if (charger.evses != undefined && charger.evses.length > 0) {
                let { country_code, party_id } = this.parsePartyIdCountryCode(charger.operator.name)
                let countryCode = this.countryToCountryCode(charger, charger.country, country_code)
                let partyId = (charger.party_id === null || typeof charger.party_id === 'undefined') ? party_id : charger.party_id
                Utils.getPlugs(charger.evses, charger.id, countryCode, partyId)
                    .then((plugs) => {

                        var name = "";
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
                                zipCode: charger.postal_code,
                                city: charger.city.replace(regex, subst)
                            },
                            parkingType: Utils.getMapping(charger.type, "parkingType"),
                            geometry: {
                                type: "Point",
                                coordinates: [
                                    charger.coordinates.longitude,
                                    charger.coordinates.latitude
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
                            timeZone: charger.time_zone,
                            lastUpdated: charger.last_updated,
                            operationalStatus: "APPROVED"
                        }

                        resolve(chargerInfo)

                    });
            } else {

                var name = "";
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
                        zipCode: charger.postal_code,
                        city: charger.city.replace(regex, subst)
                    },
                    parkingType: Utils.getMapping(charger.type, "parkingType"),
                    geometry: {
                        type: "Point",
                        coordinates: [
                            charger.coordinates.longitude,
                            charger.coordinates.latitude
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
                    timeZone: charger.time_zone,
                    lastUpdated: charger.last_updated,
                    operationalStatus: "APPROVED"
                }

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
        var context = "Function getEVByEvId";
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
                    console.error(`[${context}] Error `, error.message);
                    resolve('-1');
                });
        });
    },
    updateSession: function (sessionId, body) {
        let query = {
            id: sessionId
        };

        Session.findOneAndUpdate(query, body, (err, session) => {
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
                        // evseGroup : evseGroup,
                        //TODO If service cost is sent here, it will override the existing service cost every time we update a charger 
                        // serviceCost: {
                        //     initialCost: '-1',
                        //     costByTime: [
                        //         { cost: '-1' }
                        //     ],
                        //     costByPower: {
                        //         cost: '-1'
                        //     }
                        // },
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
        var context = "Function getEVByEvId";
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
                    console.error(`[${context}] Error `, error.message);
                    resolve('-1');
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
            // if (plugStatus.includes("UNKNOWN") || plugStatus.includes("OUTOFORDER")) {
            //     return '50';
            // }
            // else {
            //     return '50';
            // }
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

        Session.findOneAndUpdate(query, body, (err, session) => { });
    },
    getTimePrice: function (chargingTime, unitTimePrice, step_size) {

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
        let step_size_minutes = step_size / 60

        return Math.ceil(chargingTimeMinutes / step_size_minutes) * unitTimePriceMinutes * step_size_minutes
    },
    getEnergyPrice: function (chargingEnergy, unitEnergyPrice, step_size) {

        /* 
            ACCORDING TO OCPI DOCUMENTATION:

            chargingEnergy(total_energy) comes in kWh 
            unitEnergyPrice comes in €/kWh 
            step_size comes in Wh 
            
        */

        let step_size_kWh = step_size / 1000

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
        return new Promise(async (resolve, reject) => {
            //Obter inicio de sessão de carregamento à sessão de carregamento
            var startDate
            if ('start_date_time' in payload) {
                startDate = payload.start_date_time;
            } else {
                startDate = chargingSession.start_date_time
            }

            var dateNow = moment.utc();
            // console.log("startDate:", startDate)
            // console.log("dateNow:", dateNow)

            //Calcular tempo total de carregamento
            var timeChargedinSeconds = Utils.getChargingTime(startDate, dateNow);

            //Obter energia total consumida ao payload do request
            var totalPowerConsumed_Kw = -1;
            var totalPowerConsumed_W = 0;
            var instantPower = -1;
            var instantVoltage = -1;
            var instantAmperage = -1;
            var evBattery = -1;
            var CO2emitted = 0;

            if (payload.kwh >= 0) {
                totalPowerConsumed_Kw = payload.kwh;
                totalPowerConsumed_W = totalPowerConsumed_Kw * 1000;
                CO2emitted = Number(process.env.CarbonIntensity) * totalPowerConsumed_Kw;// Kg CO₂ eq/kWh
                if (CO2emitted < 0)
                    CO2emitted = 0
            }

            var readingPoints = [{
                totalPower: totalPowerConsumed_W,
                instantPower: instantPower,
                instantVoltage: instantVoltage,
                batteryCharged: evBattery,
                instantAmperage: instantAmperage
            }]

            //Calcular estimativa de custo
            var estimatedPrice_excl_Vat = -1;
            var estimatedPrice_incl_Vat = -1;
            var priceComponents = chargingSession.tariffOPC.elements;
            // if (priceComponents !== null && priceComponents !== undefined) {
            //     priceComponents = this.createTariffElementsAccordingToRestriction(priceComponents, startDate, dateNow.format())
            // }
            let charging_periods = payload.charging_periods

            //Calculate OPC Prices
            var aux_totalPowerConsumed_Kw = 0;
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

            let [flat, energy, time, parking] = this.opcTariffsPrices(null, priceComponents, startDate, dateNow.format(), offset, plugPower, plugVoltage, aux_totalPowerConsumed_Kw, timeChargedinSeconds / 3600, 0)

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

            let CEME_Price_FLAT = CEME_FLAT ? CEME_FLAT.price : 0
            let CEME_Price_POWER = CEME_POWER ? CEME_POWER.price : 0
            let CEME_Price_TIME = CEME_TIME ? CEME_TIME.price : 0
            let evioPercentage = CEME_PERCENTAGE ? CEME_PERCENTAGE.price : 0

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

            let CEME_Price = CEME_Price_FLAT + CEME_Price_POWER * aux_totalPowerConsumed_Kw + CEME_Price_TIME * totalTimeConsumed;

            // VAT
            var VAT_Price = await this.getVATwithViesVAT(chargingSession); //Iva

            //Final PRICES
            estimatedPrice_excl_Vat_without_FEES = OPC_Price + CEME_Price + evioPercentage * OPC_Price + Number(process.env.GireveCommission)
            estimatedPrice_excl_Vat = OPC_Price + CEME_Price + evioPercentage * OPC_Price + Number(process.env.GireveCommission)
            estimatedPrice_incl_Vat = estimatedPrice_excl_Vat + (VAT_Price * estimatedPrice_excl_Vat);

            console.log({ estimatedPrice_excl_Vat_without_FEES: estimatedPrice_excl_Vat_without_FEES, energy: aux_totalPowerConsumed_Kw, time: (timeChargedinSeconds / 60), opc_price: OPC_Price, ceme_price: CEME_Price })

            var totalCost = { excl_vat: estimatedPrice_excl_Vat, incl_vat: estimatedPrice_incl_Vat }

            var query = { _id: chargingSession._id };
            var newValues = {
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

            Session.updateSession(query, newValues, (err, result) => {
                if (err) {
                    console.error(`[update Session OCPI] Error `, err);
                    resolve(err);
                }
                else {

                    let notificationBody = {
                        totalPower: totalPowerConsumed_W,
                        estimatedPrice: totalCost.incl_vat,
                        timeCharged: timeChargedinSeconds,
                        batteryCharged: evBattery
                    }

                    if (sendNotification) {
                        UtilsFirebase.dataFirebaseNotification(chargingSession, notificationBody);
                    }

                    resolve();
                };
            });

        });
    },
    opcTariffsPrices: function (charging_periods, elements, sessionStartDate, sessionStopDate, offset, power, voltage, total_energy, total_charging_time, total_parking_time) {
        let FLAT_OPC_PRICE = 0
        let TIME_OPC_PRICE = 0
        let ENERGY_OPC_PRICE = 0
        let PARKING_TIME_OPC_PRICE = 0

        let timeChargingPeriods = []
        let energyChargingPeriods = []
        let parkingTimeChargingPeriods = []

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
                let [flat, energy, time, parking] = this.getOpcPricesByChargingPeriod(elements, dimensionsObj, sessionStartDate, localPeriodStartDate, localPeriodEndDate, power, voltage, total_charging_time, total_parking_time, consumedPower_kWh, FLAT_OPC_PRICE, TIME_OPC_PRICE, ENERGY_OPC_PRICE, PARKING_TIME_OPC_PRICE)

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


            let [flat, energy, time, parking] = this.opcFinalPrices(elements, localSessionStartDate, localSessionEndDate, total_energy, power, total_charging_time, total_parking_time)

            //Total price in each dimension of the total session
            FLAT_OPC_PRICE = flat.price
            TIME_OPC_PRICE = time.price
            ENERGY_OPC_PRICE = energy.price
            PARKING_TIME_OPC_PRICE = parking.price

            // Array containing price charged for each period, volume of the consumed dimention and tariff info and restrictions
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
        return [{ price: FLAT_OPC_PRICE, info: [] }, { price: ENERGY_OPC_PRICE, info: energyChargingPeriods }, { price: TIME_OPC_PRICE, info: timeChargingPeriods }, { price: PARKING_TIME_OPC_PRICE, info: parkingTimeChargingPeriods }]
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
    getOpcPricesByChargingPeriod: function (elements, dimensionsObj, sessionStartDate, startDate, endDate, power, voltage, total_charging_time, total_parking_time, consumedPower, FLAT_OPC_PRICE, TIME_OPC_PRICE, ENERGY_OPC_PRICE, PARKING_TIME_OPC_PRICE) {
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
            let isEmpty = this.isEmptyObject(restrictions)
            for (let component of tariffElement.price_components) {
                let obeys = !isEmpty ? this.obeysRestrictions(restrictions, component, dimensionsObj, sessionStartDate, startDate, endDate, consumedPower, power, voltage, total_charging_time, total_parking_time) : true
                component.step_size = component.step_size !== null && component.step_size !== undefined ? component.step_size : 1
                let { priceRoundGranularity, priceRoundRule, stepRoundGranularity, stepRoundRule } = this.roundingsValidation(component)
                component.price = Utils.roundingGranularityRules(priceRoundGranularity, priceRoundRule, component.price)
                component.step_size = Utils.roundingGranularityRules(stepRoundGranularity, stepRoundRule, component.step_size)
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
                        TIME_OPC_PRICE += this.getTimePrice(dimensionsObj[component.type], component.price, component.step_size)
                        tariffTimeObj = {
                            quantity: dimensionsObj[component.type],
                            cost: this.getTimePrice(dimensionsObj[component.type], component.price, component.step_size),
                            component,
                            restrictions: !isEmpty ? restrictions : {}
                        }
                        tariffTime = true
                    } else if (component.type === "PARKING_TIME" && !tariffParkingTime) {
                        PARKING_TIME_OPC_PRICE += this.getTimePrice(dimensionsObj[component.type], component.price, component.step_size)
                        tariffParkingTimeObj = {
                            quantity: dimensionsObj[component.type],
                            cost: this.getTimePrice(dimensionsObj[component.type], component.price, component.step_size),
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


        //DAY_OF_WEEK_RESTRICTION 
        // if ('day_of_week' in restrictions && restrictions['day_of_week'] !== null && restrictions['day_of_week'] !== undefined) {
        //     let dateObj = new Date(startDate)
        //     let currentWeekDay = dateObj.toLocaleString("default" , {weekday : "long"} ).toUpperCase()
        //     if ( !(restrictions["day_of_week"].includes(currentWeekDay) ) ) {
        //         obeys = false
        //     }

        // }


        return obeys
    },
    opcFinalPrices: function (tariffElements, startDate, endDate, consumedPower, plugPower, total_charging_time, total_parking_time) {
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

        let consumedPower_s = consumedPower / (total_charging_time * 3600)

        // Append all valid tariffs to an array with its corresponding dimension types, valid periods in time and consumed energy in that period
        for (let element of tariffElements) {
            let restrictions = element.restrictions
            let priceComponents = element.price_components
            let isEmpty = this.isEmptyObject(restrictions)

            let tariffObj
            if (!isEmpty) {
                tariffObj = this.tariffIsValid(restrictions, priceComponents, startDate, endDate, total_charging_time, total_parking_time, consumedPower, plugPower)
            } else {
                tariffObj = {}
                priceComponents.forEach(component => {
                    // tariffObj[component.type] = {
                    //     isValid : true ,
                    //     periodConsumedPower : consumedPower , // kWh
                    //     periodConsumedTime : total_charging_time*3600, // s
                    //     periodConsumedParkingTime : total_parking_time*3600, // s
                    //     chargingPeriods : [Date.parse(startDate) , Date.parse(endDate)], // ms
                    //     component : component,
                    //     restrictions : {},
                    // }
                    if (component.type === "PARKING_TIME") {
                        tariffObj[component.type] = {
                            isValid: true,
                            periodConsumedPower: 0, // kWh
                            periodConsumedTime: 0, // s
                            periodConsumedParkingTime: total_parking_time * 3600, // s
                            chargingPeriods: [Date.parse(startDate) + total_charging_time * 3600 * 1000, Date.parse(endDate)], // ms
                            component: component,
                            restrictions: {},
                        }
                    } else {
                        tariffObj[component.type] = {
                            isValid: true,
                            periodConsumedPower: 0, // kWh
                            periodConsumedTime: total_charging_time * 3600, // s
                            periodConsumedParkingTime: 0, // s
                            chargingPeriods: [Date.parse(startDate), Date.parse(startDate) + total_charging_time * 3600 * 1000], // ms
                            component: component,
                            restrictions: {},
                        }
                    }
                })
            }
            chargingPeriodsObj = this.pushTariffsToChargingPeriods(tariffObj, chargingPeriodsObj)
        }
        /* 
            TODO: See how step_size should affect price calculation
        */

        // OPC PRICE FLAT 
        let [OCP_PRICE_FLAT, flatInfo] = this.calculateOpcPrice("FLAT", chargingPeriodsObj, consumedPower_s)

        // OPC PRICE ENERGY 
        let [OCP_PRICE_ENERGY, energyInfo] = this.calculateOpcPrice("ENERGY", chargingPeriodsObj, consumedPower_s)

        // OPC PRICE TIME 
        let [OCP_PRICE_TIME, timeInfo] = this.calculateOpcPrice("TIME", chargingPeriodsObj, consumedPower_s)

        // OPC PRICE PARKING_TIME 
        let [OCP_PRICE_PARKING_TIME, parkingTimeInfo] = this.calculateOpcPrice("PARKING_TIME", chargingPeriodsObj, consumedPower_s)

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

            if (component.type === "PARKING_TIME") {
                localStartDate = moment.utc(startLocalUnixTimestamp + total_charging_time * 3600 * 1000).format("YYYY-MM-DD")
                startLocalUnixTimestamp += total_charging_time * 3600 * 1000
            } else {
                localEndDate = moment.utc(startLocalUnixTimestamp + total_charging_time * 3600 * 1000).format("YYYY-MM-DD")
                endLocalUnixTimestamp = startLocalUnixTimestamp + total_charging_time * 3600 * 1000
            }

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

                if (!('start_time' in restrictions)) {


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

                if (!('start_date' in restrictions)) {
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
                            let lowerLimit = restrictions["min_kwh"] * (total_charging_time * 3600 * 1000 / consumedPower)
                            let upperLimit = restrictions["max_kwh"] * (total_charging_time * 3600 * 1000 / consumedPower)
                            chargingPeriods.push([
                                startLocalUnixTimestamp + lowerLimit, startLocalUnixTimestamp + upperLimit
                            ])
                        } else {
                            periodConsumedPower = consumedPower - restrictions["min_kwh"]
                            let lowerLimit = restrictions["min_kwh"] * (total_charging_time * 3600 * 1000 / consumedPower)
                            let upperLimit = total_charging_time * 3600 * 1000
                            chargingPeriods.push([
                                startLocalUnixTimestamp + lowerLimit, startLocalUnixTimestamp + upperLimit
                            ])
                        }
                    } else {
                        periodConsumedPower = consumedPower - restrictions["min_kwh"]
                        let lowerLimit = restrictions["min_kwh"] * (total_charging_time * 3600 * 1000 / consumedPower)
                        let upperLimit = total_charging_time * 3600 * 1000
                        chargingPeriods.push([
                            startLocalUnixTimestamp + lowerLimit, startLocalUnixTimestamp + upperLimit
                        ])
                    }
                }
            }

            // MAX_KWH_RESTRICTION
            if ('max_kwh' in restrictions && restrictions['max_kwh'] !== null && restrictions['max_kwh'] !== undefined) {
                if (!('min_kwh' in restrictions)) {
                    if (consumedPower >= restrictions["max_kwh"]) {
                        periodConsumedPower = restrictions["max_kwh"]
                        let upperLimit = restrictions["max_kwh"] * (total_charging_time * 3600 * 1000 / consumedPower)
                        chargingPeriods.push([
                            startLocalUnixTimestamp, startLocalUnixTimestamp + upperLimit
                        ])

                    } else {
                        periodConsumedPower = consumedPower
                        let upperLimit = total_charging_time * 3600 * 1000
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
                    if (total_charging_time * 3600 < restrictions['min_duration']) {
                        isValid = false
                    } else {
                        if ('max_duration' in restrictions && restrictions['max_duration'] !== null && restrictions['max_duration'] !== undefined) {

                            if (total_charging_time * 3600 >= restrictions['max_duration']) {
                                periodConsumedTime = restrictions['max_duration'] - restrictions['min_duration']
                                chargingPeriods.push([
                                    startLocalUnixTimestamp + restrictions['min_duration'] * 1000, startLocalUnixTimestamp + restrictions['min_duration'] * 1000 + periodConsumedTime * 1000
                                ])
                            } else {
                                periodConsumedTime = total_charging_time * 3600 - restrictions['min_duration']
                                chargingPeriods.push([
                                    startLocalUnixTimestamp + restrictions['min_duration'] * 1000, startLocalUnixTimestamp + restrictions['min_duration'] * 1000 + periodConsumedTime * 1000
                                ])

                            }
                        } else {
                            periodConsumedTime = total_charging_time * 3600 - restrictions['min_duration']
                            chargingPeriods.push([
                                startLocalUnixTimestamp + restrictions['min_duration'] * 1000, startLocalUnixTimestamp + restrictions['min_duration'] * 1000 + periodConsumedTime * 1000
                            ])
                        }
                    }
                } else if (component.type === 'PARKING_TIME') {
                    if (total_parking_time * 3600 < restrictions['min_duration']) {
                        isValid = false
                    } else {
                        if ('max_duration' in restrictions && restrictions['max_duration'] !== null && restrictions['max_duration'] !== undefined) {
                            if (total_parking_time * 3600 >= restrictions['max_duration']) {
                                periodConsumedParkingTime = restrictions['max_duration'] - restrictions['min_duration']
                                chargingPeriods.push([
                                    startLocalUnixTimestamp + restrictions['min_duration'] * 1000, startLocalUnixTimestamp + restrictions['min_duration'] * 1000 + periodConsumedParkingTime * 1000
                                ])
                            } else {

                                periodConsumedParkingTime = total_parking_time * 3600 - restrictions['min_duration']

                                chargingPeriods.push([
                                    startLocalUnixTimestamp + restrictions['min_duration'] * 1000, startLocalUnixTimestamp + restrictions['min_duration'] * 1000 + periodConsumedParkingTime * 1000
                                ])

                            }
                        } else {

                            periodConsumedParkingTime = total_parking_time * 3600 - restrictions['min_duration']
                            chargingPeriods.push([
                                startLocalUnixTimestamp + restrictions['min_duration'] * 1000, startLocalUnixTimestamp + restrictions['min_duration'] * 1000 + periodConsumedParkingTime * 1000
                            ])

                        }
                    }
                } else if (component.type === 'ENERGY') {
                    if (total_charging_time * 3600 < restrictions['min_duration']) {
                        isValid = false
                    } else {
                        if ('max_duration' in restrictions && restrictions['max_duration'] !== null && restrictions['max_duration'] !== undefined) {
                            if (total_charging_time * 3600 >= restrictions['max_duration']) {
                                periodConsumedTime = restrictions['max_duration'] - restrictions['min_duration']
                                chargingPeriods.push([
                                    startLocalUnixTimestamp + restrictions['min_duration'] * 1000, startLocalUnixTimestamp + restrictions['min_duration'] * 1000 + periodConsumedTime * 1000
                                ])
                            } else {
                                periodConsumedTime = total_charging_time * 3600 - restrictions['min_duration']
                                chargingPeriods.push([
                                    startLocalUnixTimestamp + restrictions['min_duration'] * 1000, startLocalUnixTimestamp + restrictions['min_duration'] * 1000 + periodConsumedTime * 1000
                                ])

                            }
                        } else {
                            periodConsumedTime = total_charging_time * 3600 - restrictions['min_duration']
                            chargingPeriods.push([
                                startLocalUnixTimestamp + restrictions['min_duration'] * 1000, startLocalUnixTimestamp + restrictions['min_duration'] * 1000 + periodConsumedTime * 1000
                            ])

                        }
                    }
                }
            }

            //MAX_DURATION_RESTRICTION
            if ('max_duration' in restrictions && restrictions['max_duration'] !== null && restrictions['max_duration'] !== undefined) {
                if (!('min_duration' in restrictions)) {
                    if (component.type === 'TIME') {
                        if (total_charging_time * 3600 >= restrictions['max_duration']) {
                            periodConsumedTime = restrictions['max_duration']
                            chargingPeriods.push([
                                startLocalUnixTimestamp, startLocalUnixTimestamp + periodConsumedTime * 1000
                            ])

                        } else {
                            periodConsumedTime = total_charging_time * 3600
                            chargingPeriods.push([
                                startLocalUnixTimestamp, startLocalUnixTimestamp + periodConsumedTime * 1000
                            ])

                        }
                    } else if (component.type === 'PARKING_TIME') {
                        if (total_parking_time * 3600 >= restrictions['max_duration']) {
                            periodConsumedParkingTime = restrictions['max_duration']
                            chargingPeriods.push([
                                startLocalUnixTimestamp, startLocalUnixTimestamp + periodConsumedTime * 1000
                            ])

                        } else {
                            periodConsumedParkingTime = total_parking_time * 3600
                            chargingPeriods.push([
                                startLocalUnixTimestamp, startLocalUnixTimestamp + periodConsumedTime * 1000
                            ])


                        }
                    } else if (component.type === 'ENERGY') {
                        if (total_charging_time * 3600 >= restrictions['max_duration']) {
                            periodConsumedTime = restrictions['max_duration']
                            chargingPeriods.push([
                                startLocalUnixTimestamp, startLocalUnixTimestamp + periodConsumedTime * 1000
                            ])

                        } else {
                            periodConsumedTime = total_charging_time * 3600
                            chargingPeriods.push([
                                startLocalUnixTimestamp, startLocalUnixTimestamp + periodConsumedTime * 1000
                            ])
                        }
                    }
                }
            }

            //DAY_OF_WEEK_RESTRICTION 
            // if ('day_of_week' in restrictions && restrictions['day_of_week'] !== null && restrictions['day_of_week'] !== undefined) {
            //     let startDateObj = new Date(startLocalUnixTimestamp)
            //     let currentWeekDay = startDateObj.toLocaleString("default" , {weekday : "long"} ).toUpperCase()
            //     let endDateObj = new Date(endLocalUnixTimestamp)
            //     let endDateWeekDay = endDateObj.toLocaleString("default" , {weekday : "long"} ).toUpperCase()

            //     // Local End Date set to midnight
            //     let localMomentEndDate = moment.utc(`${localEndDate}}` , "YYYY-MM-DD").format()

            //     if ( !(restrictions["day_of_week"].includes(currentWeekDay) ) ) {
            //         if (restrictions["day_of_week"].includes(endDateWeekDay)) {
            //             chargingPeriods.push([
            //                 Date.parse(localMomentEndDate) , endLocalUnixTimestamp
            //             ])
            //         } else {
            //             isValid = false
            //         }
            //     } else {
            //         if ( !(restrictions["day_of_week"].includes(endDateWeekDay)) ) {
            //             chargingPeriods.push([
            //                 startLocalUnixTimestamp , Date.parse(localMomentEndDate)
            //             ])
            //         } else {
            //             chargingPeriods.push([
            //                 startLocalUnixTimestamp ,endLocalUnixTimestamp
            //             ])
            //         }
            //     }

            // }

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
    calculateOpcPrice: function (type, chargingPeriodsObj, consumedPower_s) {
        let dimensionArray = chargingPeriodsObj[type]
        let price = 0
        let chargingPeriodsInfo = []
        if (dimensionArray.length > 0) {
            if (type === "FLAT") {
                price = dimensionArray[0].component.price
            } else if (type === "ENERGY") {
                dimensionArray.forEach(element => {
                    element.component.step_size = element.component.step_size !== null && element.component.step_size !== undefined ? element.component.step_size : 1
                    let { priceRoundGranularity, priceRoundRule, stepRoundGranularity, stepRoundRule } = this.roundingsValidation(element.component)
                    element.component.price = Utils.roundingGranularityRules(priceRoundGranularity, priceRoundRule, element.component.price)
                    element.component.step_size = Utils.roundingGranularityRules(stepRoundGranularity, stepRoundRule, element.component.step_size)
                    if (element.periodConsumedPower !== 0) {
                        price += this.getEnergyPrice(element.periodConsumedPower, element.component.price, element.component.step_size)
                        chargingPeriodsInfo.push({
                            quantity: element.periodConsumedPower,
                            cost: this.getEnergyPrice(element.periodConsumedPower, element.component.price, element.component.step_size),
                            component: element.component,
                            restrictions: element.restrictions
                        })
                    } else {
                        let periodConsumedPower = consumedPower_s * (element.tariffChargingPeriod[1] - element.tariffChargingPeriod[0]) / 1000
                        price += this.getEnergyPrice(periodConsumedPower, element.component.price, element.component.step_size)
                        chargingPeriodsInfo.push({
                            quantity: periodConsumedPower,
                            cost: this.getEnergyPrice(periodConsumedPower, element.component.price, element.component.step_size),
                            component: element.component,
                            restrictions: element.restrictions
                        })
                    }

                })
            } else if (type === "TIME") {
                dimensionArray.forEach(element => {
                    element.component.step_size = element.component.step_size !== null && element.component.step_size !== undefined ? element.component.step_size : 1
                    let { priceRoundGranularity, priceRoundRule, stepRoundGranularity, stepRoundRule } = this.roundingsValidation(element.component)
                    element.component.price = Utils.roundingGranularityRules(priceRoundGranularity, priceRoundRule, element.component.price)
                    element.component.step_size = Utils.roundingGranularityRules(stepRoundGranularity, stepRoundRule, element.component.step_size)
                    price += this.getTimePrice(element.periodConsumedTime / 3600, element.component.price, element.component.step_size)
                    chargingPeriodsInfo.push({
                        quantity: element.periodConsumedTime / 3600,
                        cost: this.getTimePrice(element.periodConsumedTime / 3600, element.component.price, element.component.step_size),
                        component: element.component,
                        restrictions: element.restrictions
                    })

                })
            } else if (type === "PARKING_TIME") {
                dimensionArray.forEach(element => {
                    element.component.step_size = element.component.step_size !== null && element.component.step_size !== undefined ? element.component.step_size : 1
                    let { priceRoundGranularity, priceRoundRule, stepRoundGranularity, stepRoundRule } = this.roundingsValidation(element.component)
                    element.component.price = Utils.roundingGranularityRules(priceRoundGranularity, priceRoundRule, element.component.price)
                    element.component.step_size = Utils.roundingGranularityRules(stepRoundGranularity, stepRoundRule, element.component.step_size)
                    price += this.getTimePrice(element.periodConsumedParkingTime / 3600, element.component.price, element.component.step_size)
                    chargingPeriodsInfo.push({
                        quantity: element.periodConsumedParkingTime / 3600,
                        cost: this.getTimePrice(element.periodConsumedParkingTime / 3600, element.component.price, element.component.step_size),
                        component: element.component,
                        restrictions: element.restrictions
                    })

                })
            }
        }

        return [price, chargingPeriodsInfo]
    },
    getChargerOffset: function (timeZone, countryCode) {
        let offset = 0
        // IANA tzdata’s TZ-values representing the time zone of the location.
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

            var invoiceLines = [];

            let total_parking_time = (typeof cdr.total_parking_time !== "undefined" && cdr.total_parking_time !== null) ? cdr.total_parking_time : 0
            let totalTimeConsumed_h = cdr.total_time - total_parking_time
            var vat = await this.getVATwithViesVAT(chargingSession); //Iva

            // ========== CEME ==========
            let CEME_FLAT = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "flat")
            let CEME_POWER = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "energy")
            let CEME_TIME = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "time")
            let CEME_PERCENTAGE = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "percentage")

            let CEME_Price_FLAT = CEME_FLAT ? CEME_FLAT.price : 0
            let CEME_Price_POWER = CEME_POWER ? CEME_POWER.price : 0
            let CEME_Price_TIME = CEME_TIME ? CEME_TIME.price : 0
            let evioPercentage = CEME_PERCENTAGE ? CEME_PERCENTAGE.price : 0

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
            //We should also consider this value, right? 
            // if (chargingSession.paymentType == "AD_HOC" && chargingSession.paymentMethod == "card") {
            //     CEME_Price_FLAT += Number(process.env.AD_HOC_Activation_Fee_Card)
            // } else if (chargingSession.paymentType == "AD_HOC" && chargingSession.paymentMethod == "wallet") {
            //     CEME_Price_FLAT += Number(process.env.AD_HOC_Activation_Fee_Wallet);
            // } else {
            //     CEME_Price_FLAT += Number(process.env.AD_HOC_Activation_Fee_Wallet);
            // }

            // let OPC_Price = cdr.total_cost.excl_vat
            let OPC_Price = this.round(flat.price) + this.round(energy.price) + this.round(time.price) + this.round(parking.price)
            let CEME_Price = this.round(CEME_Price_FLAT) + this.round(CEME_Price_POWER * cdr.total_energy) + this.round(CEME_Price_TIME * totalTimeConsumed);
            let totalRoamingCost = this.round(OPC_Price) + this.round(CEME_Price) + this.round(evioPercentage * OPC_Price) + this.round(Number(process.env.GireveCommission))
            //eMSP

            var line1_roaming_services = {
                "code": global.Item_RoamingServices, "description": "Roaming Services", "unitPrice": this.round(totalRoamingCost), "uom": "UN", "quantity": 1, "vat": vat, "discount": 0, "total": 0
            }

            if (totalRoamingCost > 0 && minimumBillingConditions) {
                invoiceLines.push(line1_roaming_services);
            }

            // // CEME FLAT 
            // var line1_CEME_Roaming = {
            //     "code": global.Item_RoamingFlat, "description": "eMSP Flat Tariff", "unitPrice": CEME_Price_FLAT, "uom": "UN", "quantity": 1, "vat": vat, "discount": 0, "total": 0
            // }

            // // CEME ENERGY 
            // var line2_CEME_Roaming = {
            //     "code": global.Item_RoamingEnergy, "description": "eMSP Energy Tariff", "unitPrice": CEME_Price_POWER, "uom": "KWh", "quantity": cdr.total_energy, "vat": vat, "discount": 0, "total": 0
            // }

            // // CEME TIME 
            // var line3_CEME_Roaming = {
            //     "code": global.Item_RoamingTime, "description": "eMSP Time Tariff", "unitPrice": CEME_Price_TIME, "uom": CEME_TIME ? CEME_TIME.uom : "min", "quantity": totalTimeConsumed, "vat": vat, "discount": 0, "total": 0
            // }

            // if (CEME_Price_FLAT > 0) {
            //     invoiceLines.push(line1_CEME_Roaming);
            // }

            // if (CEME_Price_POWER > 0 && cdr.total_energy > 0) {
            //     invoiceLines.push(line2_CEME_Roaming);
            // }

            // if (CEME_Price_TIME > 0 && totalTimeConsumed > 0) {
            //     invoiceLines.push(line3_CEME_Roaming);
            // }


            // // ========== CPO ==========

            // // FLAT
            // var line4_OPC_FLAT = {
            //     "code": global.Item_OPC_FLAT, "description": "CPO flat tariff usage", "unitPrice": flat.price, "uom": "UN", "quantity": 1, "vat": vat, "discount": 0, "total": 0
            // }

            // if (flat.price > 0)
            //     invoiceLines.push(line4_OPC_FLAT);

            // // ENERGY 
            // energy.info.forEach(energyInfo => {
            //     let isEmpty = this.isEmptyObject(energyInfo)
            //     if (!isEmpty) {
            //         if (energyInfo.cost > 0) {
            //             let quantity = energyInfo.quantity
            //             let unitPrice = energyInfo.cost / quantity
            //             //TODO Can we have more than one invoice line with the same code?
            //             invoiceLines.push({
            //                 "code": global.Item_OPC_KWH, "description": "CPO energy tariff usage by KWh", "unitPrice": unitPrice, "uom": "KWh", "quantity": quantity, "vat": vat, "discount": 0, "total": 0
            //             })
            //         }
            //     }
            // })

            // // TIME
            // time.info.forEach(timeInfo => {
            //     let isEmpty = this.isEmptyObject(timeInfo)
            //     if (!isEmpty) {
            //         if (timeInfo.cost > 0) {
            //             let quantity = timeInfo.quantity * 60 // min
            //             let unitPrice = timeInfo.cost / quantity
            //             //TODO Can we have more than one invoice line with the same code?
            //             invoiceLines.push({
            //                 "code": global.Item_OPC_TIME, "description": "CPO time tariff usage by min", "unitPrice": unitPrice, "uom": "min", "quantity": quantity, "vat": vat, "discount": 0, "total": 0
            //             })
            //         }
            //     }
            // })

            // // PARKING 
            // parking.info.forEach(parkingInfo => {
            //     let isEmpty = this.isEmptyObject(parkingInfo)
            //     if (!isEmpty) {
            //         if (parkingInfo.cost > 0) {
            //             let quantity = parkingInfo.quantity * 60 // min
            //             let unitPrice = parkingInfo.cost / quantity
            //             //TODO Can we have more than one incoive line with the same code?
            //             invoiceLines.push({
            //                 "code": global.Item_OPC_PARKING_TIME, "description": "CPO parking tariff usage by min", "unitPrice": unitPrice, "uom": "min", "quantity": quantity, "vat": vat, "discount": 0, "total": 0
            //             })
            //         }
            //     }
            // })

            //TODO: Verify this!!!  This value is taken into account on ceme!!

            // var line8_OTHERS = {
            //     "code": global.Item_OTHERS, "description": "Tarifa de serviço EVIO", "unitPrice": 0.15, "uom": "UN", "quantity": 1, "vat": vat, "discount": 0, "total": 0
            // }

            // if (chargingSession.paymentType == "AD_HOC" && chargingSession.paymentMethod == "card")
            //     invoiceLines.push(line8_OTHERS);

            //console.log("invoiceLines", invoiceLines);
            resolve(invoiceLines);

        });
    },
    processBillingAndPaymentRoaming: function (sessionId, cdr) {
        let query = { id: sessionId };

        var totalPowerConsumed_Kw = cdr.total_energy;
        let total_parking_time = (typeof cdr.total_parking_time !== "undefined" && cdr.total_parking_time !== null) ? cdr.total_parking_time : 0
        let totalTimeConsumed_h = cdr.total_time - total_parking_time
        this.chargingSessionFindOne(query).then(async (chargingSession) => {

            if (chargingSession) {

                try {

                    var VAT_Price = await this.getVATwithViesVAT(chargingSession); //Iva

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

                    // if (cdr.tariffs !== null && cdr.tariffs !== undefined && cdr.tariffs.length > 0) {
                    //     priceComponents = this.transformTariffElements(cdr.tariffs[0].elements)
                    //     priceComponents = this.createTariffElementsAccordingToRestriction(priceComponents, cdr.start_date_time, cdr.end_date_time)
                    // } else if (priceComponents !== null && priceComponents !== undefined) {
                    //     priceComponents = this.createTariffElementsAccordingToRestriction(priceComponents, cdr.start_date_time, cdr.end_date_time)
                    // }




                    /*
                        This function calculates the final prices for each dimension. If eventually there's a wrong price, the testTariffs file should be used to test new changes
                        and add more use cases if necessary.

                        Update - > This function also returns a key of information about each dimension. That info contains the amount consumed in each charging period and 
                                    other details about the tariff and its restrictions

                    */
                    let [flat, energy, time, parking] = this.opcTariffsPrices(null, priceComponents, cdr.start_date_time, cdr.end_date_time, offset, plugPower, plugVoltage, totalPowerConsumed_Kw, totalTimeConsumed_h, total_parking_time)

                    let [
                        OCP_PRICE_FLAT,
                        OCP_PRICE_ENERGY,
                        OCP_PRICE_TIME,
                        OCP_PRICE_PARKING_TIME
                    ] = [flat.price, energy.price, time.price, parking.price]

                    let OPC_Price = this.round(OCP_PRICE_FLAT) + this.round(OCP_PRICE_ENERGY) + this.round(OCP_PRICE_TIME) + this.round(OCP_PRICE_PARKING_TIME)
                    // let OPC_Price = cdr.total_cost.excl_vat

                    let opcPrice = { excl_vat: this.round(OPC_Price), incl_vat: this.round(OPC_Price + (VAT_Price * OPC_Price)) }
                    let opcFlat = OCP_PRICE_FLAT
                    let opcTime = OCP_PRICE_TIME
                    let opcPower = OCP_PRICE_ENERGY
                    let opcParkingTime = OCP_PRICE_PARKING_TIME

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

                    let CEME_Price_FLAT = CEME_FLAT ? CEME_FLAT.price : 0
                    let CEME_Price_POWER = CEME_POWER ? CEME_POWER.price : 0
                    let CEME_Price_TIME = CEME_TIME ? CEME_TIME.price : 0
                    let evioPercentage = CEME_PERCENTAGE ? CEME_PERCENTAGE.price : 0

                    let totalTimeConsumed = totalTimeConsumed_h
                    if (CEME_TIME && CEME_TIME.uom.includes('min')) {
                        totalTimeConsumed = totalTimeConsumed_h * 60
                    } else if (CEME_TIME && CEME_TIME.uom.includes('s')) {
                        totalTimeConsumed = totalTimeConsumed_h * 3600
                    }

                    //TODO: We should also consider this value, right? 
                    ////////////////////////////////////////////////
                    //Other Prices, 0.15€ activation fee
                    let gireve_activationFee = Number(process.env.GireveCommission)
                    let evioPercentageValue = evioPercentage * OPC_Price
                    // if (chargingSession.paymentType == "AD_HOC" && chargingSession.paymentMethod == "card") {
                    //     CEME_Price_FLAT += Number(process.env.AD_HOC_Activation_Fee_Card)
                    //     Ad_Hoc_activationFee = Number(process.env.AD_HOC_Activation_Fee_Card);
                    // } else if (chargingSession.paymentType == "AD_HOC" && chargingSession.paymentMethod == "wallet") {
                    //     CEME_Price_FLAT += Number(process.env.AD_HOC_Activation_Fee_Wallet);
                    //     Ad_Hoc_activationFee = Number(process.env.AD_HOC_Activation_Fee_Wallet);
                    // } else {
                    //     CEME_Price_FLAT += Number(process.env.AD_HOC_Activation_Fee_Wallet);
                    //     Ad_Hoc_activationFee = Number(process.env.AD_HOC_Activation_Fee_Wallet);
                    // }

                    let CEME_Price = this.round(CEME_Price_FLAT) + this.round(CEME_Price_POWER * totalPowerConsumed_Kw) + this.round(CEME_Price_TIME * totalTimeConsumed);

                    let cemePrice = { excl_vat: this.round(CEME_Price), incl_vat: this.round(CEME_Price + (VAT_Price * CEME_Price)) }

                    let cemePriceDetail = {
                        flatPrice: { excl_vat: this.round(CEME_Price_FLAT), incl_vat: this.round(CEME_Price_FLAT + (CEME_Price_FLAT * VAT_Price)) },
                        timePrice: { excl_vat: this.round(CEME_Price_TIME * totalTimeConsumed), incl_vat: this.round(CEME_Price_TIME * totalTimeConsumed + (CEME_Price_TIME * totalTimeConsumed * VAT_Price)) },
                        powerPrice: { excl_vat: this.round(CEME_Price_POWER * totalPowerConsumed_Kw), incl_vat: this.round(CEME_Price_POWER * totalPowerConsumed_Kw + (CEME_Price_POWER * totalPowerConsumed_Kw * VAT_Price)) },
                    }

                    var otherPrices = [
                        { description: `Gireve Activation Fee ${gireve_activationFee}`, price: { excl_vat: this.round(gireve_activationFee), incl_vat: this.round(gireve_activationFee + (VAT_Price * gireve_activationFee)) } },
                        { description: `EVIO Percentage ${evioPercentage * 100}%`, price: { excl_vat: this.round(evioPercentageValue), incl_vat: this.round(evioPercentageValue + (VAT_Price * evioPercentageValue)) } },
                    ]


                    ////////////////////////////////////////////////
                    //Total Prices 

                    var invoiceLines = await this.getInvoiceLinesRoaming(cdr, chargingSession.userIdWillPay, chargingSession, flat, energy, time, parking);
                    var total_exc_vat = 0;
                    var total_inc_vat = 0;
                    invoiceLines.forEach(line => {
                        total_exc_vat += (line.quantity * line.unitPrice);
                    });
                    total_inc_vat = total_exc_vat + (total_exc_vat * VAT_Price);
                    var totalPrice = { excl_vat: this.round(total_exc_vat), incl_vat: this.round(total_inc_vat) };

                    var vatPrice = { vat: VAT_Price, value: this.round(total_inc_vat - total_exc_vat) }

                    var finalPrices = {
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

                    var timeChargedinSeconds = Utils.getChargingTime(moment(cdr.start_date_time), moment(cdr.end_date_time));

                    var CO2emitted = 0;

                    var totalPowerConsumed_W = 0;
                    if (totalPowerConsumed_Kw >= 0) {
                        totalPowerConsumed_W = totalPowerConsumed_Kw * 1000;
                        CO2emitted = this.round(Number(process.env.CarbonIntensity) * totalPowerConsumed_Kw);// Kg CO₂ eq/kWh
                        if (CO2emitted < 0)
                            CO2emitted = 0
                    }

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
                        status: global.SessionStatusStopped
                    };

                    let minimumBillingConditions = true
                    if (
                        // (timeChargedinSeconds <= Number(process.env.MinimumChargingTimeToBilling)) ||
                        (totalPowerConsumed_W <= Number(process.env.MinimumEnergyToBillingGireve))
                    ) {
                        minimumBillingConditions = false
                    }
                    bodySession.minimumBillingConditions = minimumBillingConditions


                    if (chargingSession.paymentType == "AD_HOC") {
                        //Billing

                        //Call Payments Microservice
                        var bodyPayment = {
                            amount: { currency: cdr.currency, value: minimumBillingConditions ? totalPrice.incl_vat : 0 },
                            userId: chargingSession.userIdWillPay,
                            sessionId: chargingSession._id,
                            listOfSessions: [],
                            hwId: chargingSession.location_id,
                            chargerType: chargingSession.chargerType,
                            paymentMethod: chargingSession.paymentMethod,
                            paymentMethodId: chargingSession.paymentMethodId,
                            transactionId: chargingSession.transactionId,
                            adyenReference: chargingSession.adyenReference,
                            reservedAmount: chargingSession.reservedAmount
                        }

                        this.makePayment(bodyPayment).then((result) => {

                            //If success (40) - Save paymentId and transactionId and change status to PAID 
                            //If success (10/20) - Save paymentId and transactionId  
                            bodySession.paymentId = result._id;
                            bodySession.transactionId = result.transactionId;

                            //console.log("result payment", result);
                            if (result.status == "40") {
                                bodySession.paymentStatus = 'PAID';
                                bodySession.paymentSubStatus = "PAID AND CLOSED";

                                if (minimumBillingConditions) {
                                    Utils.billingRoaming(cdr, chargingSession.userIdWillPay, chargingSession, result._id, invoiceLines, totalPrice, flat, energy, time, parking).then((res) => {
                                        bodySession.invoiceStatus = true;
                                        bodySession.invoiceId = res.invoiceId;
                                        this.updateSession(sessionId, bodySession);
                                    }).catch((err) => {
                                        if (err?.response?.data) {
                                            bodySession.invoiceSubStatus = JSON.stringify(err?.response?.data)
                                        } else {
                                            bodySession.invoiceSubStatus = err?.message
                                        }
                                        this.updateSession(sessionId, bodySession);
                                    });
                                } else {
                                    console.log("No minimum billing conditions were found")
                                    this.updateSession(sessionId, bodySession);
                                }
                            }
                            else if (result.status == "10" || result.status == "20") {
                                bodySession.paymentSubStatus = "PAID AND WAITING FOR ADYEN NOTIFICATION";
                                this.updateSession(sessionId, bodySession);
                            }
                            else {
                                bodySession.paymentSubStatus = "PAYMENT FAILED FOR ANY REASON";
                                this.updateSession(sessionId, bodySession);
                            }

                        }).catch((err) => {
                            console.log("Error calling payment microservice: ", err?.message)
                            bodySession.paymentSubStatus = "PAYMENT FAILED FOR ANY REASON - " + err?.message;
                            this.updateSession(sessionId, bodySession);
                        });


                    }
                    else {
                        //Monthly Billing
                        this.updateSession(sessionId, bodySession);
                    }

                }
                catch (err) {
                    console.log("Billing CDR - err", err)
                    this.updateSession(sessionId, { status: global.SessionStatusStopped });
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
            var body = await this.drawSingle_Ad_HocInvoiceRoaming(cdr, userId, chargingSession, paymentId, invoiceLines, totalPrice, flat, energy, time, parking);

            axios.post(global.billingRoamingEndpoint, body, { headers: { 'userid': userId } }).then(function (response) {

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

            var footer = {
                total_exc_vat: totalPrice.excl_vat,
                total_inc_vat: totalPrice.incl_vat
            }

            var others = 0;
            var activationFee = 0;
            // if (chargingSession.paymentType == "AD_HOC" && chargingSession.paymentMethod == "card") {
            //     activationFee = Number(process.env.AD_HOC_Activation_Fee_Card);
            // } else if (chargingSession.paymentType == "AD_HOC" && chargingSession.paymentMethod == "wallet") {
            //     activationFee = Number(process.env.AD_HOC_Activation_Fee_Wallet);
            // } else {
            //     activationFee = Number(process.env.AD_HOC_Activation_Fee_Wallet);
            // }

            // others += activationFee;
            let CEME_PERCENTAGE = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "percentage")
            let evioPercentage = CEME_PERCENTAGE ? CEME_PERCENTAGE.price : 0

            let opcDetail = chargingSession.finalPrices.opcPriceDetail
            let cemeDetail = chargingSession.finalPrices.cemePriceDetail
            let gireveActivationFee = Number(process.env.GireveCommission)

            let timeCost = this.round(opcDetail.timePrice.excl_vat) + this.round(cemeDetail.timePrice.excl_vat) + this.round((opcDetail.timePrice.excl_vat) * evioPercentage)
            let energyCost = this.round(opcDetail.powerPrice.excl_vat) + this.round(cemeDetail.powerPrice.excl_vat) + this.round((opcDetail.powerPrice.excl_vat) * evioPercentage)
            let flatCost = this.round(opcDetail.flatPrice.excl_vat) + this.round(cemeDetail.flatPrice.excl_vat) + this.round((opcDetail.flatPrice.excl_vat) * evioPercentage) + this.round(gireveActivationFee)

            var VAT_Price = await this.getVATwithViesVAT(chargingSession); //Iva
            let city = jsonCountryNames[chargingSession.country_code]
            if (chargingSession.address) {
                if (chargingSession.address.city !== null && chargingSession.address.city !== undefined) {
                    city = chargingSession.address.city
                }
            }
            
            chargingSession.start_date_time = new Date(chargingSession.local_start_date_time ?? chargingSession.start_date_time).toISOString() 

            var attachLine = {
                "date": moment(chargingSession.start_date_time).format("DD/MM/YYYY"),
                "startTime": moment(chargingSession.start_date_time).format("HH:mm"),
                "duration": new Date(chargingSession.timeCharged * 1000).toISOString().substr(11, 8),
                // "country": jsonCountryNames[chargingSession.country_code],
                "country": city,
                "hwId": chargingSession.location_id,
                "partyId": chargingSession.party_id,
                "totalPower": chargingSession.kwh,
                "timeCost": this.round(timeCost),
                "energyCost": this.round(energyCost),
                "flatCost": this.round(flatCost),
                "total_exc_vat": totalPrice.excl_vat
            }
            var body = {
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
                            evio_services: { total_exc_vat: others, vat: this.round(VAT_Price * others) },
                            evio_network: { total_exc_vat: 0, vat: 0 },
                            mobie_network: { total_exc_vat: 0, vat: 0 },
                            other_networks: { total_exc_vat: this.round(totalPrice.excl_vat - others), vat: this.round(VAT_Price * (totalPrice.excl_vat - others)) },
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
                                address: chargingSession.address.street
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
        return new Promise(async (resolve, reject) => {
            //Obter inicio de sessão de carregamento à sessão de carregamento
            var end_date_time = new Date().toISOString();
            var startDate = chargingSession.start_date_time;
            var endDate_moment = moment(end_date_time).utc();

            //VAT
            var VAT_Price = await this.getVATwithViesVAT(chargingSession); //Iva

            //Calcular tempo total de carregamento
            var timeChargedinSeconds = Utils.getChargingTime(startDate, endDate_moment);

            //Obter energia total consumida ao payload do request
            var totalPowerConsumed_Kw = -1;
            var totalPowerConsumed_W = 0;
            var instantPower = -1;
            var instantVoltage = -1;
            var instantAmperage = -1;
            var evBattery = -1;
            var CO2emitted = 0;

            if (chargingSession.kwh >= 0) {
                totalPowerConsumed_Kw = chargingSession.kwh;
                totalPowerConsumed_W = totalPowerConsumed_Kw * 1000;
                CO2emitted = Number(process.env.CarbonIntensity) * totalPowerConsumed_Kw;// Kg CO₂ eq/kWh
                if (CO2emitted < 0)
                    CO2emitted = 0
            }

            var readingPoints = [{
                totalPower: totalPowerConsumed_W,
                instantPower: instantPower,
                instantVoltage: instantVoltage,
                batteryCharged: evBattery,
                instantAmperage: instantAmperage
            }]

            //Calcular estimativa de custo
            var estimatedPrice_excl_Vat = -1;
            var estimatedPrice_incl_Vat = -1;
            var priceComponents = chargingSession.tariffOPC.elements;
            // if (priceComponents !== null && priceComponents !== undefined) {
            //     priceComponents = this.createTariffElementsAccordingToRestriction(priceComponents, startDate, endDate_moment.format())
            // }
            let charging_periods

            //Calculate OPC Prices
            var aux_totalPowerConsumed_Kw = 0;
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

            let [flat, energy, time, parking] = this.opcTariffsPrices(null, priceComponents, startDate, endDate_moment.format(), offset, plugPower, plugVoltage, aux_totalPowerConsumed_Kw, timeChargedinSeconds / 3600, 0)

            let [
                OCP_PRICE_FLAT,
                OCP_PRICE_ENERGY,
                OCP_PRICE_TIME,
                OCP_PRICE_PARKING_TIME
            ] = [flat.price, energy.price, time.price, parking.price]

            let OPC_Price = this.round(OCP_PRICE_FLAT) + this.round(OCP_PRICE_ENERGY) + this.round(OCP_PRICE_TIME) + this.round(OCP_PRICE_PARKING_TIME)

            var opcPrice = { excl_vat: this.round(OPC_Price), incl_vat: this.round(OPC_Price + (VAT_Price * OPC_Price)) }

            var opcPriceDetail = {
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

            let CEME_Price_FLAT = CEME_FLAT ? CEME_FLAT.price : 0
            let CEME_Price_POWER = CEME_POWER ? CEME_POWER.price : 0
            let CEME_Price_TIME = CEME_TIME ? CEME_TIME.price : 0
            let evioPercentage = CEME_PERCENTAGE ? CEME_PERCENTAGE.price : 0

            let totalTimeConsumed = timeChargedinSeconds
            if (CEME_TIME && CEME_TIME.uom.includes('min')) {
                totalTimeConsumed = timeChargedinSeconds / 60
            } else if (CEME_TIME && CEME_TIME.uom.includes('h')) {
                totalTimeConsumed = timeChargedinSeconds / 3600
            }

            //We should also consider this value, right? 
            ////////////////////////////////////////////////
            //Other Prices, 0.15€ activation fee
            let gireve_activationFee = Number(process.env.GireveCommission)
            let evioPercentageValue = evioPercentage * OPC_Price
            // if (chargingSession.paymentType == "AD_HOC" && chargingSession.paymentMethod == "card") {
            //     CEME_Price_FLAT += Number(process.env.AD_HOC_Activation_Fee_Card)
            //     Ad_Hoc_activationFee = Number(process.env.AD_HOC_Activation_Fee_Card);
            // } else if (chargingSession.paymentType == "AD_HOC" && chargingSession.paymentMethod == "wallet") {
            //     CEME_Price_FLAT += Number(process.env.AD_HOC_Activation_Fee_Wallet);
            //     Ad_Hoc_activationFee = Number(process.env.AD_HOC_Activation_Fee_Wallet);
            // } else {
            //     CEME_Price_FLAT += Number(process.env.AD_HOC_Activation_Fee_Wallet);
            //     Ad_Hoc_activationFee = Number(process.env.AD_HOC_Activation_Fee_Wallet);
            // }

            let CEME_Price = this.round(CEME_Price_FLAT) + this.round(CEME_Price_POWER * totalPowerConsumed_Kw) + this.round(CEME_Price_TIME * totalTimeConsumed);

            let cemePrice = { excl_vat: this.round(CEME_Price), incl_vat: this.round(CEME_Price + (VAT_Price * CEME_Price)) }

            let cemePriceDetail = {
                flatPrice: { excl_vat: this.round(CEME_Price_FLAT), incl_vat: this.round(CEME_Price_FLAT + (CEME_Price_FLAT * VAT_Price)) },
                timePrice: { excl_vat: this.round(CEME_Price_TIME * totalTimeConsumed), incl_vat: this.round(CEME_Price_TIME * totalTimeConsumed + (CEME_Price_TIME * totalTimeConsumed * VAT_Price)) },
                powerPrice: { excl_vat: this.round(CEME_Price_POWER * totalPowerConsumed_Kw), incl_vat: this.round(CEME_Price_POWER * totalPowerConsumed_Kw + (CEME_Price_POWER * totalPowerConsumed_Kw * VAT_Price)) },
            }

            var otherPrices = [
                { description: `Gireve Activation Fee ${gireve_activationFee}`, price: { excl_vat: this.round(gireve_activationFee), incl_vat: this.round(gireve_activationFee + (VAT_Price * gireve_activationFee)) } },
                { description: `EVIO Percentage ${evioPercentage * 100}%`, price: { excl_vat: this.round(evioPercentageValue), incl_vat: this.round(evioPercentageValue + (VAT_Price * evioPercentageValue)) } },
            ]
            //////////////////////////////////// CEME /////////////////////////////////////////


            estimatedPrice_excl_Vat = this.round(opcPrice.excl_vat) + this.round(cemePrice.excl_vat) + this.round(evioPercentage * opcPrice.excl_vat) + this.round(Number(process.env.GireveCommission))
            estimatedPrice_incl_Vat = this.round(estimatedPrice_excl_Vat + (VAT_Price * estimatedPrice_excl_Vat));

            var totalCost = { excl_vat: this.round(estimatedPrice_excl_Vat), incl_vat: this.round(estimatedPrice_incl_Vat) }

            var vatPrice = { vat: this.round(VAT_Price), value: this.round((estimatedPrice_incl_Vat - estimatedPrice_excl_Vat)) }
            var finalPrices = {
                opcPrice: opcPrice,
                opcPriceDetail: opcPriceDetail,
                cemePrice: cemePrice,
                cemePriceDetail: cemePriceDetail,
                vatPrice: vatPrice,
                othersPrice: otherPrices,
                totalPrice: totalCost
            }



            var query = { _id: chargingSession._id };
            var newValues = {
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

            Session.updateSession(query, newValues, (err, result) => {
                if (err) {
                    console.error(`[update Session OCPI] Error `, err);
                    resolve(err);
                }
                else {
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
            default:
                return process.env.chargerTypeMobie
        }

    },
    callStartJobs: function () {
        var context = "Utils callStartJobs function"
        return new Promise(async (resolve, reject) => {
            Platforms.find({}, (err, platformArray) => {
                if (err) {
                    console.error(`[find] Error `, err);
                    resolve(null);
                }
                else {
                    console.log("[!] CallStartJobs function started")
                    /*
                        I found this approach better than writing the same code in each one of the folders. 
                        We call the endpoints in this server directly here.
                    */
                    if (platformArray.length > 0) {
                        let headers = {
                            apikey: process.env.ocpiApiKey
                        }
                        // ============== Run startJob commands (It's the same for any platform) ================
                        let commandresultJobHost = global.ocpiHost + `/ocpi/2.2/sender/MobiE/job/commandresult/startJob`
                        axios.post(commandresultJobHost, { timer: "* * * * *" }, { headers })

                        for (let platform of platformArray) {
                            if (platform.active) {
                                //TODO Always getting the first version, for now it's ok
                                let platformVersion = platform.evioActiveCredentialsToken[0].version
                                let platformCode = platform.platformCode

                                // ============== Run startJob locations ===============
                                let locationsJobHost = global.ocpiHost + `/ocpi/${platformVersion}/sender/${platformCode}/job/locations/startJob`
                                axios.post(locationsJobHost, {}, { headers })


                                // ============== Run startJob sessions ================
                                let sessionsJobHost = global.ocpiHost + `/ocpi/${platformVersion}/sender/${platformCode}/job/sessions/startJob`
                                axios.post(sessionsJobHost, {}, { headers })


                                // ============== Run startJob tariffs =================
                                let tariffsJobHost = global.ocpiHost + `/ocpi/${platformVersion}/sender/${platformCode}/job/tariffs/startJob`
                                axios.post(tariffsJobHost, {}, { headers })

                                // ============== Run startJob cdrs ====================
                                let cdrJobHost = global.ocpiHost + `/ocpi/${platformVersion}/sender/${platformCode}/job/cdrs/startJob`
                                axios.post(cdrJobHost, {}, { headers })

                                if (platform.platformCode === global.mobiePlatformCode) {

                                    // ============== Run startJob SFTP cdrs ===============
                                    let sftpCdrJobHost = global.ocpiHost + `/ocpi/${platformVersion}/sender/${platformCode}/job/cdrs/startJobSftp`
                                    axios.post(sftpCdrJobHost, {}, { headers })

                                    // ============== Run expiredSessions job  ================
                                    let expiredSessionsJobHost = global.ocpiHost + `/ocpi/${platformVersion}/sender/${platformCode}/job/sessions/expiredSessionsStartJob`
                                    axios.post(expiredSessionsJobHost, {}, { headers })

                                }
                            }
                        }
                    }
                    resolve()
                };
            });
        });
    },
    getVATwithViesVAT: async function (chargingSession) {
        try {
            if (chargingSession.country_code === "PT") {
                return chargingSession.fees.IVA
            } else {
                let userId = chargingSession.userIdWillPay
                let userInfo = await this.getUserInfo(userId)
                if (userInfo) {
                    if (userInfo.country.toUpperCase() === "PT" || userInfo.country.toUpperCase() === "PORTUGAL") {
                        //TODO This VAT value should be the portuguese or the VAT of the corresponding country where the charging station is located?
                        return chargingSession.fees.IVA
                    } else {
                        return chargingSession.viesVAT ? 0 : chargingSession.fees.IVA
                    }

                } else {
                    // Default VAT value when user not found
                    return chargingSession.fees.IVA
                }
            }
        } catch (error) {
            return chargingSession.fees.IVA
        }

    },
    getUserInfo: function (userId) {
        return new Promise(async (resolve, reject) => {

            const params = {
                _id: userId,
            }
            let host = process.env.HostUser + process.env.PathGetUserById
            axios.get(host, { params })
                .then(function (response) {

                    var obj = response.data;

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
            axios.post(global.publicNetworkUpdateOrCreateChargersProxy, { chargers: chargerInfo })
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
        elements = Utils.separateWeekDaysRestriction(elements, sessionStartDate, daysDiff)
        let elementIndex = 0
        for (let tariffElement of elements) {
            let restrictions = tariffElement.restrictions
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
                    for (let pushIndex = 0; pushIndex < addElements; pushIndex++) {
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
                            elements.splice(elementIndex, 1, newElement)
                        }

                        let currentDay = moment.utc(firstDate, 'YYYY-MM-DD').add(24 * pushIndex, 'hours').format()
                        let nextDay = moment.utc(currentDay).add(24, 'hours').format()
                        let newElement = {
                            restrictions: {
                                ...restrictions,
                                "start_date": moment.utc(currentDay).format("YYYY-MM-DD"),
                                "end_date": moment.utc(nextDay).format("YYYY-MM-DD"),
                            },
                            price_components: elements[elementIndex].price_components
                        }
                        elements.splice(elementIndex + pushIndex + 1, 0, newElement)

                    }
                }
            }
            elementIndex++
        }

        return elements
    }, separateWeekDaysRestriction: function (elements, sessionStartDate, daysDiff) {
        daysDiff = daysDiff === 0 ? 1 : daysDiff
        let weeks = Math.ceil(daysDiff / 7) + 1
        let elementIndex = 0
        for (let tariffElement of elements) {
            let restrictions = tariffElement.restrictions
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
            "ROUND_UP": (num, decimals) => Math.ceil(num * decimals) / decimals,
            "ROUND_DOWN": (num, decimals) => Math.floor(num * decimals) / decimals,
            "ROUND_NEAR": (num, decimals) => Math.round(num * decimals) / decimals,
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
            // if (cdr.total_time * 60 < Number(process.env.MinimumChargingTimeToBilling) / 60) {
            //     if (cdr.total_energy <= 0) {
            //         return false
            //     }
            // }
            return true
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return true
        }
    },
    getChargerWithEVSE: function (hwId, evse_uid) {
        return new Promise(async (resolve, reject) => {
            var chargersEndpoint = global.publicNetworkChargersProxy + "/" + hwId;
            axios.get(chargersEndpoint, {}, {}).then(function (response) {

                if (typeof response.data !== 'undefined' && response.data !== '') {

                    var charger = response.data;
                    // console.log(JSON.stringify(charger));
                    var plugs = charger.plugs;
                    var plug = _.where(plugs, { uid: evse_uid });
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
        var context = "Function getRoamingPlanTariff";
        return new Promise((resolve, reject) => {
            try {
                var serviceProxy = process.env.HostPublicTariffs + process.env.PathGetRoamingPlanTariff;

                axios.get(serviceProxy, { params })
                    .then((result) => {

                        resolve(result.data);

                    })
                    .catch((error) => {
                        console.error(`[${context}] Error `, error.message);
                        resolve({});
                    });
            } catch (error) {
                console.error(`[${context}] Error `, error.message);
                resolve({});
            };
        });
    },
    createTariffOPCWithRoamingPlan: function (roamingPlan) {
        var context = "Function createTariffOPCWithRoamingPlan";
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
            console.error(`[${context}] Error `, error.message);
            return {}
        }

    },
    getEVSEGroup: function (uid) {
        var context = "Function getEVSEGroup";
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
                    console.error(`[${context}] Error `, error.message);
                    resolve("");
                });
        });
    },
    buildGireveServiceCost: function (power, countryCode, partyId, evseGroup) {
        var context = "Function buildGireveServiceCost";
        return new Promise(async (resolve, reject) => {
            try {
                var total_charging_time = 0.5; //Time in hours
                let sessionStartDate = moment.utc().format()
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

                let [flat, energy, time, parking] = this.opcTariffsPrices(null, opcElements, sessionStartDate, sessionStopDate, 0, power, null, total_energy, total_charging_time, total_parking_time)

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
                // let total_incl_vat = this.round(total_exc_vat) + this.round(total_exc_vat * fees.IVA)
                // let total_cost = {
                //     excl_vat : this.round(total_exc_vat),
                //     incl_vat : total_incl_vat
                // }

                // let vat = {
                //     value : this.round(total_exc_vat * fees.IVA),
                //     percentage : fees.IVA * 100
                // }
                // resolve({ flat , energy , time , parking , vat , total_cost , currency}) 
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
                console.error(`[${context}] Error `, error.message);
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
        var context = "Function getTariffCEMEbyId";
        return new Promise(async (resolve, reject) => {
            var host = process.env.HostTariffCEME + process.env.PathTariffCEME;
            axios.get(host, { params })
                .then((result) => {
                    resolve(result.data.plan);
                })
                .catch((error) => {
                    console.error(`[${context}] Error `, error.message);
                    reject(error);
                });
        });
    },
    getTariffCEMEbyName: function (params) {
        var context = "Function getTariffCEMEbyName";
        return new Promise(async (resolve, reject) => {
            var host = process.env.HostTariffCEME + process.env.PathTariffCEMEbyName;
            axios.get(host, { params })
                .then((result) => {
                    resolve(result.data[0]);
                })
                .catch((error) => {
                    console.error(`[${context}] Error `, error.message);
                    reject(error);
                });
        });
    },
    getTariffCEMEWithProject: function (params) {
        var context = "Function getTariffCEMEWithProject";
        return new Promise(async (resolve, reject) => {
            var host = process.env.HostTariffCEME + process.env.PathTariffCEMEWithProject;
            axios.get(host, { params })
                .then((result) => {
                    resolve(result.data);
                })
                .catch((error) => {
                    console.error(`[${context}] Error `, error.message);
                    reject(error);
                });
        });
    },
    getTariffCEMERoaming: function (tariffRoaming, source) {
        var context = "Function getTariffCEMERoaming";
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

                        console.error(`[${context}][.catch] Error `, error.message);
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

                        console.error(`[${context}][.catch] Error `, error.message);
                        resolve([]);

                    });
            }
        });
    },
    isAuthenticated: function (req, res, next) {
        let context = 'Function isAuthenticated';
        try {
            if (Utils.endpointWithoutAuthentication(req)) {
                next();
            }
            else {
                // First request to authorization service to check if tokens are valid
                let token = req.headers['token'];
                let refreshtoken = req.headers['refreshtoken'];

                if (token && refreshtoken) {
                    const headers = {
                        'token': token,
                        'refreshtoken': refreshtoken,
                        'apikey': req.headers.apikey,
                    };
                    validTokens.checkAuthentication(headers)
                        .then(function (response) {
                            Utils.verifyValidUserId(response.id)
                                .then((result) => {
                                    if (result) {
                                        if (result.auth) {
                                            req.headers['userid'] = response.id;//in headers we can't use camelcase, always lowercase
                                            req.headers['clienttype'] = result.clientType;
                                            req.headers['isadmin'] = Utils.isAdmin(result.clientType)
                                            next();
                                        } else {
                                            res.status(400).send(result);
                                        }
                                    }
                                    else {
                                        res.status(400).send({ auth: false, code: 'server_user_not_valid', message: "User is not valid" });
                                    }
                                })
                                .catch(function (error) {
                                    if (error.response) {

                                        res.status(400).send(error.response.data);

                                    } else if (error.auth === false) {

                                        res.status(400).send(error);

                                    } else {

                                        console.log(`[${context}][verifyValidUserId] Error `, error.message);
                                        res.status(500).send({ auth: false, message: error.message });
                                    }
                                });

                        })
                        .catch(function (error) {
                            console.log("error.response.data", error.message)
                            if (error.response != undefined) {
                                res.status(error.response.status).send(error.response.data);
                            }
                            else {
                                console.error(`[${context}][validTokens.checkAuthentication] Error`, error.message);
                                if (error.message.includes('User is not valid')) {
                                    res.status(400).send({ auth: false, code: 'server_user_not_valid', message: error.message });
                                } else {
                                    res.status(500).send({ auth: false, message: error.message });
                                }
                            };
                        });
                }
                else {
                    res.status(401).send({ auth: false, code: 'server_tokens_provided', message: "Tokens must be provided" });
                };
            };
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            return res.status(500).send(error.message);
        };
    },
    verifyValidUserId: async function (userId) {
        const context = 'Function verifyValidUserId';
        try {
            let userFound = await User.findOne({ _id: userId }).lean()
            if (userFound) {
                if (userFound.active) {
                    if (userFound.blocked) {
                        return { auth: false, code: 'server_user_not_valid', message: 'User blocked!' }
                    } else {
                        return { auth: true, code: '', message: '', clientType: userFound.clientType }
                    }
                } else {
                    if (userFound.changedEmail) {
                        return { auth: false, code: 'server_user_not_active', message: "Activate your account using the activation code.", changedEmail: true }
                    } else {
                        return { auth: false, code: 'server_user_not_valid', message: "User is not valid" }
                    }
                }
            } else {
                return { auth: false, code: 'server_user_not_valid', message: "User is not valid" }
            }
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            return { auth: false, code: '', message: error.message }
        }

    },
    endpointWithoutAuthentication: function (req) {
        const context = 'Function endpointWithoutAuthentication';
        try {
            let endpoints = {
                "POST": [
                    '/api/private/controlcenter/login',
                    '/api/private/controlcenter/logout',
                    '/api/private/controlcenter/users',
                    '/api/private/controlcenter/recoverPassword',
                ],
                "PUT": [
                    '/api/private/controlcenter/recoverPassword',
                ],
                "GET": [],
                "PATCH": [],
                "DELETE": [],
            }
            return endpoints[req.method].find(path => req.originalUrl.includes(path))
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            return false
        }
    },
    isAdmin: function (clientType) {
        let context = 'Function isAdmin';
        try {
            return clientType === process.env.ClientTypeAdmin
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            return false
        };
    },
    defaultCpoDetails: function () {
        return [
            {
                party_id: "",
                name: process.env.MobiePlatformCode,
                networkName: "server_mobie_network",
                network: process.env.MobiePlatformCode,
                certified: false,
                status: "",
                handshake: false
            },
            {
                party_id: "",
                name: "server_international_network_1",
                networkName: "server_international_network_1",
                network: process.env.GirevePlatformCode,
                certified: false,
                status: "",
                handshake: false
            }
        ]
    },
    findUserById: async function (userId) {
        const context = 'Function findUser';
        try {
            return await User.findOne({ _id: userId }).lean()
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            return false
        }

    },
    findChargerById: function (chargerId) {
        return new Promise(async (resolve, reject) => {
            const params = {
                _id: chargerId,
            }
            let host = process.env.HostChargers + process.env.PathGetChargerById
            axios.get(host, { params })
                .then(function (response) {

                    var obj = response.data;

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
    transformLocationObject: async function (network, charger, country_code, partyId, platform, active, evseStatus = "") {
        if (network === process.env.MobiePlatformCode) {
            let locationId = charger.networks.find(networkObj => networkObj.network === network).id
            if (locationId) {
                return Utils.evioToOCPI22Model(charger, network, country_code, partyId, platform, locationId, active, evseStatus)
            } else {
                let location = Utils.evioToOCPI22Model(charger, network, country_code, partyId, platform, null, active, evseStatus)
                locationId = await Utils.getLocationIdMobiE(platform, location, charger)
                return Utils.evioToOCPI22Model(charger, network, country_code, partyId, platform, locationId, active, evseStatus)
            }
        } else if (network === process.env.GirevePlatformCode) {
            let locationId = charger.networks.find(networkObj => networkObj.network === network).id
            if (locationId) {
                return Utils.evioToOCPI211Model(charger, network, country_code, partyId, platform, locationId, active, evseStatus)
            } else {
                let location = Utils.evioToOCPI211Model(charger, network, country_code, partyId, platform, null, active, evseStatus)
                locationId = await Utils.getLocationIdMobiE(platform, location, charger)
                return Utils.evioToOCPI211Model(charger, network, country_code, partyId, platform, locationId, active, evseStatus)
            }
        } else {
            return {}
        }
    },
    evioToOCPI22Model: function (charger, network, country_code, partyId, platform, locationId, active, evseStatus) {
        const context = "Function evioToOCPI22Model"

        let address = addressS.parseAddressOrCountryToString(charger.address)

        try {
            let countryCode = Utils.getKeyByValue(mappingNames, charger.address.country)
            let country = Utils.getKeyByValue(mappingCountryCodes, countryCode)
            let latitude = charger.geometry.coordinates[1]
            let longitude = charger.geometry.coordinates[0]
            let timezone = geoTimeZone.find(latitude, longitude)[0]
            let publish = charger.networks.find(networkObj => networkObj.network === network).publish
            let location = {
                country_code: country_code, //ISO-3166 alpha-2 country code of the CPO that 'owns' this Location.
                party_id: partyId, // CPO ID of the CPO that 'owns' this Location (following the ISO-15118 standard).
                // id : locationId,
                publish: publish,
                // name : locationId,
                address: address,
                city: charger.address.city,
                country,
                postal_code: charger.address.zipCode,
                coordinates: {
                    longitude: longitude.toString(),
                    latitude: latitude.toString()
                },
                evses: charger.plugs.map(plug => Utils.buildEvsesObject22(charger, plug, locationId, country_code, partyId, active, evseStatus, network)),
                operator: platform.cpoRoles[0].business_details,
                time_zone: timezone,
                mobie_voltage_level: charger.voltageLevel ? charger.voltageLevel : "BTN",
                mobie_access_type: process.env.MobieAccessTypePublic,
                mobie_cpe: charger.CPE,
                last_updated: new Date(charger.updatedAt).toISOString(),
            }

            if (locationId !== null) {
                location.id = locationId
                location.name = locationId
            }

            return location

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return {}
        }
    },
    evioToOCPI211Model: function (charger, network, country_code, partyId, platform, locationId, active, evseStatus) {
        const context = "Function evioToOCPI211Model"

        let address = addressS.parseAddressOrCountryToString(charger.address)

        try {
            let countryCode = Utils.getKeyByValue(mappingNames, charger.address.country)
            let country = Utils.getKeyByValue(mappingCountryCodes, countryCode)
            let latitude = charger.geometry.coordinates[1]
            let longitude = charger.geometry.coordinates[0]
            let timezone = geoTimeZone.find(latitude, longitude)[0]
            let location = {
                id: locationId,
                type: Utils.parkingTypeMapper(charger.parkingType),
                name: locationId,
                address: address,
                city: charger.address.city,
                postal_code: charger.address.zipCode,
                country,
                coordinates: {
                    longitude,
                    latitude,
                },
                evses: charger.plugs.map(plug => Utils.buildEvsesObject211(charger, plug, locationId, country_code, partyId, active, evseStatus, network)),
                operator: platform.cpoRoles[0].business_details,
                time_zone: timezone,
                // country_code : countryCode, //ISO-3166 alpha-2 country code of the CPO that 'owns' this Location.
                // party_id : partyId, // CPO ID of the CPO that 'owns' this Location (following the ISO-15118 standard).
                last_updated: new Date(charger.updatedAt).toISOString(),
            }

            return location

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return {}
        }
    },
    buildEvsesObject22: function (charger, plug, locationId, countryCode, partyId, active, evseStatus, network) {
        const context = "Function buildEvsesObject22"
        try {
            let status = process.env.evseStatusAvailable
            if (evseStatus) {
                status = evseStatus
            } else {
                if (charger.status !== process.env.chargePointStatusEVIOFaulted && charger.status !== process.env.chargePointStatusEVIOUnavailable) {
                    if (plug.active) {
                        if (active) {
                            let evseStatusObj = plug.evseStatus.find(obj => obj.network === network)
                            if (evseStatusObj) {
                                status = evseStatusObj.status
                            } else {
                                status = Utils.statusMapper(plug.status)
                            }
                        } else {
                            status = process.env.evseStatusInoperative
                        }
                    } else {
                        status = process.env.evseStatusOutOfOrder
                    }
                } else {
                    status = process.env.evseStatusOutOfOrder
                }
            }
            let uid = `${locationId}-${plug.plugId}`
            let tariff_ids = plug.tariffIds ? (plug.tariffIds.find(tariff => tariff.network === network) ? [plug.tariffIds.find(tariff => tariff.network === network).tariffId] : []) : []
            let evse = {
                // uid : uid,
                // evse_id : `${countryCode}*${partyId}*E*${uid.replaceAll("-","*")}`,
                status,
                // last_updated : plug.updatedAt !== null && plug.updatedAt !== undefined ?  new Date(plug.updatedAt).toISOString() : new Date(charger.updatedAt).toISOString(),
                last_updated: new Date(charger.updatedAt).toISOString(),
                capabilities: charger.allowRFID ? ["RFID_READER", "REMOTE_START_STOP_CAPABLE"] : ["REMOTE_START_STOP_CAPABLE"],
                connectors: [
                    {
                        // id : `${uid}-${plug.plugId}`,
                        standard: Utils.connectorTypeMapper(plug.connectorType.toUpperCase()),
                        format: plug.connectorFormat ? plug.connectorFormat : "SOCKET",
                        power_type: plug.powerType ? plug.powerType : "AC_3_PHASE",
                        max_voltage: plug.voltage,
                        max_amperage: plug.amperage,
                        // last_updated : plug.updatedAt !== null && plug.updatedAt !== undefined ?  new Date(plug.updatedAt).toISOString() : new Date(charger.updatedAt).toISOString(),
                        last_updated: new Date(charger.updatedAt).toISOString(),
                        tariff_ids,
                        //TODO Check this terms and conditions url
                        terms_and_conditions: process.env.TermsAndConditionsUrl,
                    }
                ],
            }

            if (locationId !== null) {
                evse.uid = uid
                evse.evse_id = `${countryCode}*${partyId}*E*${uid.replaceAll("-", "*")}`,
                    evse.connectors[0].id = `${uid}-${plug.plugId}`
            }

            return evse
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return {}
        }
    },
    buildEvsesObject211: function (charger, plug, locationId, countryCode, partyId, active, evseStatus, network) {
        const context = "Function buildEvsesObject211"
        try {
            let status = process.env.evseStatusAvailable
            if (evseStatus) {
                status = evseStatus
            } else {
                if (charger.status !== process.env.chargePointStatusEVIOFaulted && charger.status !== process.env.chargePointStatusEVIOUnavailable) {
                    if (plug.active) {
                        if (active) {
                            let evseStatusObj = plug.evseStatus.find(obj => obj.network === network)
                            if (evseStatusObj) {
                                status = evseStatusObj.status
                            } else {
                                status = Utils.statusMapper(plug.status)
                            }
                        } else {
                            status = process.env.evseStatusInoperative
                        }
                    } else {
                        status = process.env.evseStatusOutOfOrder
                    }
                } else {
                    status = process.env.evseStatusOutOfOrder
                }
            }
            let uid = `${locationId}-${plug.plugId}`
            let tariff_id = plug.tariffIds ? (plug.tariffIds.find(tariff => tariff.network === network) ? plug.tariffIds.find(tariff => tariff.network === network).tariffId : "") : ""

            return {
                uid: uid,
                evse_id: `${countryCode}*${partyId}*E*${uid.replaceAll("-", "*")}`,
                status,
                // last_updated : plug.updatedAt !== null && plug.updatedAt !== undefined ?  new Date(plug.updatedAt).toISOString() : new Date(charger.updatedAt).toISOString(),
                last_updated: new Date(charger.updatedAt).toISOString(),
                capabilities: charger.allowRFID ? ["RFID_READER", "REMOTE_START_STOP_CAPABLE"] : ["REMOTE_START_STOP_CAPABLE"],
                connectors: [
                    {
                        id: `${uid}-${plug.plugId}`,
                        standard: Utils.connectorTypeMapper(plug.connectorType.toUpperCase()),
                        format: plug.connectorFormat ? plug.connectorFormat : "SOCKET",
                        power_type: plug.powerType ? plug.powerType : "AC_3_PHASE",
                        voltage: plug.voltage,
                        amperage: plug.amperage,
                        // last_updated : plug.updatedAt !== null && plug.updatedAt !== undefined ?  new Date(plug.updatedAt).toISOString() : new Date(charger.updatedAt).toISOString(),
                        last_updated: new Date(charger.updatedAt).toISOString(),
                        tariff_id,
                        //TODO Check this terms and conditions url
                        terms_and_conditions: process.env.TermsAndConditionsUrl,
                    }
                ],
            }
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return {}
        }
    },
    statusMapper: function (status) {
        const context = "Function statusMapper"
        try {
            switch (status) {
                case '10':
                    return process.env.evseStatusAvailable
                case '20':
                    return process.env.evseStatusCharging
                case '30':
                    return process.env.evseStatusReserved
                case '40':
                    return process.env.evseStatusOutOfOrder
                case '50':
                    return process.env.evseStatusInoperative
                case '80':
                    return process.env.evseStatusUnknown;
                case '90':
                    return process.env.evseStatusRemoved
                default:
                    return process.env.evseStatusUnknown
            }
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return "UNKNOWN"
        }
    },
    connectorTypeMapper: function (type) {
        const context = "Function connectorTypeMapper"
        try {
            switch (type) {
                case 'CCS 2':
                    return "IEC_62196_T2_COMBO"
                case 'CHADEMO':
                    return "CHADEMO"
                case 'TYPE 2':
                    return "IEC_62196_T2"
                default:
                    return "UNKNOWN"
            }
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return "UNKNOWN"
        }
    },
    parkingTypeMapper: function (type) {
        const context = "Function parkingTypeMapper"
        try {
            switch (type) {
                case 'Street':
                    return "ON_STREET"
                case 'OutdoorParking':
                    return "PARKING_LOT"
                case 'CoverParking':
                    return "PARKING_GARAGE"
                case 'PrivateGarage':
                    return "OTHER"
                case 'OutdoorGarage':
                    return "OTHER"
                default:
                    return "UNKNOWN"
            }
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return "UNKNOWN"
        }
    },
    getKeyByValue: function (object, value) {
        return Object.keys(object).find(key => object[key].toUpperCase() === value.toUpperCase());
    },
    findOnePlatform: async function (query) {
        return await Platforms.findOne(query).lean()
    },
    createLocationQueue: async function (data) {
        const context = "Function createLocationQueue"
        try {
            const locationQueue = new LocationsQueue(data);
            await locationQueue.save()
            return data
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return null
        }
    },
    addToLocationQueue: async function (charger, command, network, country_code, party_id, operatorId, chargerId, platformId, status, evioChargerBeforeChanges, requestBody, evse, connector) {
        const context = "Function addToLocationQueue"
        try {
            let data = {
                charger,
                command,
                network,
                country_code,
                party_id,
                operatorId,
                chargerId,
                platformId,
                evioChargerBeforeChanges,
                requestBody,
                evse,
                connector,
                integrationStatus: {
                    status,
                    response: "",
                    errorCode: "",
                    errorDescription: "",
                },

            }
            if (!charger) {
                return null
            }
            return await Utils.createLocationQueue(data)
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return null
        }
    },
    getLocationIdMobiE: async function (platform, location, charger) {
        const context = "Function postCommand"
        try {
            let platformDetails = platform.platformDetails.find(details => details.version === platform.cpoActiveCredentialsToken[0].version)
            let locationsEndpoint = Utils.getPlatformSenderEndpoint(platform.platformCode, platformDetails, process.env.moduleLocations, process.env.roleReceiver)
            locationsEndpoint = locationsEndpoint + `/${location.country_code}/${location.party_id}`
            let resp = await Utils.postRequestOCPI(locationsEndpoint, location, { 'Authorization': `Token ${platform.platformActiveCredentialsToken[0].token}` })
            if (resp.success) {
                let result = resp.data
                if (result.status_code) {
                    if ((Math.round(result.status_code / 1000)) == 1) {
                        Utils.saveLog('POST', location, result, locationsEndpoint, platform.platformActiveCredentialsToken[0].token, platform.platformCode, platform.platformName, resp.status, process.env.triggerCPO, process.env.moduleLocations, platform.cpo)
                        let host = process.env.HostChargers + process.env.PathAddNetworkId
                        Utils.patchRequest(host, { chargerId: charger._id, network: platform.platformCode, id: result.data.id })
                        return result.data.id
                    } else {
                        Utils.saveLog('POST', location, result, locationsEndpoint, platform.platformActiveCredentialsToken[0].token, platform.platformCode, platform.platformName, resp.status, process.env.triggerCPO, process.env.moduleLocations, platform.cpo)
                        return ""
                    }
                } else {
                    Utils.saveLog('POST', location, result, locationsEndpoint, platform.platformActiveCredentialsToken[0].token, platform.platformCode, platform.platformName, resp.status, process.env.triggerCPO, process.env.moduleLocations, platform.cpo)
                    return ""
                }
            } else {
                let responseData = resp.data
                if (typeof resp.data === 'string' || resp.data instanceof String) {
                    responseData = { message: resp.data }
                }
                Utils.saveLog('POST', location, responseData, locationsEndpoint, platform.platformActiveCredentialsToken[0].token, platform.platformCode, platform.platformName, resp.status, process.env.triggerCPO, process.env.moduleLocations, platform.cpo)
                return ""
            }

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return ""
        }
    },
    patchRequest: async function (host, data) {
        const context = "Function patchRequest";
        let response = { success: true, data: {}, error: "", code: "" }
        try {
            let resp = await axios.patch(host, data)
            if (resp.data) {
                return { ...response, data: resp.data }
            } else {
                return { ...response, success: false, error: 'Not updated' }
            }
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            if (error.response) {
                if (error.response.data) {
                    return { ...response, success: false, error: error.response.data.message, code: error.response.data.code }
                }
                return { ...response, success: false, error: error.message }
            }
            return { ...response, success: false, error: error.message }
        }
    },
    postRequest: async function (host, data) {
        const context = "Function postRequest";
        let response = { success: true, data: {}, error: "", code: "" }
        try {
            let resp = await axios.post(host, data)
            if (resp.data) {
                return { ...response, data: resp.data }
            } else {
                return { ...response, success: false, error: 'Not created' }
            }
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            if (error.response) {
                if (error.response.data) {
                    return { ...response, success: false, error: error.response.data.message, code: error.response.data.code }
                }
                return { ...response, success: false, error: error.message }
            }
            return { ...response, success: false, error: error.message }
        }
    },
    getRequest: async function (host, params) {
        const context = "Function getRequest";
        let response = { success: true, data: {}, error: "", code: "" }
        try {
            let resp = await axios.get(host, { params })
            if (resp.data) {
                return { ...response, data: resp.data }
            } else {
                return { ...response, success: false, error: 'No content found' }
            }
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            if (error.response) {
                if (error.response.data) {
                    return { ...response, success: false, error: error.response.data.message, code: error.response.data.code }
                }
                return { ...response, success: false, error: error.message }
            }
            return { ...response, success: false, error: error.message }
        }
    },
    putRequest: async function (host, data) {
        const context = "Function putRequest";
        let response = { success: true, data: {}, error: "", code: "" }
        try {
            let resp = await axios.put(host, data)
            if (resp.data) {
                return { ...response, data: resp.data }
            } else {
                return { ...response, success: false, error: 'Not updated' }
            }
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            if (error.response) {
                if (error.response.data) {
                    return { ...response, success: false, error: error.response.data.message, code: error.response.data.code }
                }
                return { ...response, success: false, error: error.message }
            }
            return { ...response, success: false, error: error.message }
        }
    },
    createRestrictionObjects: function (detailedTariff, componentType, restrictions, price, step, uom, currency) {
        let context = "Function createRestrictionObjects";
        try {
            let restrictionObjArray = []
            for (let restriction in restrictions) {
                if (restriction.includes('time')) {

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
                } else if (restriction.includes('date')) {
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
                } else if (restriction.includes('kwh')) {
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
                } else if (restriction.includes('current')) {
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
                } else if (restriction.includes('power')) {
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
                } else if (restriction.includes('duration')) {
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
                } else if (restriction.includes('day_of_week')) {

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
            console.error(`[${context}] Error `, error.message);
        }
    },
    getBase64Extension: function (info, extension, fileExtension) {
        if (fileExtension) {
            return `.${fileExtension}`
        } else {
            if (info.includes('image')) {
                return `.${extension}`
            } else if (info.includes('application')) {
                if (extension.includes('pdf') || extension.includes('json')) {
                    return `.${extension}`
                } else if (extension.includes('spreadsheetml')) {
                    return `.xlsx`
                } if (extension.includes('wordprocessingml')) {
                    return `.docx`
                } else {
                    return ''
                }
            } else if (info.includes('text')) {
                if (extension.includes('plain')) {
                    return `.txt`
                } else if (extension.includes('csv')) {
                    return `.csv`
                } if (extension.includes('wordprocessingml')) {
                    return `.docx`
                } else {
                    return ''
                }
            } else {
                return ''
            }
        }
    },
    getCountryCodeWithCountry: function (country) {
        return Utils.getKeyByValue(mappingNames, country)
    },
    addToTariffsQueue: async function (tariff, command, network, country_code, party_id, operatorId, tariffId, platformId, status, controlCenterTariff, requestBody) {
        const context = "Function addToTariffsQueue"
        try {
            let data = {
                tariff,
                command,
                network,
                country_code,
                party_id,
                operatorId,
                tariffId,
                platformId,
                controlCenterTariff,
                requestBody,
                integrationStatus: {
                    status,
                    response: "",
                    errorCode: "",
                    errorDescription: "",
                },

            }
            if (!tariff) {
                return null
            }
            return await Utils.createTariffQueue(data)
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return null
        }
    },
    createTariffQueue: async function (data) {
        const context = "Function createTariffQueue"
        try {
            const tariffQueue = new TariffsQueue(data);
            await tariffQueue.save()
            return data
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return null
        }
    },
    transformTariffObject: function (network, tariff) {
        const context = "Function transformTariffObject"
        try {
            if (network === process.env.MobiePlatformCode) {
                return {
                    country_code: tariff.country_code,
                    party_id: tariff.party_id,
                    id: tariff.id,
                    currency: tariff.currency,
                    type: tariff.type,
                    min_price: tariff.min_price,
                    elements: tariff.elements,
                    last_updated: tariff.last_updated,
                }
            } else if (network === process.env.GirevePlatformCode) {
                //TODO Transform the time elements to eur/h
                return {
                    id: tariff.id,
                    currency: tariff.currency,
                    elements: tariff.elements,
                    last_updated: tariff.last_updated,
                }
            } else {
                return {}
            }
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return {}
        }
    },
    getPlatformSenderEndpoint: function (network, platformDetails, module, role) {
        const context = "Function getPlatformSenderEndpoint"
        try {
            if (network === process.env.MobiePlatformCode) {
                return platformDetails.endpoints.find(endpoint => endpoint.identifier === module && endpoint.role === role).url
            } else if (network === process.env.GirevePlatformCode) {
                return platformDetails.endpoints.find(endpoint => endpoint.identifier === module).url
            } else {
                return ""
            }
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return ""
        }
    },
    updateAttributions: async function (hwId, plugs, tariffId, oldCharger, network) {
        const context = "Function updateAttributions"
        try {
            const foundTariff = await Tariff.findOne({ id: tariffId }).lean()
            for (let plug of plugs) {
                let plugId = plug.plugId
                let updateTariffId = (plug.tariffId || plug.tariffId === "") ? plug.tariffId : tariffId
                let attributionIndex = foundTariff.attributions.findIndex(plug => plug.plugId === plugId && plug.hwId === hwId)
                if (attributionIndex > -1) {
                    if (!updateTariffId) {
                        foundTariff.attributions.splice(attributionIndex, 1)
                    }
                } else {
                    if (updateTariffId) {
                        foundTariff.attributions.push(
                            {
                                hwId,
                                plugId,
                            }
                        )
                    }
                }

                if (oldCharger) {
                    let oldPlug = oldCharger.plugs.find(plug => plug.plugId === plugId)
                    let oldTariffIdObj = oldPlug.tariffIds.find(tariff => tariff.network === network)
                    if (oldTariffIdObj) {
                        let oldTariffId = oldTariffIdObj.tariffId
                        if (oldTariffId !== updateTariffId) {
                            const foundOldTariff = await Tariff.findOne({ id: oldTariffId }).lean()
                            if (foundOldTariff) {
                                let removeIndex = foundOldTariff.attributions.findIndex(plug => plug.plugId === plugId && plug.hwId === hwId)
                                if (removeIndex > -1) {
                                    foundOldTariff.attributions.splice(removeIndex, 1)
                                    await Tariff.updateOne({ id: oldTariffId }, { $set: foundOldTariff })
                                }
                            }
                        }
                    }
                }

            }
            return await Tariff.updateOne({ id: tariffId }, { $set: foundTariff })


        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return null
        }
    },
    findOneVersions: async function (query) {
        return await Versions.findOne(query).lean()
    },
    findOneDetails: async function (query) {
        return await Details.findOne(query).lean()
    },
    getHttpStatus: function (response) {
        const context = "Function getHttpStatus"
        try {
            if (response) {
                if (response.status) {
                    return response.status
                } else {
                    return undefined
                }
            } else {
                return undefined
            }
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return undefined
        }
    },
    saveLog: async function (type, requestBody, responseBody, path, token, platformCode, platformName, httpCode, trigger, module, cpo) {
        const context = "Function saveLog"
        try {
            let data = {
                type,
                requestBody,
                responseBody,
                path,
                token,
                platformCode,
                platformName,
                httpCode,
                trigger,
                module,
                cpo,
                success: Utils.getLogSuccess(httpCode, responseBody.status_code),
            }

            const newLog = new OcpiLog(data);
            await newLog.save()
            return data
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return null
        }
    },
    updateCredentialsHandshake: async function (cpo, countryCode, platformCode, handshake) {
        const context = 'Function updateCredentialsHandshake';
        try {
            await User.updateMany({ "cpoDetails.party_id": cpo, "cpoDetails.network": platformCode }, { "$set": { "cpoDetails.$.certified": true, "cpoDetails.$.handshake": handshake, "cpoDetails.$.country_code": countryCode } })
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
        }
    },
    getOcpiModule: function (path) {
        const context = 'Function getOcpiModule';
        try {
            if (path.includes(process.env.moduleCdrs)) {
                return process.env.moduleCdrs
            } else if (path.includes(process.env.moduleCommands)) {
                return process.env.moduleCommands
            } else if (path.includes(process.env.moduleCredentials)) {
                return process.env.moduleCredentials
            } else if (path.includes(process.env.moduleLocations)) {
                return process.env.moduleLocations
            } else if (path.includes(process.env.moduleSessions)) {
                return process.env.moduleSessions
            } else if (path.includes(process.env.moduleTariffs)) {
                return process.env.moduleTariffs
            } else if (path.includes(process.env.moduleTokens)) {
                return process.env.moduleTokens
            } else if (path.includes(process.env.moduleVersions)) {
                return process.env.moduleVersions
            } else if (path.includes(process.env.moduleDetails)) {
                return process.env.moduleVersions
            } else {
                return ""
            }
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            return ""
        }
    },
    processCDR: async function (data, platform, isSftp) {
        const context = "Function processCDR"
        try {

            if (!data) throw new Error(`Data does not exist`);
            
            const { id, session_id } = data;
            let query = {
                "$or": [{ id }, { session_id }]
            }

            let foundCdr = await CDR.findOne(query, { _id: 0 }).lean()
            if (!foundCdr) {
                // TODO Get ownerId with session_id
                let cpoCountryCode = platform.cpoRoles.find(roleObj => roleObj.role === process.env.cpoRole).country_code

                let body = {
                    network: platform.platformCode,
                    party_id: platform.cpo,
                    country_code: cpoCountryCode,
                    ocpiId: data.session_id,
                    cdrId: data.id,
                }

                data.source = platform.platformCode

                const sessionExists = await ChargingSessionReadRepository.existsByCdr(
                    body.network,
                    body.party_id,
                    body.country_code,
                    body.ocpiId
                )

                let updatedSession = sessionExists && await Utils.updateSpecificSession(body)
                if (updatedSession) {
                    data.ownerId = updatedSession.operatorId
                    const new_cdr = new CDR(data);
                    return await new_cdr.save()
                } else {
                    if (platform.defaultOperatorId // we don't save cdrs without operator id
                            && (
                                isSftp // sftp enforces saving the cdr even without a session
                                || !sessionExists // if session doesn't exists we save anyways because it's a session managed only by MobiE
                            )) {
                        data.ownerId = platform.defaultOperatorId // for now this works because we know EVIO is the only operator with charge points directly connected to MobiE, but if we have another operator with the same situation in the future this is not going to work and we'll end with CDRs with the wrong ownerId in db
                        const new_cdr = new CDR(data);
                        return await new_cdr.save()
                    } else {
                        console.log("CDR with session id " + data.session_id + " not created - " + (isSftp ? "No EVIO operatorId was defined" : "Failed to update cdr session"));
                        return null
                    }
                }
            } else {
                console.log("CDR with session id " + data.session_id + " not created - CDR already exists");
                return null
            }
        }
        catch (error) {
            console.error(`[${context}] Error `, error.message);
            return null
        }
    },
    getSpecificSession: async function (query) {
        const context = "Function getSpecificSession"
        try {
            let host = process.env.HostChargers + process.env.PathGetSessionsToOcpiSpecific
            let resp = await Utils.getRequest(host, query)
            if (resp.success) {
                return resp.data
            } else {
                return null
            }
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return null
        }
    },
    getSpecificCharger: async function (query) {
        const context = "Function getSpecificCharger"
        try {
            let host = process.env.HostChargers + process.env.PathGetChargersToOcpiSpecific
            let resp = await Utils.getRequest(host, query)
            if (resp.success) {
                return resp.data
            } else {
                return null
            }
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return null
        }
    },
    getChargerByHwId: async function (hwId) {
        const context = "Function getChargerByHwId"
        try {
            let host = process.env.HostChargers + process.env.PathGetCharger + `/${hwId}`
            let resp = await Utils.getRequest(host, {})
            if (resp.success) {
                return resp.data
            } else {
                return null
            }
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return null
        }
    },
    addToCommandQueue: async function (command, hwId, plugId, result, message, response_url, network, country_code, party_id, operatorId, platformId, status) {
        const context = "Function addToCommandQueue"
        try {
            let data = {
                command,
                hwId,
                plugId,
                result,
                message,
                response_url,
                network,
                country_code,
                party_id,
                operatorId,
                platformId,
                integrationStatus: {
                    status,
                    response: "",
                    errorCode: "",
                    errorDescription: "",
                },

            }
            return await Utils.createCommandQueue(data)
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return null
        }
    },
    createCommandQueue: async function (data) {
        const context = "Function createCommandQueue"
        try {
            const commandQueue = new CommandsQueue(data);
            await commandQueue.save()
            return data
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return null
        }
    },
    getAuthorizeTokenHost: function (network, idTag, tokenType) {
        const context = "Function getAuthorizeTokenHost"
        try {
            if (network === process.env.MobiePlatformCode) {
                if (process.env.NODE_ENV === 'production') {
                    return process.env.HostAuthorizeTokenProd + `/${idTag}/authorize?type=${tokenType}`
                }
                else if (process.env.NODE_ENV === 'pre-production') {
                    // return process.env.HostAuthorizeTokenPre + `/${idTag}/authorize?type=${tokenType}`
                    return process.env.HostAuthorizeTokenTest + `/${idTag}/authorize?type=${tokenType}`
                }
                else {
                    return process.env.HostAuthorizeTokenPre + `/${idTag}/authorize?type=${tokenType}`
                }
            } else if (network === process.env.GirevePlatformCode) {
                //TODO Get authorize paths for Gireve
                return ""
            } else {
                ""
            }
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return ""
        }
    },
    addToSessionsQueue: async function (session, command, network, country_code, party_id, operatorId, sessionId, platformId, status, chargersSession, requestBody) {
        const context = "Function addToSessionsQueue"
        try {
            let data = {
                session,
                command,
                network,
                country_code,
                party_id,
                operatorId,
                sessionId,
                platformId,
                chargersSession,
                requestBody,
                integrationStatus: {
                    status,
                    response: "",
                    errorCode: "",
                    errorDescription: "",
                },

            }
            if (!session) {
                return null
            }
            return await Utils.createSessionQueue(data)
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return null
        }
    },
    createSessionQueue: async function (data) {
        const context = "Function createSessionQueue"
        try {
            const sessionQueue = new SessionsQueue(data);
            await sessionQueue.save()
            return data
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return null
        }
    },
    transformSessionObject: function (network, session) {
        const context = "Function transformSessionObject"
        try {
            if (network === process.env.MobiePlatformCode) {
                return {
                    country_code: session.country_code,
                    party_id: session.party_id,
                    id: session.ocpiId,
                    start_date_time: session.startDate,
                    end_date_time: session.stopDate,
                    kwh: session.totalPower,
                    cdr_token: session.cdr_token,
                    auth_method: session.auth_method,
                    authorization_reference: session.authorization_reference,
                    location_id: session.location_id,
                    evse_uid: session.evse_uid,
                    connector_id: session.connector_id,
                    currency: session.currency,
                    charging_periods: session.charging_periods,
                    status: Utils.getSessionStatus(session.status),
                    last_updated: new Date(session.updatedAt).toISOString(),
                }
            } else if (network === process.env.GirevePlatformCode) {
                return {
                    country_code: session.country_code,
                    party_id: session.party_id,
                    id: session.ocpiId,
                    start_datetime: session.startDate,
                    end_datetime: session.stopDate,
                    kwh: session.totalPower,
                    auth_id: session.cdr_token.auth_id,
                    auth_method: session.auth_method,
                    //TODO Get location Object
                    location: '',
                    location_id: session.location_id,
                    evse_uid: session.evse_uid,
                    connector_id: session.connector_id,
                    currency: session.currency,
                    charging_periods: session.charging_periods,
                    status: Utils.getSessionStatus(session.status),
                    last_updated: new Date(session.updatedAt).toISOString(),
                }
            } else {
                return {}
            }
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return {}
        }
    },
    getSessionStatus: function (status) {
        const context = "Function getSessionStatus"
        try {
            switch (status) {
                case process.env.SessionStatusToStart:
                    return process.env.OcpiSessionPending
                case process.env.SessionStatusRunning:
                    return process.env.OcpiSessionActive
                case process.env.SessionStatusToStop:
                    return process.env.OcpiSessionActive
                case process.env.SessionStatusStopped:
                    return process.env.OcpiSessionCompleted
                case process.env.SessionStatusFailed:
                    return process.env.OcpiSessionInvalid
                case process.env.SessionStatusStoppedAndEvParked:
                    return process.env.OcpiSessionCompleted
                case process.env.SessionStatusAvailableButNotStopped:
                    return process.env.OcpiSessionActive
                default:
                    return process.env.OcpiSessionInvalid
            }
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return process.env.OcpiSessionInvalid
        }
    },
    postRequestOCPI: async function (host, data, headers) {
        const context = "Function postRequestOCPI";
        let response = { success: true, data: {}, error: "", code: "" }
        try {
            let resp = await axios.post(host, data, { headers })
            if (resp.data) {
                return { ...response, data: resp.data, status: Utils.getHttpStatus(resp) }
            } else {
                return { ...response, success: false, error: 'Not sent', status: Utils.getHttpStatus(resp) }
            }
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            if (error.response) {
                if (error.response.data) {
                    return { ...response, success: false, error: error.response.data.message, code: error.response.data.code, status: Utils.getHttpStatus(error.response), data: error.response.data }
                }
                return { ...response, success: false, error: error.message, status: Utils.getHttpStatus(error.response) }
            }
            return { ...response, success: false, error: error.message, status: Utils.getHttpStatus(error.response) }
        }
    },
    getSessionsOcpi: async function (query) {
        const context = "Function getSessionsOcpi"
        try {
            let host = process.env.HostChargers + process.env.PathGetSessionsToOcpi
            let resp = await Utils.getRequest(host, query)
            if (resp.success) {
                return resp.data
            } else {
                return null
            }
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return null
        }
    },
    updateSpecificSession: async function (data) {
        const context = "Function updateSpecificSession"
        try {
            let host = process.env.HostChargers + process.env.PathGetSessionsToOcpi
            let resp = await Utils.patchRequest(host, data)
            if (resp.success) {
                return resp.data
            } else {
                return null
            }
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return null
        }
    },
    getLogSuccess: function (httpCode, ocpiCode) {
        const context = "Function getLogSuccess"
        try {
            if (httpCode === null || httpCode === undefined || ocpiCode === null || ocpiCode === undefined) {
                return false
            } else {
                if (httpCode / 100 !== 2 || ocpiCode / 1000 !== 1) {
                    return false
                } else {
                    return true
                }
            }
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return false
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
            console.error(`[${context}] Error `, error.message);
            return timeZone
        }
    },
    getInfrastructureInfo: async function (userId, infrastructureId) {
        const context = "Function getInfrastructureInfo";
        try {
            let host = process.env.HostChargers + process.env.PathGetMyInfrastructure
            let params = { userId, infrastructureId };
            let resp = await axios.get(host, { params })
            if (resp.data) {
                return resp.data
            } else {
                return null
            }
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return null
        }
    },
    sleep: function (ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    },
    
}

module.exports = Utils;
