require("dotenv-safe").load();

const Sentry = require("@sentry/node");
const axios = require("axios");
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
const moment = require('moment');
let periodBillingJson = require('../models/periodBillingRoutines.json')
let PeriodBillingRoutines = require('../models/periodBillingRoutines.js')
const IdentityService = require('../services/identityService');
const ChargerService = require('../services/chargerService');
const OCPIService = require('../services/ocpiService');
const { getCode, getName } = require('country-list');
const Constants = require('../utils/constants');
const { Enums } = require('evio-library-commons').default;

module.exports = {
    startJobPeriodBilling: function (req, res) {
        let context = "Function startJobPeriodBilling";
        return new Promise((resolve, reject) => {

            let timer = req.body.timer

            if (timer in taskPeriodBilling) {
                let billingPeriods = taskPeriodBilling[timer].billingPeriods
                initJobPeriodBilling(timer, billingPeriods).then(() => {

                    taskPeriodBilling[timer]["job"].start();
                    console.log("Check Period Billing Job Started " + timer)

                    resolve("Check Period Billing Job Started " + timer);

                }).catch((e) => {

                    console.error(`[${context}] Error`, e.message);
                    reject(e);

                });
            } else {
                resolve("No current job corresponding that timer")
            }

        });
    },
    stopJobPeriodBilling: function (req, res) {
        let context = "Function stopJobPeriodBilling";
        return new Promise((resolve, reject) => {
            try {
                let timer = req.body.timer
                if (!timer) {
                    reject({ message: "Missing job timer to stop job" })
                } else {
                    taskPeriodBilling[timer]["job"].stop();
                    console.log("Check Period Billing Job Stopped " + timer)
                    resolve('Check Period Billing Job Stopped ' + timer);
                }

            } catch (error) {

                console.error(`[${context}] Error`, error.message);
                reject(error);

            };

        });
    },
    statusJobPeriodBilling: function (req, res) {
        let context = "Function statusJobPeriodBilling";
        return new Promise((resolve, reject) => {
            try {
                let statusArray = []
                for (let timer in taskPeriodBilling) {
                    var status = "Stopped";
                    if (taskPeriodBilling[timer]["job"] != undefined) {
                        status = taskPeriodBilling[timer]["job"].status;
                    }
                    statusArray.push({ timer, status })
                }

                resolve({ "Check Period Billing Job Status": statusArray });

            } catch (error) {

                console.error(`[${context}] Error`, error.message);
                reject(error);

            };

        });
    },
    forceJobPeriodBilling: function (req, res) {
        let context = "Function forceJobPeriodBilling";
        return new Promise((resolve, reject) => {
            try {
                console.log("Period Billing Job was executed")
                let billingPeriods = req.body.billingPeriods ? req.body.billingPeriods : []
                let userId = req.body.userId ? req.body.userId : ""
                let start_date_time = req.body.start_date_time ? new Date(req.body.start_date_time).toISOString() : ""
                let end_date_time = ""
                if (req.body.end_date_time) {
                    end_date_time = new Date(req.body.end_date_time)
                    end_date_time.setHours(23, 59, 59)
                    end_date_time = end_date_time.toISOString()
                }
                periodBilling(billingPeriods, userId, start_date_time, end_date_time, null);

                resolve("Period Billing Job was executed");

            } catch (error) {

                console.error(`[${context}] Error`, error.message);
                reject(error);

            };

        });
    },
    createJobPeriodBilling: function (req, res) {
        let context = "Function createJobPeriodBilling";
        return new Promise(async (resolve, reject) => {
            try {
                let { timer, billingPeriods } = req.body
                if (!timer && !billingPeriods) {
                    reject({ message: "Missing timer and billingPeriods key" })
                } else if (!billingPeriods) {
                    reject({ message: "Missing billingPeriods key" })
                } else if (!timer) {
                    reject({ message: "Missing timer key" })
                } else {
                    let found = await PeriodBillingRoutines.findOne({ timer })
                    if (!found) {
                        let newPeriodBilling = new PeriodBillingRoutines({ timer, billingPeriods })
                        await PeriodBillingRoutines.create(newPeriodBilling)
                        resolve(newPeriodBilling)
                    } else {
                        resolve("Job already exist with that timer")

                    }
                }

            } catch (error) {
                console.error(`[${context}] Error`, error.message);
                reject(error);
            };
        });
    },
    createDefaultPeriodBilling: function (req, res) {
        let context = "Function createDefaultPeriodBilling";
        return new Promise(async (resolve, reject) => {
            try {
                await createDefaultBillingPeriodJobs(periodBillingJson)
                resolve("OK")

            } catch (error) {
                console.error(`[${context}] Error`, error.message);
                reject(error);

            };
        });
    },
    getAllPeriodBillings: function (req, res) {
        let context = "Function getAllPeriodBillings";
        return new Promise(async (resolve, reject) => {
            try {
                let allPeriodBillings = await PeriodBillingRoutines.find({}, { __v: 0 })
                resolve(allPeriodBillings)
            } catch (error) {

                console.error(`[${context}] Error`, error.message);
                reject(error);

            };
        });
    },
    updatePeriodBillings: function (req, res) {
        let context = "Function updatePeriodBillings";
        return new Promise(async (resolve, reject) => {
            try {

                let { _id, newValues } = req.body
                if (!_id) {
                    reject({ message: "Missing _id  key" })
                } else if (!newValues) {
                    reject({ message: "Missing newValues  key" })
                } else {
                    let updatedPeriod = await PeriodBillingRoutines.findOneAndUpdate({ _id }, { $set: newValues }, { new: true })
                    resolve(updatedPeriod)
                }
            } catch (error) {

                console.error(`[${context}] Error`, error.message);
                reject(error);

            };
        });
    },
    //Ir buscar as sesões pelo invoiceId
    //mudar o host para um host que apenas cria o objecto ou substitui o attach do invoiceId (meter este _ID no host)
    //chamar o parseSessions
    reprocessAttachments: async function (req, res) {
        const context = "Function reprocessAttachments";
        try {

            if (!req.body.invoiceId || !req.body.clientName) {
                console.log(`${context} invoiceId is necessary or clientName is necessary`)
                return
            }

            let invoiceId = req.body.invoiceId
            let clientName = req.body.clientName
            let userId = req.body.userId

            //ir buscar as sessões com o invoiceId da OCPI e EVIO
            let [sessionsEVIO, sessionsOCPI] = await Promise.all([getBillinEVIO(invoiceId, clientName), getBillingOCPI(invoiceId)]);

            console.log(`${context} sessionsEVIO: ${sessionsEVIO} , sessionsOCPI: ${sessionsOCPI} , invoiceId: ${invoiceId}`)

            const billingPeriods = [process.env.billingPeriodAD_HOC, process.env.billingPeriodMONTHLY, process.env.billingPeriodWEEKLY, process.env.billingPeriodBI_WEEKLY];

            const result = await IdentityService.getAllValidBillingProfilesForMonthlyB2C(billingPeriods, userId);

            console.log(`${context} result of retrieving getAllValidBillingProfilesForMonthlyB2C: ${result}`)


            if (result.data.length != 1) {
                console.log(`${context} result data is ${result.data.length} instead of 1`)
                return;
            }

            let headers = {
                'userid': userId,
                'clientname': clientName,
                'ceme': process.env.ListCLientNameEVIO.includes(clientName) ? 'EVIO' : clientName,
            }
                    
            let billingProfile = result.data[0].billingProfile;

            if (!billingProfile) {
                console.log(`${context} billingProfile not found`)
                return;
            }

            let optionalCountryCodeToVAT = null

            if (sessionsOCPI && sessionsOCPI?.length > 0 && sessionsOCPI[0].country_code) {
                optionalCountryCodeToVAT = sessionsOCPI[0].fees?.countryCode ?? sessionsOCPI[0].country_code
            }

            let host = process.env.HostBilling + process.env.PathReprocessAttachments;
            console.log(`${context} calling sendFinalInvoice`)
      
            sendFinalInvoice(null, sessionsOCPI, billingProfile.userId, billingProfile.invoiceWithoutPayment, null, "", "", billingProfile.billingPeriod,
                host, headers, [billingProfile.userId], billingProfile, optionalCountryCodeToVAT, req.body?.docNumber);

        }
        catch (error) {
            console.error(`[${context}] Error`, error.message);
            return;
        };
    }
}


//========== FUNCTION ==========

async function periodBilling(billingPeriods, forcedUserId, start_date_time, end_date_time, timer) {
    const context = "[Function periodBilling]";
    try {

        console.log(`${context} was called with billingPeriods, forcedUserId, start_date_time, end_date_time, timer`, billingPeriods, forcedUserId, start_date_time, end_date_time, timer);

        const result = await IdentityService.getAllValidBillingProfilesForMonthlyB2C(billingPeriods, forcedUserId);

        if (result.data.length > 0) {
            for (let data of result.data) {
                let billingProfile = data.billingProfile;
                let user = data.user

                await processBillingPeriodPromise(billingProfile , start_date_time , end_date_time , timer, user)
            }
            console.log("Processed all monthly billing available");
        }
        else {
            console.log(`${context} No period billing`);
        }

    }
    catch (error) {
        Sentry.captureException(error);
        console.error(`${context} Error `, error.message);
    }
}

function getBillingPeriodDates(timer, startDate, endDate, billingPeriod) {
    try {
        let billingPeriodEndDate = moment.utc().format()
        let previousDateMapper = {
            '2': () => {
                let billingPeriodStartDate = new Date(new Date().toISOString())
                if (billingPeriod === "WEEKLY") {
                    billingPeriodStartDate.setDate(0)
                    billingPeriodStartDate.setDate(24)
                } else if (billingPeriod === "BI_WEEKLY") {
                    billingPeriodStartDate.setDate(0)
                    billingPeriodStartDate.setDate(16)
                }
                return moment.utc(billingPeriodStartDate).format()
            },
            '8': () => {
                let billingPeriodStartDate = new Date(new Date().toISOString())
                if (billingPeriod === "WEEKLY") {
                    billingPeriodStartDate.setDate(2)
                } else if (billingPeriod === "MONTHLY") {
                    billingPeriodStartDate.setDate(0)
                    billingPeriodStartDate.setDate(1)
                }
                return moment.utc(billingPeriodStartDate).format()
            },
            '16': () => {
                let billingPeriodStartDate = new Date(new Date().toISOString())
                if (billingPeriod === "WEEKLY") {
                    billingPeriodStartDate.setDate(8)
                } else if (billingPeriod === "BI_WEEKLY") {
                    billingPeriodStartDate.setDate(2)
                }
                return moment.utc(billingPeriodStartDate).format()
            },
            '24': () => {
                let billingPeriodStartDate = new Date(new Date().toISOString())
                if (billingPeriod === "WEEKLY") {
                    billingPeriodStartDate.setDate(16)
                }
                return moment.utc(billingPeriodStartDate).format()
            },
        }

        if (timer) {
            let runningDay = timer.split(" ")[2]
            let billingPeriodStartDate = previousDateMapper[runningDay]() ? previousDateMapper[runningDay]() : moment.utc(billingPeriodEndDate).subtract(8, 'days').format()
            if (billingPeriod === "MONTHLY") {
                billingPeriodEndDate = new Date(new Date().toISOString())
                billingPeriodEndDate.setDate(0)
                billingPeriodEndDate = moment.utc(billingPeriodEndDate).format()
            }
            return {
                startDate: billingPeriodStartDate,
                endDate: billingPeriodEndDate,
            }
        } else {
            return {
                startDate,
                endDate,
            }
        }
    } catch (error) {
        let billingPeriodEndDate = moment.utc().format()
        let billingPeriodStartDate = moment.utc(billingPeriodEndDate).subtract(8, 'days').format()
        return {
            startDate: billingPeriodStartDate,
            endDate: billingPeriodEndDate,
        }
    }
}

function periodBillingEVIO(userId, billingPeriod, invoiceWithoutPayment, start_date_time, end_date_time, clientName, country) {
    const context = "Function periodBillingEVIO";
    return new Promise(async (resolve, reject) => {
        console.debug(`${context} was called with userId, billingPeriod, invoiceWithoutPayment, start_date_time, end_date_time, clientName, country`, userId, billingPeriod, invoiceWithoutPayment, start_date_time, end_date_time, clientName, country);
        //TO DO
        //Ir buscar todas as sessoes EVIO que foram pagas, mas que os
        //invoices ainda nao foram gerados
        console.log("periodBillingEVIO")
        const params = {
            userId: userId,
            billingPeriod: billingPeriod,
            invoiceWithoutPayment: invoiceWithoutPayment,
            start_date_time,
            end_date_time,
            country,
        };

        let host = process.env.ChargersServiceProxy + process.env.PathPeriodBilling;

        axios.get(host, { params })
            .then((result) => {

                console.log("Result", result.data.length);

                if (result.data.length > 0) {

                    let total_cost_excl_vat = 0;
                    let total_cost_incl_vat = 0;
                    let sessionsId = [];
                    let sessionsList = result.data;
                    let paymentIds = [];

                    let responseObject = {};

                    if (process.env.ListCLientNameEVIO.includes(clientName)) {
                        Promise.all(
                            result.data.map(session => {
                                return new Promise((resolve, reject) => {

                                    total_cost_excl_vat += roundValue(session.totalPrice.excl_vat);
                                    total_cost_incl_vat += roundValue(session.totalPrice.incl_vat);

                                    let newSession = {
                                        sessionId: session._id,
                                        chargerType: session.chargerType
                                    }

                                    sessionsId.push(newSession);
                                    if (session.paymentId) {
                                        paymentIds.push(session.paymentId);
                                    }
                                    resolve(true);

                                });
                            })
                        ).then(() => {

                            responseObject.evio = {
                                total_cost_excl_vat: roundValue(total_cost_excl_vat),
                                total_cost_incl_vat: roundValue(total_cost_incl_vat),
                                sessionsId: sessionsId,
                                sessionsList: sessionsList,
                                paymentIds: paymentIds
                            }
                            responseObject.others = null

                            resolve(responseObject)

                        }).catch((error) => {
                            console.error(`[${context}][] Error `, error.message);
                            responseObject.evio = {
                                total_cost_excl_vat: 0,
                                total_cost_incl_vat: 0,
                                sessionsId: [],
                                sessionsList: [],
                                paymentIds: []
                            }
                            responseObject.others = null
                            resolve(responseObject)

                        });
                    } else {

                        responseObject.evio = {
                            total_cost_excl_vat: 0,
                            total_cost_incl_vat: 0,
                            sessionsId: [],
                            sessionsList: [],
                            paymentIds: []
                        }
                        responseObject.others = {
                            total_cost_excl_vat: 0,
                            total_cost_incl_vat: 0,
                            sessionsId: [],
                            sessionsList: [],
                            paymentIds: []
                        }
                        Promise.all(
                            result.data.map(session => {
                                return new Promise((resolve, reject) => {

                                    if (process.env.WhiteLabelChargerType.includes(session.chargerType)) {

                                        responseObject.others.total_cost_excl_vat += roundValue(session.totalPrice.excl_vat);
                                        responseObject.others.total_cost_incl_vat += roundValue(session.totalPrice.incl_vat);
                                        let newSession = {
                                            sessionId: session._id,
                                            chargerType: session.chargerType
                                        }

                                        responseObject.others.sessionsList.push(session);
                                        responseObject.others.sessionsId.push(newSession);
                                        if (session.paymentId) {
                                            responseObject.others.paymentIds.push(session.paymentId);
                                        }
                                        resolve(true);

                                    } else {

                                        responseObject.evio.total_cost_excl_vat += roundValue(session.totalPrice.excl_vat);
                                        responseObject.evio.total_cost_incl_vat += roundValue(session.totalPrice.incl_vat);
                                        let newSession = {
                                            sessionId: session._id,
                                            chargerType: session.chargerType
                                        }
                                        responseObject.evio.sessionsList.push(session);
                                        responseObject.evio.sessionsId.push(newSession);
                                        if (session.paymentId) {
                                            responseObject.evio.paymentIds.push(session.paymentId);
                                        }
                                        resolve(true);

                                    }

                                });
                            })
                        ).then(() => {

                            resolve(responseObject)

                        }).catch((error) => {
                            console.error(`[${context}][] Error `, error.message);
                            responseObject.evio = {
                                total_cost_excl_vat: 0,
                                total_cost_incl_vat: 0,
                                sessionsId: [],
                                sessionsList: [],
                                paymentIds: []
                            }
                            responseObject.others = {
                                total_cost_excl_vat: 0,
                                total_cost_incl_vat: 0,
                                sessionsId: [],
                                sessionsList: [],
                                paymentIds: []
                            }
                            resolve(responseObject)

                        });
                    }

                }
                else {
                    let responseObject = {
                        evio: null,
                        others: null
                    }
                    resolve(responseObject);
                }

            })
            .catch((error) => {
                console.error(`[${context}][${host}] Error `, error.message);
                let responseObject = {
                    evio: null,
                    others: null
                }
                resolve(responseObject);
            });

    });
}

function getBillinEVIO(invoiceId, clientName) {
    const context = "Function getBillinEVIO";
    return new Promise(async (resolve, reject) => {

        const params = {
            invoiceId
        };

        let host = process.env.ChargersServiceProxy + process.env.PathGetBillingSessions;

        console.log(context + "Axios call")

        axios.get(host, { params })
            .then((result) => {

                console.log("Result", result.data.length);

                if (result.data.length > 0) {

                    let total_cost_excl_vat = 0;
                    let total_cost_incl_vat = 0;
                    let sessionsId = [];
                    let sessionsList = result.data;
                    let paymentIds = [];

                    let responseObject = {};

                    if (process.env.ListCLientNameEVIO.includes(clientName)) {
                        Promise.all(
                            result.data.map(session => {
                                return new Promise((resolve, reject) => {

                                    total_cost_excl_vat += roundValue(session.totalPrice.excl_vat);
                                    total_cost_incl_vat += roundValue(session.totalPrice.incl_vat);

                                    let newSession = {
                                        sessionId: session._id,
                                        chargerType: session.chargerType
                                    }

                                    sessionsId.push(newSession);
                                    if (session.paymentId) {
                                        paymentIds.push(session.paymentId);
                                    }
                                    resolve(true);

                                });
                            })
                        ).then(() => {

                            responseObject.evio = {
                                total_cost_excl_vat: roundValue(total_cost_excl_vat),
                                total_cost_incl_vat: roundValue(total_cost_incl_vat),
                                sessionsId: sessionsId,
                                sessionsList: sessionsList,
                                paymentIds: paymentIds
                            }
                            responseObject.others = null

                            console.log("Final EVIO ", responseObject);
                            resolve(responseObject)

                        }).catch((error) => {
                            console.error(`[${context}][] Error `, error.message);
                            responseObject.evio = {
                                total_cost_excl_vat: 0,
                                total_cost_incl_vat: 0,
                                sessionsId: [],
                                sessionsList: [],
                                paymentIds: []
                            }
                            responseObject.others = null
                            console.log("Final EVIO ", responseObject);
                            resolve(responseObject)

                        });
                    } else {

                        responseObject.evio = {
                            total_cost_excl_vat: 0,
                            total_cost_incl_vat: 0,
                            sessionsId: [],
                            sessionsList: [],
                            paymentIds: []
                        }
                        responseObject.others = {
                            total_cost_excl_vat: 0,
                            total_cost_incl_vat: 0,
                            sessionsId: [],
                            sessionsList: [],
                            paymentIds: []
                        }
                        Promise.all(
                            result.data.map(session => {
                                return new Promise((resolve, reject) => {

                                    if (process.env.WhiteLabelChargerType.includes(session.chargerType)) {

                                        responseObject.others.total_cost_excl_vat += roundValue(session.totalPrice.excl_vat);
                                        responseObject.others.total_cost_incl_vat += roundValue(session.totalPrice.incl_vat);
                                        let newSession = {
                                            sessionId: session._id,
                                            chargerType: session.chargerType
                                        }

                                        responseObject.others.sessionsList.push(session);
                                        responseObject.others.sessionsId.push(newSession);
                                        if (session.paymentId) {
                                            responseObject.others.paymentIds.push(session.paymentId);
                                        }
                                        resolve(true);

                                    } else {

                                        responseObject.evio.total_cost_excl_vat += roundValue(session.totalPrice.excl_vat);
                                        responseObject.evio.total_cost_incl_vat += roundValue(session.totalPrice.incl_vat);
                                        let newSession = {
                                            sessionId: session._id,
                                            chargerType: session.chargerType
                                        }
                                        responseObject.evio.sessionsList.push(session);
                                        responseObject.evio.sessionsId.push(newSession);
                                        if (session.paymentId) {
                                            responseObject.evio.paymentIds.push(session.paymentId);
                                        }
                                        resolve(true);

                                    }

                                });
                            })
                        ).then(() => {

                            console.log("Final EVIO", responseObject);
                            resolve(responseObject)

                        }).catch((error) => {
                            console.error(`[${context}][] Error `, error.message);
                            responseObject.evio = {
                                total_cost_excl_vat: 0,
                                total_cost_incl_vat: 0,
                                sessionsId: [],
                                sessionsList: [],
                                paymentIds: []
                            }
                            responseObject.others = {
                                total_cost_excl_vat: 0,
                                total_cost_incl_vat: 0,
                                sessionsId: [],
                                sessionsList: [],
                                paymentIds: []
                            }
                            console.log("Final EVIO ", responseObject);
                            resolve(responseObject)

                        });
                    }

                }
                else {
                    let responseObject = {
                        evio: null,
                        others: null
                    }
                    console.log("Final EVIO ", responseObject);
                    resolve(responseObject);
                }

            })
            .catch((error) => {
                console.error(`[${context}][${host}] Error `, error.message); 
                trow(responseObject);
            });

    });
}

function periodBillingOCPI(userId, billingPeriod, invoiceWithoutPayment, start_date_time, end_date_time, countryCode) {
    const context = "[Function periodBillingOCPI]";
    return new Promise(async (resolve, reject) => {

        const params = {
            userId: userId,
            billingPeriod: billingPeriod,
            invoiceWithoutPayment: invoiceWithoutPayment,
            start_date_time,
            end_date_time,
            countryCode,
        };

        let host = process.env.HostChargingSessionMobie + process.env.PathPeriodBillingV2;

        console.log(host);

        axios.get(host, { params })
            .then((result) => {
                resolve(result.data);
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                resolve(null);
            });

    });

}

function getBillingOCPI(invoiceId ) {
    const context = "[Function periodBillingOCPI]";
    return new Promise(async (resolve, reject) => {

        const params = {
            invoiceId
        };

        let host = process.env.HostChargingSessionMobie + process.env.PathGetBillingSessions;


        console.log(context + "Axios call")

        axios.get(host, { params })
            .then((result) => {
                resolve(result.data);
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                trow(error.message);
            });

    });

}

function createEVIOInvoiceObj(chargingSessionsEVIO, userId) {
    var context = "Function createEVIOInvoiceObj";
    return new Promise(async (resolve, reject) => {

        let invoice = {
            header: {
                userId: userId
            },
            paymentIdList: [],
            lines: []
        }

        let lines = [];

        let total_exc_vat = 0
        let total_inc_vat = 0

        var others = 0;
        var activationFee = 0;
        var attachLines = [];

        var totalTime = 0;
        var numberSessions = chargingSessionsEVIO.sessionsList.length;
        var totalPower = 0;
        var vatPriceEvio_network = 0;
        var vatPriceEvio_services = 0;

        let totalPrices = {
            'evio': {
                total_exc_vat: 0,
                total_inc_vat: 0,
                totalTime: 0,
                totalPower: 0,
                numberSessions: 0,
                attachLines: [],
            },
            'other': {
                total_exc_vat: 0,
                total_inc_vat: 0,
                totalTime: 0,
                totalPower: 0,
                numberSessions: 0,
                attachLines: [],
            },
            'hyundai': {
                total_exc_vat: 0,
                total_inc_vat: 0,
                totalTime: 0,
                totalPower: 0,
                numberSessions: 0,
                attachLines: [],
            },
            'goCharge': {
                total_exc_vat: 0,
                total_inc_vat: 0,
                totalTime: 0,
                totalPower: 0,
                numberSessions: 0,
                attachLines: [],
            },
            'klc': {
                total_exc_vat: 0,
                total_inc_vat: 0,
                totalTime: 0,
                totalPower: 0,
                numberSessions: 0,
                attachLines: [],
            },
            'kinto': {
                total_exc_vat: 0,
                total_inc_vat: 0,
                totalTime: 0,
                totalPower: 0,
                numberSessions: 0,
                attachLines: [],
            },
        }

        Promise.all(chargingSessionsEVIO.sessionsList.map(session => {
            return new Promise(async (resolve, reject) => {
                // let { invoiceCode, invoiceDescription } = getBillingCodesAndTotalPrices(session , totalPrices)
                // let invoiceLine = await getInvoiceLines(session , invoiceCode , invoiceDescription);
                // invoiceLine.forEach(line => {
                //     total_exc_vat += line.quantity * line.unitPrice;
                //     total_inc_vat += line.quantity * line.unitPrice * (1 + line.vat);
                // });
                total_inc_vat += session.totalPrice.incl_vat
                total_exc_vat += (session.totalPrice.incl_vat / (1 + session.fees.IVA))
                // lines.push(invoiceLine);

                totalTime += session.timeCharged;
                totalPower += session.totalPower / 1000;

                let use_energy = 0;
                let use_time = 0;
                let evioEnergyCost = 0
                let evioTimeCost = 0

                if (session.tariffId !== "-1") {
                    if (session?.tariff?.tariffType === process.env.TariffByPower) {
                        evioEnergyCost = session?.tariff?.tariff?.chargingAmount?.value ?? 0;
                        if (session.costDetails)
                            use_energy = session.costDetails.costDuringCharge;
                    } else {
                        evioTimeCost = session?.tariff?.tariff?.chargingAmount?.value ?? 0;
                        if (session.costDetails)
                            use_time = session.costDetails.costDuringCharge;
                    };
                };

                if (session.costDetails) {
                    activationFee += session.costDetails.activationFee;
                    others += (session.costDetails.parkingDuringCharging + session.costDetails.parkingAmount);
                };

                // vatPriceEvio_network += ((use_energy + use_time) * session.fees.IVA);
                vatPriceEvio_network += roundValue(session.totalPrice.incl_vat - session.totalPrice.excl_vat);

                if (session.costDetails)
                    vatPriceEvio_services += ((session.costDetails.activationFee + session.costDetails.parkingDuringCharging + session.costDetails.parkingAmount) * session.fees.IVA)

                let totalPowerSession = 0;
                let timeChargedSession = 0;
                let activationFeeSession = 0;
                //let parkingDuringChargingSession = 0;
                //let parkingAmountSession = 0;
                let timeDuringParking = 0;

                if (session.costDetails) {
                    totalPowerSession = session.costDetails.totalPower;
                    timeChargedSession = session.costDetails.timeCharged;
                    activationFeeSession = session.costDetails.activationFee;
                    //parkingDuringChargingSession = session.costDetails.parkingDuringCharging;
                    //parkingAmountSession = session.costDetails.parkingAmount;
                    if (session.costDetails.timeDuringParking !== undefined && session.costDetails.timeDuringParking !== null) {
                        timeDuringParking = session.costDetails.timeDuringParking;
                    }
                } else {
                    totalPowerSession = session.totalPower;
                    timeChargedSession = session.timeCharged;
                }

                let chargingTariff;
                let parkingTariff;
                let parkingDuringChargingTariff;

                if (session.tariff) {
                    if (session.tariff.tariff) {
                        chargingTariff = session?.tariff?.tariff?.chargingAmount?.value ?? 0;
                        parkingTariff = session?.tariff?.tariff?.parkingAmount?.value ?? 0;
                        parkingDuringChargingTariff = session?.tariff?.tariff?.parkingDuringChargingAmount?.value ?? 0;
                    } else {
                        chargingTariff = "-";
                        parkingTariff = "-";
                        parkingDuringChargingTariff = "-";
                    }
                } else {
                    chargingTariff = "-";
                    parkingTariff = "-";
                    parkingDuringChargingTariff = "-";
                }

                let city;

                if (session.address) {
                    city = session.address.city
                } else {
                    city = "-"
                }

                let evDetails = session.evDetails ?? (session.evId !== null && session.evId !== undefined && session.evId !== "-1" ? await getEvDetails(session.evId) : null )
                let licensePlate = evDetails?.licensePlate ?? null
                let groupDrivers = evDetails ? evDetails?.listOfGroupDrivers?.find(group => group?.listOfDrivers?.find(driver => driver._id === session.userId)) : null
                let fleet = session.fleetDetails ?? ( evDetails && evDetails.fleet !== null && evDetails.fleet !== undefined && evDetails.fleet !== "-1" ? await getFleetDetails(evDetails.fleet) : null)

                let userInfo = session.userIdInfo ?? await getUserInfo(session.userId)
                let userWillPayInfo = session.userIdWillPayInfo ?? (session.userIdWillPay !== session.userId ? await getUserInfo(session.userIdWillPay) : userInfo)

                let validReadingPoints = session.readingPoints.filter(point => point.instantPower >= 0)
                let validReadingPointsLength = validReadingPoints.length
                let validReadingPointsSum = validReadingPoints.map(obj => obj.instantPower).reduce((a, b) => a + b, 0)

                let averagePower = validReadingPointsSum > 0 && validReadingPointsLength > 0 ? (validReadingPointsSum / validReadingPointsLength) / 1000 : 0
                if (!averagePower) {
                    averagePower = session.totalPower > 0 && session.timeCharged > 0 ? (session.totalPower / 1000) / (session.timeCharged / 3600) : 0
                }

                let realTimeCharging = session.timeCharged / 60

                if (session.endOfEnergyDate !== null && session.endOfEnergyDate !== undefined) {
                    realTimeCharging = moment.duration(moment.utc(session.endOfEnergyDate).diff(moment.utc(session.startDate))).asMinutes()
                }
                
                if(session.localStartDate) {
                    session.startDate = session.localStartDate
                }

                var attachLine = {
                    "date": moment(session.startDate).format("DD/MM/YYYY"),
                    "startTime": moment(session.startDate).format("HH:mm"),//.getTime().format("HH:mm"),
                    "duration": new Date(session.timeCharged * 1000).toISOString().substr(11, 5),
                    "city": city,
                    "network": getNetwork(session),
                    "hwId": session.hwId,
                    "totalPower": totalPowerSession / 1000,
                    "charging_duration": new Date(timeChargedSession * 1000).toISOString().substr(11, 5),
                    "after_charging_duration": new Date(timeDuringParking * 1000).toISOString().substr(11, 5),
                    "use_energy": use_energy,
                    "use_time": use_time,
                    "opcFlatCost": activationFeeSession,
                    //"charging_parking": parkingDuringChargingSession,
                    "charging_parking": chargingTariff,
                    //"charging_after_parking": parkingAmountSession,
                    "charging_after_parking": parkingTariff,
                    "total_exc_vat": session.totalPrice.excl_vat,
                    "vat": parseFloat(session.fees.IVA * 100),
                    "total_inc_vat": session.totalPrice.incl_vat,
                    // "startDateTime": moment(session.startDate).format("DD/MM/YYYY HH:mm:ss"),
                    "startDateTime": moment.utc(session.startDate).format(),
                    // "endDateTime": moment(session.stopDate).format("DD/MM/YYYY HH:mm:ss"),
                    "endDateTime": moment.utc(session.stopDate).format(),
                    "durationMin": roundValue(session.timeCharged / 60),
                    "realTimeCharging": roundValue(realTimeCharging),
                    "averagePower": roundValue(averagePower),
                    "CO2emitted": session.CO2Saved,
                    "fleetName": fleet?.name ?? "-",
                    "licensePlate": licensePlate ?? "-",
                    "groupName": groupDrivers?.name ?? "-",
                    "userIdName": userInfo?.name ?? "-",
                    "userIdWillPayName": userWillPayInfo?.name ?? "-",
                    "parkingMin": roundValue(timeDuringParking / 60),
                    "tariffEnergy": roundValue(evioEnergyCost, 3),
                    "tariffTime": roundValue(evioTimeCost, 3),
                    "parkingDuringChargingTariff": parkingDuringChargingTariff,
                }

                let { invoiceCode, invoiceDescription } = getBillingCodesAndTotalPrices(session, totalPrices, attachLine)
                let invoiceLine = await getInvoiceLines(session, invoiceCode, invoiceDescription);
                lines.push(invoiceLine);

                // attachLines.push(attachLine);
                resolve(true);

            });

        })).then(() => {
            var footer = {
                total_exc_vat: total_exc_vat,
                total_inc_vat: total_inc_vat
            };
            let total_vat = total_inc_vat - total_exc_vat
            invoice.lines = lines;
            // others += activationFee;

            let evioTotalVat = totalPrices.evio.total_inc_vat - totalPrices.evio.total_exc_vat
            let otherTotalVat = totalPrices.other.total_inc_vat - totalPrices.other.total_exc_vat
            let hyundaiTotalVat = totalPrices.hyundai.total_inc_vat - totalPrices.hyundai.total_exc_vat
            let goChargeTotalVat = totalPrices.goCharge.total_inc_vat - totalPrices.goCharge.total_exc_vat
            let klcTotalVat = totalPrices.klc.total_inc_vat - totalPrices.klc.total_exc_vat
            let kintoTotalVat = totalPrices.kinto.total_inc_vat - totalPrices.kinto.total_exc_vat

            var body = {
                invoice: invoice,
                attach: {
                    overview: {
                        footer: footer,
                        lines: {
                            // evio_services: { total_exc_vat: roundValue(others), vat: roundValue(vatPriceEvio_services) },//todo review
                            evio_services: { total_exc_vat: 0, vat: 0 },//todo review
                            // evio_network: { total_exc_vat: roundValue((chargingSessionsEVIO.total_cost_excl_vat - others)), vat: roundValue(vatPriceEvio_network) },
                            evio_network: { total_exc_vat: totalPrices.evio.total_exc_vat, vat: evioTotalVat },
                            mobie_network: { total_exc_vat: 0, vat: 0 },
                            other_networks: { total_exc_vat: totalPrices.other.total_exc_vat, vat: otherTotalVat },
                            hyundai_network: { total_exc_vat: totalPrices.hyundai.total_exc_vat, vat: hyundaiTotalVat },
                            goCharge_network: { total_exc_vat: totalPrices.goCharge.total_exc_vat, vat: goChargeTotalVat },
                            klc_network: { total_exc_vat: totalPrices.klc.total_exc_vat, vat: klcTotalVat },
                            kinto_network: { total_exc_vat: totalPrices.kinto.total_exc_vat, vat: kintoTotalVat },
                        }
                    },
                    chargingSessions: {
                        header: getHeaders(totalPrices),
                        lines: getLines(totalPrices),
                        footer: getFooter(totalPrices)
                    }
                }
            };

            resolve(body);

        })
    });
}

function getInvoiceLines(session, code, description) {
    var context = "Function getLines";
    return new Promise((resolve, reject) => {

        let quantity = 1;
        // let unitPrice = parseFloat(session.totalPrice.excl_vat.toFixed(2));
        let unitPrice = session.totalPrice.incl_vat / (1 + session.fees.IVA);
        let uom = "UN";//'min'
        /*if (session.tariffId !== "-1") {
            switch (session.tariff.tariff.chargingAmount.uom.toUpperCase()) {
                case 'S':
                    quantity = session.timeCharged;
                    break;
                case 'MIN':
                    quantity = session.timeCharged / 60;
                    break;
                case 'H':
                    quantity = session.timeCharged / 3600;
                    break;
                case 'KWH':
                    quantity = session.totalPower / 1000;
                    break;
                default:
                    quantity = session.timeCharged / 60;
                    break;
            };
            unitPrice = session.tariff.tariff.chargingAmount.value;
            uom = session.tariff.tariff.chargingAmount.uom

        } else {
            quantity = session.timeCharged / 60;
        }

        quantity = parseFloat(quantity.toFixed(2));*/

        if (unitPrice > 0) {

            let line = {
                code,
                description,
                unitPrice: unitPrice,
                uom: uom,
                quantity: quantity,
                vat: session.fees.IVA,
                discount: 0,
                total: 0
            };
            if (session?.fees?.IVA == 0) {
                line.taxExemptionReasonCode = Constants.TAX_EXEMPTION_REASON_CODE_M40;
            }
            resolve([line]);

        }

        /*let line = {
            code: "ISERV21014",
            description: "Serviços rede EVIO",
            unitPrice: unitPrice,
            uom: uom,
            quantity: quantity,
            vat: session.fees.IVA,
            discount: 0,
            total: 0
        };*/

        //console.log("line", line);

        resolve([]);

        //console.log("session", session);

    });
};

function adjustLines(lines) {
    var context = "Function adjustLines";
    return new Promise(async (resolve, reject) => {

        let newInvoiceLines = [];
        //console.log("newInvoiceLines", newInvoiceLines);
        await lines.forEach(async line => {
            //console.log("Line", line);

            for (let index = 0; index < line.length; index++) {
                const obj = line[index];
                // console.log("obj", obj);

                let found = newInvoiceLines.indexOf(newInvoiceLines.find(newLine => {
                    return ((newLine.code === obj.code
                        && newLine.description === obj.description
                        && newLine.unitPrice === obj.unitPrice
                        && newLine.uom === obj.uom
                        && newLine.vat === obj.vat
                        && newLine.discount === obj.discount) ||
                        (newLine.code === obj.code
                            && newLine.description === obj.description
                            && newLine.quantity === 1
                            && newLine.uom === "UN"
                            && newLine.vat === obj.vat
                            && newLine.discount === obj.discount));
                }));

                if (found >= 0) {
                    //newInvoiceLines[found].quantity += 1;
                    if (line[index].uom === "UN") {
                        newInvoiceLines[found].unitPrice += line[index].unitPrice;
                    } else {
                        newInvoiceLines[found].quantity += line[index].quantity;
                    }
                }
                else {
                    newInvoiceLines.push(obj);
                }

            }

        });

        //console.log("newInvoiceLines 1", newInvoiceLines);
        resolve(newInvoiceLines);

    });
};

function joinInvoiceEVIOOCPI(body, invoiceEVIO) {
    var context = "Function joinInvoiceEVIOOCPI";
    return new Promise(async (resolve, reject) => {

        let lines = body.invoice.lines.concat(invoiceEVIO.invoice.lines);

        body.invoice.lines = await adjustLines(lines);

        var total_exc_vat = 0;
        var total_inc_vat = 0;
        body.invoice.lines.forEach(line => {
            total_exc_vat += line.quantity * line.unitPrice;
            total_inc_vat += line.quantity * line.unitPrice * (1 + line.vat);
        });
        //body.invoice.lines = lines;

        /*let totalEnergyMobie = body.attach.chargingSessions.header.mobie.totalEnergy.split(" ");
        let totalEnergyInternational = body.attach.chargingSessions.header.international.totalEnergy.split(" ");
        let totalEnergyOCPI = Number(totalEnergyMobie[0]) + Number(totalEnergyInternational[0]);
        let totalEnergyEVIO = invoiceEVIO.attach.chargingSessions.header.evio.totalEnergy.split(" ");
        let totalEnergy = totalEnergyOCPI + Number(totalEnergyEVIO[0]);

        let totalTimeMobie = Date.parse("1970-01-01T" + body.attach.chargingSessions.header.mobie.totalTime);
        let totalTimeInternational = Date.parse("1970-01-01T" + body.attach.chargingSessions.header.international.totalTime);
        //let totalTimeOCPI = Date.parse("1970-01-01T" + body.attach.chargingSessions.header.totalTime);
        let totalTimeEVIO = Date.parse("1970-01-01T" + invoiceEVIO.attach.chargingSessions.header.evio.totalTime);
        let totalTime = new Date(totalTimeMobie + totalTimeInternational + totalTimeEVIO).toISOString().substr(11, 8);
        */

        let chargingSessions;

        let mobieElementFound = body.attach.chargingSessions.lines.find(item => item.network === "mobie");
        let internationalElementFound = body.attach.chargingSessions.lines.find(item => item.network === "international");

        if (mobieElementFound && internationalElementFound) {

            chargingSessions = {
                header: {
                    // evio: invoiceEVIO.attach.chargingSessions.header.evio,
                    ...invoiceEVIO.attach.chargingSessions.header,
                    international: body.attach.chargingSessions.header.international,
                    mobie: body.attach.chargingSessions.header.mobie,
                    //sessions: body.attach.chargingSessions.header.sessions + invoiceEVIO.attach.chargingSessions.header.sessions,
                    //totalTime: totalTime,
                    //totalEnergy: totalEnergy + " KWh",
                },
                lines: [
                    // { evio: invoiceEVIO.attach.chargingSessions.lines[0].evio },
                    ...invoiceEVIO.attach.chargingSessions.lines,
                    { international: internationalElementFound.values },
                    { mobie: mobieElementFound.values },
                ],
                footer: {
                    // evio: invoiceEVIO.attach.chargingSessions.footer.evio,
                    ...invoiceEVIO.attach.chargingSessions.footer,
                    international: body.attach.chargingSessions.footer.international,
                    mobie: body.attach.chargingSessions.footer.mobie,
                },
                summaryAddress: {
                    international: body.attach.chargingSessions.summaryAddress.international,
                    mobie: body.attach.chargingSessions.summaryAddress.mobie,
                },
                unitPricesSummary: {
                    mobie: body.attach.chargingSessions.unitPricesSummary.mobie,
                },
            }

        } else if (mobieElementFound) {

            chargingSessions = {
                header: {
                    // evio: invoiceEVIO.attach.chargingSessions.header.evio,
                    ...invoiceEVIO.attach.chargingSessions.header,
                    mobie: body.attach.chargingSessions.header.mobie
                },
                lines: [
                    // { evio: invoiceEVIO.attach.chargingSessions.lines[0].evio },
                    ...invoiceEVIO.attach.chargingSessions.lines,
                    { mobie: mobieElementFound.values }
                ],
                footer: {
                    // evio: invoiceEVIO.attach.chargingSessions.footer.evio,
                    ...invoiceEVIO.attach.chargingSessions.footer,
                    mobie: body.attach.chargingSessions.footer.mobie
                },
                summaryAddress: {
                    mobie: body.attach.chargingSessions.summaryAddress.mobie,
                },
                unitPricesSummary: {
                    mobie: body.attach.chargingSessions.unitPricesSummary.mobie,
                },
            }

        } else if (internationalElementFound) {

            chargingSessions = {
                header: {
                    // evio: invoiceEVIO.attach.chargingSessions.header.evio,
                    ...invoiceEVIO.attach.chargingSessions.header,
                    international: body.attach.chargingSessions.header.international
                },
                lines: [
                    // { evio: invoiceEVIO.attach.chargingSessions.lines[0].evio },
                    ...invoiceEVIO.attach.chargingSessions.lines,
                    { international: internationalElementFound.values }
                ],
                footer: {
                    // evio: invoiceEVIO.attach.chargingSessions.footer.evio,
                    ...invoiceEVIO.attach.chargingSessions.footer,
                    international: body.attach.chargingSessions.footer.international
                },
                summaryAddress: {
                    international: body.attach.chargingSessions.summaryAddress.international,
                }
            }

        } else {

            chargingSessions = {
                header: {
                    // evio: invoiceEVIO.attach.chargingSessions.header.evio
                    ...invoiceEVIO.attach.chargingSessions.header,
                },
                lines: [
                    // { evio: invoiceEVIO.attach.chargingSessions.lines[0].evio }
                    ...invoiceEVIO.attach.chargingSessions.lines,
                ],
                footer: {
                    // evio: invoiceEVIO.attach.chargingSessions.footer.evio
                    ...invoiceEVIO.attach.chargingSessions.footer,
                }
            }

        }

        var finalInvoice = {
            invoice: body.invoice,
            attach: {
                overview: {
                    footer: {
                        total_exc_vat: total_exc_vat,
                        total_inc_vat: total_inc_vat
                    },
                    lines: {
                        evio_services: {
                            total_exc_vat: (body.attach.overview.lines.evio_services.total_exc_vat + invoiceEVIO.attach.overview.lines.evio_services.total_exc_vat),
                            vat: body.attach.overview.lines.evio_services.vat
                        },
                        evio_network: {
                            total_exc_vat: invoiceEVIO.attach.overview.lines.evio_network.total_exc_vat,
                            vat: invoiceEVIO.attach.overview.lines.evio_network.vat
                        },
                        mobie_network: {
                            total_exc_vat: body.attach.overview.lines.mobie_network.total_exc_vat,
                            vat: body.attach.overview.lines.mobie_network.vat
                        },
                        other_networks: {
                            total_exc_vat: body.attach.overview.lines.other_networks.total_exc_vat + invoiceEVIO.attach.overview.lines.other_networks.total_exc_vat,
                            vat: body.attach.overview.lines.other_networks.vat + invoiceEVIO.attach.overview.lines.other_networks.vat
                        },
                        hyundai_network: {
                            total_exc_vat: invoiceEVIO.attach.overview.lines.hyundai_network.total_exc_vat,
                            vat: invoiceEVIO.attach.overview.lines.hyundai_network.vat
                        },
                        goCharge_network: {
                            total_exc_vat: invoiceEVIO.attach.overview.lines.goCharge_network.total_exc_vat,
                            vat: invoiceEVIO.attach.overview.lines.goCharge_network.vat
                        },
                        klc_network: {
                            total_exc_vat: invoiceEVIO.attach.overview.lines.klc_network.total_exc_vat,
                            vat: invoiceEVIO.attach.overview.lines.klc_network.vat
                        },
                        kinto_network: {
                            total_exc_vat: invoiceEVIO.attach.overview.lines.kinto_network.total_exc_vat,
                            vat: invoiceEVIO.attach.overview.lines.kinto_network.vat
                        },
                    }
                },
                chargingSessions: chargingSessions
            }
        }

        resolve(finalInvoice);

    });
};

function adjustOCPIChargingSessions(invoiceOCPI) {
    var context = "Function adjustOCPIChargingSessions";
    return new Promise((resolve, reject) => {

        let lines = [];
        invoiceOCPI.attach.chargingSessions.lines.forEach(element => {

            if (element.network === "mobie") {

                lines.push({
                    "mobie": element.values
                })

            } else if (element.network === "international") {

                lines.push({
                    "international": element.values
                })

            }

        });

        invoiceOCPI.attach.chargingSessions.lines = lines;
        resolve(invoiceOCPI);

    });

}

function sendToBilling(host, data, headers, sessionsIds) {
    var context = "Function sendToBilling";
    return new Promise((resolve, reject) => {

        if (sessionsIds.length > 0) {

            let sessionsEVIO = getSessionsIds(sessionsIds.filter(session => {
                return session.chargerType !== "004" && session.chargerType !== "010" && session.chargerType !== Enums.ChargerTypes.Hubject
            }));

            let sessionsOCPI = getSessionsIds(sessionsIds.filter(session => {
                return session.chargerType === "004" || session.chargerType === "010" || session.chargerType === Enums.ChargerTypes.Hubject
            }));

            //console.log("sessionsEVIO", sessionsEVIO);
            //console.log("sessionsOCPI", sessionsOCPI);

            // let host = process.env.HostBilling + process.env.PathGeneratePeriodBilling;

            // axios.post(host, data, { headers: { 'userid': userId } })
            axios.post(host, data, { headers })
                .then((response) => {

                    if (typeof response.data !== 'undefined') {

                        if (sessionsEVIO.length > 0)
                            updateMultiSessionEVIO(sessionsEVIO, { invoiceId: response.data.invoiceId, status: true });
                        if (sessionsOCPI.length > 0)
                            updateMultiSessionOCPI(sessionsOCPI, { invoiceId: response.data.invoiceId, status: true });

                        updatePaymentInvoiceId(data.invoice.paymentId, response.data.invoiceId)
                        resolve(response.data);

                    }
                    else {
                        // removePayment(data.invoice.paymentId)
                        // updatePaymentInvoiceId(data.invoice.paymentId , "")

                        // if (sessionsEVIO.length > 0)
                        //     updateMultiSessionEVIO(sessionsEVIO, { invoiceId: "", status: false });
                        // if (sessionsOCPI.length > 0)
                        //     updateMultiSessionOCPI(sessionsOCPI, { invoiceId: "", status: false });

                        resolve(false);
                    }

                }).catch((error) => {
                    // removePayment(data.invoice.paymentId)
                    // updatePaymentInvoiceId(data.invoice.paymentId , "")

                    if (sessionsEVIO.length > 0 || sessionsOCPI.length > 0) {
                        // updateMultiSessionEVIO(sessionsEVIO, { invoiceId: "", status: false });

                        // if (sessionsOCPI.length > 0)
                        // updateMultiSessionOCPI(sessionsOCPI, { invoiceId: "", status: false });

                        if (error.response) {
                            console.error(`[${context}][400] Error `, error.response.data.message);
                        }
                        reject(error);
                    }
                    else {
                        console.error(`[${context}][500] Error `, error.message);
                        reject(error);
                    };

                    reject();
                });

            resolve(true);

        }
        else {

            console.error(`[${context}][400] Error `, "No session ids to process");
            reject({ message: "No session ids to process" });

        }

    });
}

function getSessionsIds(sessions) {
    var context = "Function getSessionsIds";
    let sessionsId = [];
    if (sessions.length > 0) {

        sessions.forEach(session => {
            sessionsId.push(session.sessionId)
        });
        return sessionsId;

    }
    else {
        return sessionsId;
    }
};

function updateMultiSessionEVIO(sessions, invoice) {
    var context = "Function updateMultiSessionEVIO";
    try {

        let params = {
            _id: sessions
        };

        let data = {
            invoiceId: invoice.invoiceId,
            invoiceStatus: invoice.status
        };

        let proxyCharger = process.env.ChargersServiceProxy + process.env.PathUpdateSessionInvoice;

        axios.patch(proxyCharger, data, { params })
            .then(() => {
                //console.log("Result: ", result.data);
                console.log("Updated session invoice status");
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
            });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);

    };
};

function updateMultiSessionOCPI(sessions, invoice) {
    var context = "Function updateMultiSessionOCPI";
    try {

        let data = {
            invoiceId: invoice.invoiceId,
            invoiceStatus: invoice.status,
            sessionId: sessions
        };

        let host = process.env.HostChargingSessionMobie + process.env.PathInvoiceStatusMonthlyBilling;

        axios.put(host, data)
            .then(() => {
                //console.log("Result: ", result.data);
                console.log("Updated session invoice status");
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
            });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);

    };
};

async function startPeriodBillingJobs() {
    var context = "Function startPeriodBillingJobs";
    try {
        let allPeriodBillings = await PeriodBillingRoutines.find({})
        for (let periodBilling of allPeriodBillings) {
            let billingPeriods = periodBilling.billingPeriods
            let timer = periodBilling.timer
            taskPeriodBilling[timer] = { billingPeriods }
            initJobPeriodBilling(timer, billingPeriods)
                .then((timer) => {
                    taskPeriodBilling[timer]["job"].start();
                    console.log("Check Period Billing Job Started " + timer);
                })
                .catch(error => {
                    console.log("Error starting check Period Billing Job: " + error.message);
                });
        }

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

async function createDefaultBillingPeriodJobs(jobsObject) {
    var context = "Function createDefaultBillingPeriodJobs";
    try {

        for (let timer in jobsObject) {
            let billingPeriods = jobsObject[timer].billingPeriods
            let found = await PeriodBillingRoutines.findOne({ timer })
            if (!found) {
                let newPeriodBilling = new PeriodBillingRoutines({ timer, billingPeriods })
                await PeriodBillingRoutines.create(newPeriodBilling)
            } else {
                console.log("Job already exist with that timer")

            }
        }

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

function roundValue(value, decimals = 2) {
    return Number(value.toFixed(decimals))
}

function makePaymentMonthly(sessions, userId, listOfSessionsMonthly) {
    var context = "Function makePaymentMonthly";
    return new Promise((resolve, reject) => {

        let host = process.env.HostPayments + process.env.PathPaymentMonthly;

        let data = {
            userId: userId,
            listOfSessionsMonthly: listOfSessionsMonthly,
            //status: "20",
            totalPrice: {
                excl_vat: sessions.total_exc_vat,
                incl_vat: sessions.total_inc_vat
            },
            amount: {
                currency: "EUR",
                value: sessions.total_inc_vat
            },
            paymentMethod: "other"
        };

        axios.post(host, data)
            .then((response) => {

                resolve(response.data);

            })
            .catch(error => {
                console.error(`[${context}][.catch] Error `, error.message);
                reject({});
            });


    });
};

async function updatePaymentInvoiceId(paymentId, invoiceId) {
    context = "function updatePaymentInvoiceId"
    try {
        if (!paymentId) {
            return {}
        }
        let host = process.env.HostPayments + process.env.PathPaymentInvoiceId;
        let body = {
            paymentId,
            invoiceId
        }
        let resp = await axios.patch(host, body)
        if (resp.data) {
            return resp.data
        } else {
            return {}
        }
    } catch (error) {
        console.error(`[${context}][.catch] Error `, error.message);
        return {}
    }
}

async function removePayment(paymentId) {
    context = "function removePayment"
    try {
        if (!paymentId) {
            return {}
        }
        let host = process.env.HostPayments + process.env.PathRemovePayment;
        let body = {
            paymentId
        }
        let resp = await axios.patch(host, body)
        if (resp.data) {
            return resp.data
        } else {
            return {}
        }
    } catch (error) {
        console.error(`[${context}][.catch] Error `, error.message);
        return {}
    }
}

async function getEvDetails(evId) {
    let context = "Function getEvDetails";
    try {
        let proxyEV = process.env.EVsHost + process.env.PathGetEVDetails;
        let params = {
            _id: evId
        };

        let foundEv = await axios.get(proxyEV, { params })
        return foundEv.data ? foundEv.data : null
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    }
}

async function getFleetDetails(fleetId) {
    let context = "Function getFleetDetails";
    try {
        let proxyEV = process.env.EVsHost + process.env.PathGetFleetById;
        let params = {
            _id: fleetId
        };

        let foundFleet = await axios.get(proxyEV, { params })
        return foundFleet.data ? foundFleet.data : null
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    }
}

async function getUserInfo(userId) {
    let context = "Function getUserInfo";
    try {
        const params = {
            _id: userId,
        }
        let host = process.env.IdentityHost + process.env.PathGetUserById
        let foundUser = await axios.get(host, { params })
        return foundUser.data ? foundUser.data : null
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null

    }
}

async function sendFinalInvoice(sessionsEVIO, sessionsOCPI, userId, invoiceWithoutPayment, timer, start_date_time, end_date_time, billingPeriod,
                                host, headers, emailList,billingProfile, optionalCountryCodeToVAT, docNumber) {
    let context = "Function sendFinalInvoice";
    try {
        let sessionsIds = [];
        let invoiceEVIO;
        let finalInvoice;
        let totalPrice

        if (sessionsEVIO && sessionsOCPI) {
            console.log(`${context} In sessionsEVIO && sessionsOCPI`)

            sessionsIds = sessionsEVIO.sessionsId.concat(sessionsOCPI.sessionIds);

            invoiceEVIO = await createEVIOInvoiceObj(sessionsEVIO, userId);

            finalInvoice = await joinInvoiceEVIOOCPI(sessionsOCPI.body, invoiceEVIO);

            finalInvoice.invoice.paymentIdList = finalInvoice.invoice.paymentIdList.concat(sessionsEVIO.paymentIds);

            totalPrice = finalInvoice.attach.overview.footer;

        } else if (sessionsEVIO) {
            console.log(`${context} In sessionsEVIO`)

            sessionsIds = sessionsEVIO.sessionsId

            finalInvoice = await createEVIOInvoiceObj(sessionsEVIO, userId);

            finalInvoice.invoice.lines = await adjustLines(finalInvoice.invoice.lines);

            finalInvoice.invoice.paymentIdList = finalInvoice.invoice.paymentIdList.concat(sessionsEVIO.paymentIds);

            totalPrice = finalInvoice.attach.overview.footer;
        } else if (sessionsOCPI) {
            console.log(`${context} In sessionsOCPI`)

            sessionsIds = sessionsOCPI.sessionIds;

            finalInvoice = sessionsOCPI.body;

            finalInvoice.invoice.lines = await adjustLines(finalInvoice.invoice.lines);

            finalInvoice = await adjustOCPIChargingSessions(finalInvoice);

            totalPrice = finalInvoice.attach.overview.footer;


        } else {
            //resolve();
            return;
        }

        finalInvoice.documentNumber = docNumber;

        if (optionalCountryCodeToVAT) {
            console.debug(`[${context}] optionalCountryCodeToVAT: ${optionalCountryCodeToVAT}`);
            finalInvoice.optionalCountryCodeToVAT = optionalCountryCodeToVAT;
        }

        //console.log("Final Invoice");
        //console.log(JSON.stringify(finalInvoice));
        let payment = null
        if (invoiceWithoutPayment && totalPrice) {

            payment = await makePaymentMonthly(totalPrice, userId, sessionsIds)
            if (payment) {
                finalInvoice.invoice.paymentId = payment._id
                finalInvoice.invoice.paymentIdList.push(payment._id)
            }
        }

        console.log("emailList")
        console.log(emailList)

        console.log("finalInvoice")
        console.log(finalInvoice)

        if (emailList) {
            finalInvoice.emailUserId = emailList
        }

        finalInvoice.billingProfile = billingProfile
        if ((invoiceWithoutPayment && payment) || (!invoiceWithoutPayment && !payment)) {
            if (finalInvoice) {
                finalInvoice.invoice.billingPeriodDates = getBillingPeriodDates(timer, start_date_time, end_date_time, billingPeriod)
            }

            console.log("finalInvoice")
            console.log(JSON.stringify(finalInvoice))

            sendToBilling(host, finalInvoice, headers, sessionsIds)
                .then(() => {

                    console.log("Monthly billing user processed with success");
                    //resolve();
                    return;

                }).catch((error) => {

                    if (error.response) {

                        console.error(`[${context}][sendToBilling] Error `, error.response.data.message);
                        //reject();
                        return;

                    }
                    else {

                        console.error(`[${context}][sendToBilling] Error `, error.message);
                        //reject();
                        return;

                    };

                });
        } else {
            //reject();
            return;
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        //reject(error);
        return;
    }
}

function getBillingCodesAndTotalPrices(session, totalPrices, line) {
    var context = "Function getBillingCodesAndTotalPrices";

    try {
        if (session.clientName === process.env.clientNameEVIO) {
            if (process.env.WhiteLabelChargerType.includes(session.chargerType)) {
                totalPrices.other.total_inc_vat += session.totalPrice.incl_vat
                totalPrices.other.total_exc_vat += (session.totalPrice.incl_vat / (1 + session.fees.IVA))
                totalPrices.other.totalTime += session.timeCharged;
                totalPrices.other.totalPower += session.totalPower / 1000;
                totalPrices.other.numberSessions += 1
                totalPrices.other.attachLines.push(line)
                return {
                    invoiceCode: process.env.OtherNetworksInvoiceCode,
                    invoiceDescription: process.env.OtherNetworksInvoiceDescription
                }
            } else {
                totalPrices.evio.total_inc_vat += session.totalPrice.incl_vat
                totalPrices.evio.total_exc_vat += (session.totalPrice.incl_vat / (1 + session.fees.IVA))
                totalPrices.evio.totalTime += session.timeCharged;
                totalPrices.evio.totalPower += session.totalPower / 1000;
                totalPrices.evio.numberSessions += 1
                totalPrices.evio.attachLines.push(line)
                return {
                    invoiceCode: process.env.EVIOInvoiceCode,
                    invoiceDescription: process.env.EVIOInvoiceDescription
                }
            }
        } else if (session.clientName === process.env.clientNameHyundai) {
            if (process.env.WhiteLabelChargerType.includes(session.chargerType)) {
                if (session.chargerType === process.env.chargerTypeHyundai) {
                    totalPrices.hyundai.total_inc_vat += session.totalPrice.incl_vat
                    totalPrices.hyundai.total_exc_vat += (session.totalPrice.incl_vat / (1 + session.fees.IVA))
                    totalPrices.hyundai.totalTime += session.timeCharged;
                    totalPrices.hyundai.totalPower += session.totalPower / 1000;
                    totalPrices.hyundai.numberSessions += 1
                    totalPrices.hyundai.attachLines.push(line)
                    return {
                        invoiceCode: process.env.HyundaiInvoiceCode,
                        invoiceDescription: process.env.HyundaiInvoiceDescription
                    }
                } else {
                    totalPrices.other.total_inc_vat += session.totalPrice.incl_vat
                    totalPrices.other.total_exc_vat += (session.totalPrice.incl_vat / (1 + session.fees.IVA))
                    totalPrices.other.totalTime += session.timeCharged;
                    totalPrices.other.totalPower += session.totalPower / 1000;
                    totalPrices.other.numberSessions += 1
                    totalPrices.other.attachLines.push(line)
                    return {
                        invoiceCode: process.env.OtherNetworksInvoiceCode,
                        invoiceDescription: process.env.OtherNetworksInvoiceDescription
                    }
                }
            } else {
                totalPrices.evio.total_inc_vat += session.totalPrice.incl_vat
                totalPrices.evio.total_exc_vat += (session.totalPrice.incl_vat / (1 + session.fees.IVA))
                totalPrices.evio.totalTime += session.timeCharged;
                totalPrices.evio.totalPower += session.totalPower / 1000;
                totalPrices.evio.numberSessions += 1
                totalPrices.evio.attachLines.push(line)
                return {
                    invoiceCode: process.env.EVIOInvoiceCode,
                    invoiceDescription: process.env.EVIOInvoiceDescription
                }
            }
        } else if (session.clientName === process.env.clientNameSC) {
            if (process.env.WhiteLabelChargerType.includes(session.chargerType)) {
                if (session.chargerType === process.env.chargerTypeGoCharge) {
                    totalPrices.goCharge.total_inc_vat += session.totalPrice.incl_vat
                    totalPrices.goCharge.total_exc_vat += (session.totalPrice.incl_vat / (1 + session.fees.IVA))
                    totalPrices.goCharge.totalTime += session.timeCharged;
                    totalPrices.goCharge.totalPower += session.totalPower / 1000;
                    totalPrices.goCharge.numberSessions += 1
                    totalPrices.goCharge.attachLines.push(line)
                    return {
                        invoiceCode: process.env.GoChargeInvoiceCode,
                        invoiceDescription: process.env.GoChargeInvoiceDescription
                    }
                } else {
                    totalPrices.other.total_inc_vat += session.totalPrice.incl_vat
                    totalPrices.other.total_exc_vat += (session.totalPrice.incl_vat / (1 + session.fees.IVA))
                    totalPrices.other.totalTime += session.timeCharged;
                    totalPrices.other.totalPower += session.totalPower / 1000;
                    totalPrices.other.numberSessions += 1
                    totalPrices.other.attachLines.push(line)
                    return {
                        invoiceCode: process.env.OtherNetworksInvoiceCode,
                        invoiceDescription: process.env.OtherNetworksInvoiceDescription
                    }
                }
            } else {
                totalPrices.evio.total_inc_vat += session.totalPrice.incl_vat
                totalPrices.evio.total_exc_vat += (session.totalPrice.incl_vat / (1 + session.fees.IVA))
                totalPrices.evio.totalTime += session.timeCharged;
                totalPrices.evio.totalPower += session.totalPower / 1000;
                totalPrices.evio.numberSessions += 1
                totalPrices.evio.attachLines.push(line)
                return {
                    invoiceCode: process.env.EVIOInvoiceCode,
                    invoiceDescription: process.env.EVIOInvoiceDescription
                }
            }
        } else if (session.clientName === process.env.WhiteLabelKLC) {
            if (process.env.WhiteLabelChargerType.includes(session.chargerType)) {
                if (session.chargerType === process.env.chargerTypeKLC) {
                    totalPrices.klc.total_inc_vat += session.totalPrice.incl_vat
                    totalPrices.klc.total_exc_vat += (session.totalPrice.incl_vat / (1 + session.fees.IVA))
                    totalPrices.klc.totalTime += session.timeCharged;
                    totalPrices.klc.totalPower += session.totalPower / 1000;
                    totalPrices.klc.numberSessions += 1
                    totalPrices.klc.attachLines.push(line)
                    return {
                        invoiceCode: process.env.KLCInvoiceCode,
                        invoiceDescription: process.env.KLCInvoiceDescription
                    }
                } else {
                    totalPrices.other.total_inc_vat += session.totalPrice.incl_vat
                    totalPrices.other.total_exc_vat += (session.totalPrice.incl_vat / (1 + session.fees.IVA))
                    totalPrices.other.totalTime += session.timeCharged;
                    totalPrices.other.totalPower += session.totalPower / 1000;
                    totalPrices.other.numberSessions += 1
                    totalPrices.other.attachLines.push(line)
                    return {
                        invoiceCode: process.env.OtherNetworksInvoiceCode,
                        invoiceDescription: process.env.OtherNetworksInvoiceDescription
                    }
                }
            } else {
                totalPrices.evio.total_inc_vat += session.totalPrice.incl_vat
                totalPrices.evio.total_exc_vat += (session.totalPrice.incl_vat / (1 + session.fees.IVA))
                totalPrices.evio.totalTime += session.timeCharged;
                totalPrices.evio.totalPower += session.totalPower / 1000;
                totalPrices.evio.numberSessions += 1
                totalPrices.evio.attachLines.push(line)
                return {
                    invoiceCode: process.env.EVIOInvoiceCode,
                    invoiceDescription: process.env.EVIOInvoiceDescription
                }
            }
        } else if (session.clientName === process.env.WhiteLabelKinto) {
            if (process.env.WhiteLabelChargerType.includes(session.chargerType)) {
                if (session.chargerType === process.env.chargerTypeKinto) {
                    totalPrices.kinto.total_inc_vat += session.totalPrice.incl_vat
                    totalPrices.kinto.total_exc_vat += (session.totalPrice.incl_vat / (1 + session.fees.IVA))
                    totalPrices.kinto.totalTime += session.timeCharged;
                    totalPrices.kinto.totalPower += session.totalPower / 1000;
                    totalPrices.kinto.numberSessions += 1
                    totalPrices.kinto.attachLines.push(line)
                    return {
                        invoiceCode: process.env.KintoInvoiceCode,
                        invoiceDescription: process.env.KintoInvoiceDescription
                    }
                } else {
                    totalPrices.other.total_inc_vat += session.totalPrice.incl_vat
                    totalPrices.other.total_exc_vat += (session.totalPrice.incl_vat / (1 + session.fees.IVA))
                    totalPrices.other.totalTime += session.timeCharged;
                    totalPrices.other.totalPower += session.totalPower / 1000;
                    totalPrices.other.numberSessions += 1
                    totalPrices.other.attachLines.push(line)
                    return {
                        invoiceCode: process.env.OtherNetworksInvoiceCode,
                        invoiceDescription: process.env.OtherNetworksInvoiceDescription
                    }
                }
            } else {
                totalPrices.evio.total_inc_vat += session.totalPrice.incl_vat
                totalPrices.evio.total_exc_vat += (session.totalPrice.incl_vat / (1 + session.fees.IVA))
                totalPrices.evio.totalTime += session.timeCharged;
                totalPrices.evio.totalPower += session.totalPower / 1000;
                totalPrices.evio.numberSessions += 1
                totalPrices.evio.attachLines.push(line)
                return {
                    invoiceCode: process.env.EVIOInvoiceCode,
                    invoiceDescription: process.env.EVIOInvoiceDescription
                }
            }
        } else {
            totalPrices.evio.total_inc_vat += session.totalPrice.incl_vat
            totalPrices.evio.total_exc_vat += (session.totalPrice.incl_vat / (1 + session.fees.IVA))
            totalPrices.evio.totalTime += session.timeCharged;
            totalPrices.evio.totalPower += session.totalPower / 1000;
            totalPrices.evio.numberSessions += 1
            totalPrices.evio.attachLines.push(line)
            return {
                invoiceCode: process.env.EVIOInvoiceCode,
                invoiceDescription: process.env.EVIOInvoiceDescription
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        totalPrices.evio.total_inc_vat += session.totalPrice.incl_vat
        totalPrices.evio.total_exc_vat += (session.totalPrice.incl_vat / (1 + session.fees.IVA))
        totalPrices.evio.totalTime += session.timeCharged;
        totalPrices.evio.totalPower += session.totalPower / 1000;
        totalPrices.evio.numberSessions += 1
        totalPrices.evio.attachLines.push(line)
        return {
            invoiceCode: process.env.EVIOInvoiceCode,
            invoiceDescription: process.env.EVIOInvoiceDescription
        }
    }
}

function getLines(totalPrices) {
    let lines = []
    for (let key in totalPrices) {
        let networkObj = totalPrices[key]
        if (networkObj.numberSessions > 0) {
            let line = {}
            line[key] = totalPrices[key].attachLines.sort((a, b) => moment(a.startDateTime) - moment(b.startDateTime))
            lines.push(line)
        }
    }
    return lines

}
function getHeaders(totalPrices) {
    let headers = {}
    for (let key in totalPrices) {
        let networkObj = totalPrices[key]
        if (networkObj.numberSessions > 0) {
            headers[key] = {
                sessions: networkObj.numberSessions,
                totalTime: new Date(networkObj.totalTime * 1000).toISOString().substr(11, 8),
                totalEnergy: roundValue(networkObj.totalPower) + " kWh"
            }
        }
    }
    return headers
}

function getFooter(totalPrices) {
    let footer = {}
    for (let key in totalPrices) {
        let networkObj = totalPrices[key]
        if (networkObj.numberSessions > 0) {
            footer[key] = {
                total_exc_vat: networkObj.total_exc_vat,
                total_inc_vat: networkObj.total_inc_vat
            };
        }
    }
    return footer
}

function getNetwork(session) {
    try {
        if (session.chargerType === process.env.chargerTypeGoCharge) {
            return "Go.Charge"
        } else if (session.chargerType === process.env.chargerTypeHyundai) {
            return "Hyundai"
        } else if (session.chargerType === process.env.chargerTypeKLC) {
            return process.env.NetworkKLC
        } else if (session.chargerType === process.env.chargerTypeKinto) {
            return process.env.NetworkKinto
        } else {
            return "EVIO"
        }
    } catch (error) {
        return "EVIO"
    }
}

async function parseSessions(sessionsEVIO, sessionsOCPI, userId, invoiceWithoutPayment, timer, start_date_time, end_date_time, billingPeriod,
                             host, headers, billingProfile, optionalCountryCodeToVAT) {
    //INVOICE_INCLUDED
    let sessionsEVIOIncluded = null
    let sessionsOCPIIncluded = null

    sessionsEVIOIncluded = {
        'total_cost_excl_vat': 0,
        'total_cost_incl_vat': 0,
        'sessionsId': [],
        'sessionsList': [],
        'paymentIds': []
    }

    sessionsOCPIIncluded = []



    //INVOICE_INDIVIDUAL
    let evIdsDriverOnly = []
    let sessionsEVIOEVDriverOnly = []
    let sessionsOCPIEVDriverOnly = []

    let evIdsCompanyOnly = []
    let sessionsEVIOEVCompanyOnly = []
    let sessionsOCPIEVCompanyOnly = []

    let evIdsDriveCompany = []
    let sessionsEVIOEVDriveCompany = []
    let sessionsOCPIEVDriveCompany = []


    //Debug logs
    //console.log("sessionsEVIO")
    //console.log(sessionsEVIO)

    //console.log("sessionsOCPI")
    //console.log(sessionsOCPI)

    //parse sessions
    if (sessionsEVIO)
        for (let i = 0; i != sessionsEVIO.sessionsList.length; i++) {
            if (sessionsEVIO.sessionsList[i].invoiceType == 'INVOICE_INDIVIDUAL') {
                if (sessionsEVIO.sessionsList[i].invoiceCommunication == 'ONLY_DRIVER') {
                    let index = evIdsDriverOnly.indexOf(sessionsEVIO.sessionsList[i].evId)

                    if (index == -1) {
                        evIdsDriverOnly.push(sessionsEVIO.sessionsList[i].evId)
                        sessionsEVIOEVDriverOnly.push({
                            'total_cost_excl_vat': 0,
                            'total_cost_incl_vat': 0,
                            'sessionsId': [],
                            'sessionsList': [],
                            'paymentIds': []
                        })
                        sessionsOCPIEVDriverOnly.push([])
                        index = evIdsDriverOnly.length - 1;
                    }

                    if (sessionsEVIO.sessionsList[i].totalPrice) {
                        if (sessionsEVIO.sessionsList[i].totalPrice.excl_vat)
                            sessionsEVIOEVDriverOnly[index].total_cost_excl_vat += sessionsEVIO.sessionsList[i].totalPrice.excl_vat
                        if (sessionsEVIO.sessionsList[i].totalPrice.incl_vat)
                            sessionsEVIOEVDriverOnly[index].total_cost_incl_vat += sessionsEVIO.sessionsList[i].totalPrice.incl_vat
                    }

                    if (sessionsEVIO.sessionsList[i].chargerType)
                        sessionsEVIOEVDriverOnly[index].sessionsId.push({ 'sessionId': sessionsEVIO.sessionsList[i]._id, 'chargerType': sessionsEVIO.sessionsList[i].chargerType })

                    sessionsEVIOEVDriverOnly[index].sessionsList.push(sessionsEVIO.sessionsList[i])

                    if (sessionsEVIO.sessionsList[i].paymentId)
                        sessionsEVIOEVDriverOnly[index].paymentIds.push(sessionsEVIO.sessionsList[i].paymentId)
                }
                else if (sessionsEVIO.sessionsList[i].invoiceCommunication == 'ONLY_COMPANY') {
                    let index = evIdsCompanyOnly.indexOf(sessionsEVIO.sessionsList[i].evId)

                    if (index == -1) {
                        evIdsCompanyOnly.push(sessionsEVIO.sessionsList[i].evId)
                        sessionsEVIOEVCompanyOnly.push({
                            'total_cost_excl_vat': 0,
                            'total_cost_incl_vat': 0,
                            'sessionsId': [],
                            'sessionsList': [],
                            'paymentIds': []
                        })
                        sessionsOCPIEVCompanyOnly.push([])
                        index = evIdsCompanyOnly.length - 1;
                    }

                    if (sessionsEVIO.sessionsList[i].totalPrice) {
                        if (sessionsEVIO.sessionsList[i].totalPrice.excl_vat)
                            sessionsEVIOEVCompanyOnly[index].total_cost_excl_vat += sessionsEVIO.sessionsList[i].totalPrice.excl_vat
                        if (sessionsEVIO.sessionsList[i].totalPrice.incl_vat)
                            sessionsEVIOEVCompanyOnly[index].total_cost_incl_vat += sessionsEVIO.sessionsList[i].totalPrice.incl_vat
                    }

                    if (sessionsEVIO.sessionsList[i].chargerType)
                        sessionsEVIOEVCompanyOnly[index].sessionsId.push({ 'sessionId': sessionsEVIO.sessionsList[i]._id, 'chargerType': sessionsEVIO.sessionsList[i].chargerType })

                    sessionsEVIOEVCompanyOnly[index].sessionsList.push(sessionsEVIO.sessionsList[i])

                    if (sessionsEVIO.sessionsList[i].paymentId)
                        sessionsEVIOEVCompanyOnly[index].paymentIds.push(sessionsEVIO.sessionsList[i].paymentId)

                }
                else if (sessionsEVIO.sessionsList[i].invoiceCommunication == 'DRIVER_COMPANY') {
                    let index = evIdsDriveCompany.indexOf(sessionsEVIO.sessionsList[i].evId)

                    if (index == -1) {
                        evIdsDriveCompany.push(sessionsEVIO.sessionsList[i].evId)
                        sessionsEVIOEVDriveCompany.push({
                            'total_cost_excl_vat': 0,
                            'total_cost_incl_vat': 0,
                            'sessionsId': [],
                            'sessionsList': [],
                            'paymentIds': []
                        })
                        sessionsOCPIEVDriveCompany.push([])
                        index = evIdsDriveCompany.length - 1;
                    }

                    if (sessionsEVIO.sessionsList[i].totalPrice) {
                        if (sessionsEVIO.sessionsList[i].totalPrice.excl_vat)
                            sessionsEVIOEVDriveCompany[index].total_cost_excl_vat += sessionsEVIO.sessionsList[i].totalPrice.excl_vat
                        if (sessionsEVIO.sessionsList[i].totalPrice.incl_vat)
                            sessionsEVIOEVDriveCompany[index].total_cost_incl_vat += sessionsEVIO.sessionsList[i].totalPrice.incl_vat
                    }

                    if (sessionsEVIO.sessionsList[i].chargerType)
                        sessionsEVIOEVDriveCompany[index].sessionsId.push({ 'sessionId': sessionsEVIO.sessionsList[i]._id, 'chargerType': sessionsEVIO.sessionsList[i].chargerType })

                    sessionsEVIOEVDriveCompany[index].sessionsList.push(sessionsEVIO.sessionsList[i])

                    if (sessionsEVIO.sessionsList[i].paymentId)
                        sessionsEVIOEVDriveCompany[index].paymentIds.push(sessionsEVIO.sessionsList[i].paymentId)
                }
                else {

                    if (sessionsEVIO.sessionsList[i].totalPrice) {
                        if (sessionsEVIO.sessionsList[i].totalPrice.excl_vat)
                            sessionsEVIOIncluded.total_cost_excl_vat += sessionsEVIO.sessionsList[i].totalPrice.excl_vat
                        if (sessionsEVIO.sessionsList[i].totalPrice.incl_vat)
                            sessionsEVIOIncluded.total_cost_incl_vat += sessionsEVIO.sessionsList[i].totalPrice.incl_vat
                    }

                    if (sessionsEVIO.sessionsList[i].chargerType)
                        sessionsEVIOIncluded.sessionsId.push({ 'sessionId': sessionsEVIO.sessionsList[i]._id, 'chargerType': sessionsEVIO.sessionsList[i].chargerType })

                    sessionsEVIOIncluded.sessionsList.push(sessionsEVIO.sessionsList[i])

                    if (sessionsEVIO.sessionsList[i].paymentId)
                        sessionsEVIOIncluded.paymentIds.push(sessionsEVIO.sessionsList[i].paymentId)
                }
            }
            else {

                if (sessionsEVIO.sessionsList[i].totalPrice) {
                    if (sessionsEVIO.sessionsList[i].totalPrice.excl_vat)
                        sessionsEVIOIncluded.total_cost_excl_vat += sessionsEVIO.sessionsList[i].totalPrice.excl_vat
                    if (sessionsEVIO.sessionsList[i].totalPrice.incl_vat)
                        sessionsEVIOIncluded.total_cost_incl_vat += sessionsEVIO.sessionsList[i].totalPrice.incl_vat
                }

                if (sessionsEVIO.sessionsList[i].chargerType)
                    sessionsEVIOIncluded.sessionsId.push({ 'sessionId': sessionsEVIO.sessionsList[i]._id, 'chargerType': sessionsEVIO.sessionsList[i].chargerType })

                sessionsEVIOIncluded.sessionsList.push(sessionsEVIO.sessionsList[i])

                if (sessionsEVIO.sessionsList[i].paymentId)
                    sessionsEVIOIncluded.paymentIds.push(sessionsEVIO.sessionsList[i].paymentId)
            }
        }


    //OCPI Sessions
    if (Array.isArray(sessionsOCPI)) {
        for (let i = 0; i != sessionsOCPI.length; i++) {
            if (sessionsOCPI[i].invoiceType == 'INVOICE_INCLUDED') {

                sessionsOCPIIncluded.push(sessionsOCPI[i])

            }
            else if (sessionsOCPI[i].invoiceType == 'INVOICE_INDIVIDUAL') {
                if (sessionsOCPI[i].invoiceCommunication == 'ONLY_DRIVER') {
                    let index = evIdsDriverOnly.indexOf(sessionsOCPI[i].evId)

                    if (index == -1) {
                        evIdsDriverOnly.push(sessionsOCPI[i].evId)
                        sessionsEVIOEVDriverOnly.push({
                            'total_cost_excl_vat': 0,
                            'total_cost_incl_vat': 0,
                            'sessionsId': [],
                            'sessionsList': [],
                            'paymentIds': []
                        })
                        sessionsOCPIEVDriverOnly.push([])
                        index = evIdsDriverOnly.length - 1;
                    }

                    sessionsOCPIEVDriverOnly[index].push(sessionsOCPI[i])

                }
                else if (sessionsOCPI[i].invoiceCommunication == 'ONLY_COMPANY') {
                    let index = evIdsCompanyOnly.indexOf(sessionsOCPI[i].evId)

                    if (index == -1) {
                        evIdsCompanyOnly.push(sessionsOCPI[i].evId)
                        sessionsEVIOEVCompanyOnly.push({
                            'total_cost_excl_vat': 0,
                            'total_cost_incl_vat': 0,
                            'sessionsId': [],
                            'sessionsList': [],
                            'paymentIds': []
                        })
                        sessionsOCPIEVCompanyOnly.push([])
                        index = evIdsCompanyOnly.length - 1;
                    }

                    sessionsOCPIEVCompanyOnly[index].push(sessionsOCPI[i])
                }
                else if (sessionsOCPI[i].invoiceCommunication == 'DRIVER_COMPANY') {
                    let index = evIdsDriveCompany.indexOf(sessionsOCPI[i].evId)

                    if (index == -1) {
                        evIdsDriveCompany.push(sessionsOCPI[i].evId)
                        sessionsEVIOEVDriveCompany.push({
                            'total_cost_excl_vat': 0,
                            'total_cost_incl_vat': 0,
                            'sessionsId': [],
                            'sessionsList': [],
                            'paymentIds': []
                        })
                        sessionsOCPIEVDriveCompany.push([])
                        index = evIdsDriveCompany.length - 1;
                    }

                    sessionsOCPIEVDriveCompany[index].push(sessionsOCPI[i])
                }
                else {
                    sessionsOCPIIncluded.push(sessionsOCPI[i])
                }
            }
            else {
                sessionsOCPIIncluded.push(sessionsOCPI[i])
            }
        }
    }



    //Sessions included
    //Add in headers Eamil
    let emailUserIdIncluded = headers;
    emailUserIdIncluded = [userId];
    //sendFinalInvoice
    //parseSessionsToOld

    let sessionsEVIOIncludedOrNull = null
    let sessionsOCPIIncludedOrNull = null

    console.log("emailUserIdIncluded")
    console.log(emailUserIdIncluded)

    if (sessionsEVIOIncluded.sessionsList.length > 0)
        sessionsEVIOIncludedOrNull = sessionsEVIOIncluded
    if (sessionsOCPIIncluded.length > 0)
        sessionsOCPIIncludedOrNull = await getSessionInvoice(sessionsOCPIIncluded)

    sendFinalInvoice(sessionsEVIOIncludedOrNull, sessionsOCPIIncludedOrNull, userId, invoiceWithoutPayment, timer, start_date_time, end_date_time, billingPeriod,
        host, headers, emailUserIdIncluded, billingProfile, optionalCountryCodeToVAT, null);


    for (let i = 0; i != evIdsDriverOnly.length; i++) {

        let emailUserId = [];
        let sessionsEVIOEVDriverOnlyOrNull = null
        let sessionsOCPIEVDriverOnlyOrNull = null

        if (sessionsEVIOEVDriverOnly[i].sessionsList.length > 0) {
            emailUserId = [sessionsEVIOEVDriverOnly[i].sessionsList[0].userId];
            sessionsEVIOEVDriverOnlyOrNull = sessionsEVIOEVDriverOnly[i]
        }

        if (sessionsOCPIEVDriverOnly[i].length > 0) {
            emailUserId = [sessionsOCPIEVDriverOnly[i][0].userId];
            sessionsOCPIEVDriverOnlyOrNull = await getSessionInvoice(sessionsOCPIEVDriverOnly[i])
        }

        sendFinalInvoice(sessionsEVIOEVDriverOnlyOrNull, sessionsOCPIEVDriverOnlyOrNull, userId, invoiceWithoutPayment, timer, start_date_time, end_date_time, billingPeriod,
            host, headers, emailUserId, billingProfile, optionalCountryCodeToVAT, null);
    }

    for (let i = 0; i != evIdsCompanyOnly.length; i++) {

        let emailUserId = [];
        let sessionsEVIOEVCompanyOnlyOrNull = null
        let sessionsOCPIEVCompanyOnlyOrNull = null

        if (sessionsEVIOEVCompanyOnly[i].sessionsList.length > 0) {
            emailUserId = [userId];
            sessionsEVIOEVCompanyOnlyOrNull = sessionsEVIOEVCompanyOnly[i]
        }

        if (sessionsOCPIEVCompanyOnly[i].length > 0) {
            emailUserId = [userId];
            sessionsOCPIEVCompanyOnlyOrNull = await getSessionInvoice(sessionsOCPIEVCompanyOnly[i])
        }

        sendFinalInvoice(sessionsEVIOEVCompanyOnlyOrNull, sessionsOCPIEVCompanyOnlyOrNull, userId, invoiceWithoutPayment, timer, start_date_time, end_date_time, billingPeriod,
            host, headers, emailUserId, billingProfile, optionalCountryCodeToVAT, null);
    }

    for (let i = 0; i != evIdsDriveCompany.length; i++) {

        let emailUserId = [];
        let sessionsEVIOEVDriveCompanyOrNull = null
        let sessionsOCPIEVDriveCompanyOrNull = null

        if (sessionsEVIOEVDriveCompany[i].sessionsList.length > 0) {
            emailUserId = [userId, sessionsEVIOEVDriveCompany[i].sessionsList[0].userId];
            sessionsEVIOEVDriveCompanyOrNull = sessionsEVIOEVDriveCompany[i]
        }

        if (sessionsOCPIEVDriveCompany[i].length > 0) {
            emailUserId = [userId, sessionsOCPIEVDriveCompany[i][0].userId];
            sessionsOCPIEVDriveCompanyOrNull = await getSessionInvoice(sessionsOCPIEVDriveCompany[i])
        }

        sendFinalInvoice(sessionsEVIOEVDriveCompanyOrNull, sessionsOCPIEVDriveCompanyOrNull, userId, invoiceWithoutPayment, timer, start_date_time, end_date_time, billingPeriod,
            host, headers, emailUserId, billingProfile, optionalCountryCodeToVAT, null);
    }


    if (sessionsEVIO) {
        console.log("sessionsEVIOIncluded")
        console.log(sessionsEVIOIncluded)
        console.log("sessionsEVIO: " + sessionsEVIO.sessionsList.length)
        console.log("sessionsEVIOIncluded: " + sessionsEVIOIncluded.sessionsList.length)
        console.log("sessionsEVIOEVDriverOnly: " + sessionsEVIOEVDriverOnly.length)
        console.log("sessionsEVIOEVCompanyOnly: " + sessionsEVIOEVCompanyOnly.length)
        console.log("sessionsEVIOEVDriveCompany: " + sessionsEVIOEVDriveCompany.length)
    }

    if (sessionsOCPI) {
        console.log("sessionsOCPI: " + sessionsOCPI.length)
        console.log("sessionsOCPIIncluded: " + sessionsOCPIIncluded.length)
        console.log("sessionsOCPIEVDriverOnly: " + sessionsOCPIEVDriverOnly.length)
        console.log("sessionsOCPIEVCompanyOnly: " + sessionsOCPIEVCompanyOnly.length)
        console.log("sessionsOCPIEVDriveCompany: " + sessionsOCPIEVDriveCompany.length)
    }

    //sendFinalInvoice(sessionsEVIO, sessionsOCPI, userId, invoiceWithoutPayment, timer, start_date_time, end_date_time, billingPeriod, host, headers, billingProfile)
}

function getSessionInvoice(sessions) {
    var context = "getSessionInvoice function"
    return new Promise(async (resolve, reject) => {

        let sessionsIds = []

        for (let i = 0; i != sessions.length; i++)
            sessionsIds.push(sessions[i].id)

        const body = {
            id: sessionsIds,
            goChargeInvoice: true
        };

        let host = process.env.HostChargingSessionMobie + process.env.PathPeriodSessionsGetBillingInformation;

        console.log(host);

        axios.post(host, body)
            .then((result) => {
                resolve(result.data);
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                resolve(null);
            });

    });
}


const sleep = async (milliseconds) => {
    await new Promise(resolve => {
        return setTimeout(resolve, milliseconds)
    });
};

async function processBillingPeriodPromise(billingProfile, start_date_time, end_date_time, timer, userInfo) {
    const context = "[Function processBillingPeriodPromise]";

    const processBillingPeriod = async (sessionsEVIO, sessionsOCPI, userId, invoiceWithoutPayment,
        timer, start_date_time, end_date_time, billingPeriod, billingProfile, clientName, optionalCountryCodeToVAT) => {

        const host = process.env.HostBilling + process.env.PathGeneratePeriodBilling;

        console.log("sessionsEVIO", sessionsEVIO);
        if (process.env.ListCLientNameEVIO.includes(clientName)) {
            let headers = {
                'userid': userId,
                'clientname': clientName,
                'ceme': 'EVIO',
            }

            await parseSessions(sessionsEVIO.evio, sessionsOCPI, userId, invoiceWithoutPayment, timer, start_date_time, end_date_time, billingPeriod,
                host, headers, billingProfile, optionalCountryCodeToVAT);
            await sleep(8000);
        } else {
            if (sessionsEVIO.others) {
                let headers = {
                    'userid': userId,
                    'clientname': clientName,
                    'ceme': clientName,
                }
                await parseSessions(sessionsEVIO.others, null, userId, invoiceWithoutPayment, timer, start_date_time, end_date_time, billingPeriod,
                    host, headers, billingProfile, optionalCountryCodeToVAT);
                await sleep(8000);
            }

            if (sessionsOCPI || sessionsEVIO.evio) {
                let headers = {
                    'userid': userId,
                    'clientname': clientName,
                    'ceme': 'EVIO',
                }
                await parseSessions(sessionsEVIO.evio, sessionsOCPI, userId, invoiceWithoutPayment, timer, start_date_time, end_date_time, billingPeriod,
                    host, headers, billingProfile, optionalCountryCodeToVAT);
                await sleep(8000);
            }
        }

    };

    try {
        console.info(`${context} was called with billingProfile, start_date_time, end_date_time, timer, userInfo`, billingProfile, start_date_time, end_date_time, timer, userInfo);

        let invoiceWithoutPayment = billingProfile.invoiceWithoutPayment
        let userId = billingProfile.userId
        let billingPeriod = billingProfile.billingPeriod
        if (userInfo) {
            let clientName = userInfo.clientName;
            console.log("userId", userId);
            console.log("billingPeriod", billingPeriod);

            let countriesOnsessionsEVIO = await ChargerService.getCountriesToBillingPeriodSessions(userId, billingPeriod, invoiceWithoutPayment, start_date_time, end_date_time, clientName);
            console.debug(`${context} Fetched countriesOnsessionsEVIO`, countriesOnsessionsEVIO);

            let countryCodesOnsessionsOCPI = await OCPIService.getCountryCodesToBillingPeriodSessionsV2(userId, billingPeriod, invoiceWithoutPayment, start_date_time, end_date_time);
            console.debug(`${context} Fetched countryCodesOnsessionsOCPI`, countryCodesOnsessionsOCPI);

            /**
             * @comment Case on we have only one country on EVIO and OCPI
             */
            if (countriesOnsessionsEVIO.length === 1 && countryCodesOnsessionsOCPI.length === 1) {
                let sessionsEVIO = {};
                let sessionsOCPI = {};

                try {
                    const fetchedCountryCode = getCode(countriesOnsessionsEVIO[0]);
                    console.debug(`${context} Fetched fetchedCountryCode to countryCode`, fetchedCountryCode, countriesOnsessionsEVIO[0]);

                    if (fetchedCountryCode === countryCodesOnsessionsOCPI[0]) {
                        sessionsEVIO = await periodBillingEVIO(userId, billingPeriod, invoiceWithoutPayment, start_date_time, end_date_time, clientName);
                        sessionsOCPI = await periodBillingOCPI(userId, billingPeriod, invoiceWithoutPayment, start_date_time, end_date_time);
                        await processBillingPeriod(sessionsEVIO, sessionsOCPI, userId, invoiceWithoutPayment, timer, start_date_time, end_date_time, billingPeriod,
                            billingProfile, clientName, fetchedCountryCode);

                        countriesOnsessionsEVIO = countriesOnsessionsEVIO.filter(country => country !== countriesOnsessionsEVIO[0]);
                        countryCodesOnsessionsOCPI = countryCodesOnsessionsOCPI.filter(countryCode => countryCode !== countryCodesOnsessionsOCPI[0]);
                    } else {

                        // Processing each country separately
                        sessionsEVIO = await periodBillingEVIO(userId, billingPeriod, invoiceWithoutPayment, start_date_time, end_date_time, clientName);
                        await processBillingPeriod(sessionsEVIO, sessionsOCPI, userId, invoiceWithoutPayment, timer, start_date_time, end_date_time, billingPeriod,
                            billingProfile, clientName, fetchedCountryCode);
                        countriesOnsessionsEVIO = countriesOnsessionsEVIO.filter(country => country !== countriesOnsessionsEVIO[0]);

                        sessionsEVIO = {};
                        sessionsOCPI = await periodBillingOCPI(userId, billingPeriod, invoiceWithoutPayment, start_date_time, end_date_time);
                        await processBillingPeriod(sessionsEVIO, sessionsOCPI, userId, invoiceWithoutPayment, timer, start_date_time, end_date_time, billingPeriod,
                            billingProfile, clientName, countryCodesOnsessionsOCPI[0]);
                        countryCodesOnsessionsOCPI = countryCodesOnsessionsOCPI.filter(countryCode => countryCode !== countryCodesOnsessionsOCPI[0]);
                    }

                } catch (error) {
                    Sentry.captureException(error);
                    console.warn(`[${context}] Error during get countryCode from country`, error.message, countriesOnsessionsEVIO[0]);

                    console.warn(`[${context}] processBillingPeriod will be called without countryCodeToVAT parameter`);

                    // Processing each country separately
                    sessionsEVIO = await periodBillingEVIO(userId, billingPeriod, invoiceWithoutPayment, start_date_time, end_date_time, clientName);
                    await processBillingPeriod(sessionsEVIO, sessionsOCPI, userId, invoiceWithoutPayment, timer, start_date_time, end_date_time, billingPeriod, billingProfile, clientName);
                    countriesOnsessionsEVIO = countriesOnsessionsEVIO.filter(country => country !== countriesOnsessionsEVIO[0]);

                    sessionsEVIO = {};
                    sessionsOCPI = await periodBillingOCPI(userId, billingPeriod, invoiceWithoutPayment, start_date_time, end_date_time);
                    await processBillingPeriod(sessionsEVIO, sessionsOCPI, userId, invoiceWithoutPayment, timer, start_date_time, end_date_time, billingPeriod, billingProfile, clientName);
                    countryCodesOnsessionsOCPI = countryCodesOnsessionsOCPI.filter(countryCode => countryCode !== countryCodesOnsessionsOCPI[0]);
                }


            } else if(countriesOnsessionsEVIO.length === 0 && countryCodesOnsessionsOCPI.length > 0) {
                const sessionsEVIO = {};

                for (const countryCode of countryCodesOnsessionsOCPI) {
                    const sessionsOCPI = await periodBillingOCPI(userId, billingPeriod, invoiceWithoutPayment, start_date_time, end_date_time, countryCode);

                    await processBillingPeriod(sessionsEVIO, sessionsOCPI, userId, invoiceWithoutPayment, timer, start_date_time, end_date_time, billingPeriod,
                        billingProfile, clientName, countryCode);
                    countryCodesOnsessionsOCPI = countryCodesOnsessionsOCPI.filter(countryCode => countryCode !== countryCode);
                }
            } else if(countriesOnsessionsEVIO.length > 0 && countryCodesOnsessionsOCPI.length === 0) {
                const sessionsOCPI = {};

                for (const country of countriesOnsessionsEVIO) {
                    const sessionsEVIO = await periodBillingEVIO(userId, billingPeriod, invoiceWithoutPayment, start_date_time, end_date_time, clientName, country);
                    const countryCodeOfCountry = getCode(country);

                    await processBillingPeriod(sessionsEVIO, sessionsOCPI, userId, invoiceWithoutPayment, timer, start_date_time, end_date_time, billingPeriod,
                        billingProfile, clientName, countryCodeOfCountry);
                    countriesOnsessionsEVIO = countriesOnsessionsEVIO.filter(country => country !== country);
                }
            }

            /**
             * @comment Case on we have more than one country on EVIO and OCPI, inside on try/catch to prevent errors for not found during getCode/getCountry methods
             */
            if (countriesOnsessionsEVIO.length > countryCodesOnsessionsOCPI.length) {
                let sessionsEVIO = {};
                let sessionsOCPI = {};

                for(const country of countriesOnsessionsEVIO) {
                    console.debug(`${context} Handling country`, country);
                    sessionsEVIO = await periodBillingEVIO(userId, billingPeriod, invoiceWithoutPayment, start_date_time, end_date_time, clientName, country);
                    countriesOnsessionsEVIO = countriesOnsessionsEVIO.filter(country => country !== country);
                    let countryCodeOfCountry;

                    try {
                        countryCodeOfCountry = getCode(country);
                        console.debug(`${context} Fetched countryCodeOfCountry`, countryCodeOfCountry);

                        if (!countryCodeOfCountry || countryCodesOnsessionsOCPI.includes(countryCodeOfCountry) === false) {
                            sessionsOCPI = {};
                        } else {
                            sessionsOCPI = await periodBillingOCPI(userId, billingPeriod, invoiceWithoutPayment, start_date_time, end_date_time, countryCodeOfCountry);
                            countryCodesOnsessionsOCPI = countryCodesOnsessionsOCPI.filter(countryCode => countryCode !== countryCodeOfCountry);
                        }

                    } catch (error) {
                        Sentry.captureException(error);
                        console.error(`[${context}] Error during get countryCode from country`, error.message, country);
                    } finally {
                        await processBillingPeriod(sessionsEVIO, sessionsOCPI, userId, invoiceWithoutPayment, timer, start_date_time, end_date_time, billingPeriod,
                            billingProfile, clientName, countryCodeOfCountry);
                    }

                }
            } else {

                let sessionsEVIO = {};
                let sessionsOCPI = {};

                for(const countryCode of countryCodesOnsessionsOCPI) {
                    console.debug(`${context} Handling countryCode`, countryCode);
                    sessionsOCPI = await periodBillingOCPI(userId, billingPeriod, invoiceWithoutPayment, start_date_time, end_date_time, countryCode);
                    countryCodesOnsessionsOCPI = countryCodesOnsessionsOCPI.filter(countryCode => countryCode !== countryCode);

                    try {
                        const countryOfCountryCode = getName(countryCode);
                        console.debug(`${context} Fetched countryOfCountryCode`, countryOfCountryCode);

                        if (!countryOfCountryCode || countriesOnsessionsEVIO.includes(countryOfCountryCode) === false) {
                            sessionsEVIO = {};
                        } else {
                            sessionsEVIO = await periodBillingEVIO(userId, billingPeriod, invoiceWithoutPayment, start_date_time, end_date_time, clientName, countryOfCountryCode);
                            countriesOnsessionsEVIO = countriesOnsessionsEVIO.filter(country => country !== countryOfCountryCode);
                        }
                    } catch (error) {
                        Sentry.captureException(error);
                        console.error(`[${context}] Error during get country from countryCode`, error.message, countryCode);
                    } finally {
                        await processBillingPeriod(sessionsEVIO, sessionsOCPI, userId, invoiceWithoutPayment, timer, start_date_time, end_date_time, billingPeriod,
                            billingProfile, clientName, countryCode);
                    }

                }
            }

            /**
             * @comment Handle the missing ones
             */
            if (countriesOnsessionsEVIO.length > 0) {
                let sessionsEVIO = {};
                let sessionsOCPI = {};

                for (const country of countriesOnsessionsEVIO) {
                    sessionsEVIO = await periodBillingEVIO(userId, billingPeriod, invoiceWithoutPayment, start_date_time, end_date_time, clientName, country);
                    await processBillingPeriod(sessionsEVIO, sessionsOCPI, userId, invoiceWithoutPayment, timer, start_date_time, end_date_time, billingPeriod, billingProfile, clientName);
                    countriesOnsessionsEVIO = countriesOnsessionsEVIO.filter(country => country !== country);
                }

            }

            if (countryCodesOnsessionsOCPI.length > 0) {
                let sessionsEVIO = {};
                let sessionsOCPI = {};

                for (const countryCode of countryCodesOnsessionsOCPI) {
                    sessionsOCPI = await periodBillingOCPI(userId, billingPeriod, invoiceWithoutPayment, start_date_time, end_date_time, countryCode);
                    await processBillingPeriod(sessionsEVIO, sessionsOCPI, userId, invoiceWithoutPayment, timer, start_date_time, end_date_time, billingPeriod, billingProfile, clientName);
                    countryCodesOnsessionsOCPI = countryCodesOnsessionsOCPI.filter(countryCode => countryCode !== countryCode);
                }
            }

        } else {
            console.error(`[${context}] Error `, 'Request failed to fetch userInfo ' + billingProfile?.userId);
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }

}
