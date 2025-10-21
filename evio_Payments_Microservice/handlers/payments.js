const Payments = require('../models/payments');
const TransactionsHandler = require('./transactions');
const WalletHandler = require('./wallet');
const PaymentMethodHandler = require('./paymentMethod');
const PaymentAdyenHandler = require('./paymentsAdyen');
const RequestHistoryLogs = require('./requestHistoryLogsHandler');
const ListPaymentMethodHandler = require('./listPaymentMethod');
const { markAsDefaultPaymentMethod } = require('../models/paymentMethod');
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
const ExternalRequest = require("../handlers/externalRequest");
const moment = require('moment');
const Sentry = require("@sentry/node");
const { Enums } = require('evio-library-commons').default;

module.exports = {
    createPaymentPhysicalCard: function (req) {
        const context = "Function createPayment";
        return new Promise(async (resolve, reject) => {
            try {
                let payment = new Payments(req.body);

                let clientType = req.body.clientType;

                if (clientType === process.env.ClientTypeB2B) {

                    let listPaymentMethod = await ListPaymentMethodHandler.getListPaymentMethod(payment.userId);

                    if (listPaymentMethod) {

                        if (listPaymentMethod.paymentMethod.length === 0) {

                            resolve(process.env.PAYMENTRESPONSENOPAYMENTMETHODS);

                        } else if (listPaymentMethod.paymentMethod.length === 1) {

                            if (listPaymentMethod.paymentMethod[0].toUpperCase() === process.env.PaymentMethodCard.toUpperCase()) {

                                let response = await makePaymentB2C(payment);
                                resolve(response);

                            } else {

                                let response = await makePaymentB2B(payment);
                                resolve(response);

                            };

                        } else {
                            let response = await makePaymentB2C(payment);
                            resolve(response);
                        }

                    } else {
                        resolve(process.env.PAYMENTRESPONSENOPAYMENTMETHODS);
                    };

                } else {

                    let response = await makePaymentB2C(payment);
                    resolve(response);

                };

            } catch (error) {

                console.error(`[${context}] Error `, error.message);
                reject(error);

            };
        });
    },
    validatePaymentConditions: (request, response) => {
        let context = "Function validatePaymentConditions";
        return new Promise(async (resolve, reject) => {
            try {

                let evFound = response.evFound;
                let userIdWillPay = response.userIdWillPay;
                let userIdToBilling = response.userIdToBilling;
                let evOwner = response.evOwner;
                let evOwnerBilling = response.evOwnerBilling;
                let infoUser = await getClientTypeAndPlanCeme(userIdWillPay);
                let viesVAT;
                let billingPeriod;
                let clientType = infoUser.clientType;
                let clientName = infoUser.clientName;

                let queryPayments = {
                    userId: userIdWillPay,
                    creditCard: true
                };

                let chargerFound = await getCharger(request.data.hwId, request.data.chargerType);
                let billingProfile = await validateBillingProfile(userIdToBilling);
                if (billingProfile) {
                    viesVAT = billingProfile.viesVAT
                    billingPeriod = billingProfile.billingPeriod
                };


                let myActiveSessions = (await getMyActiveSessions(userIdWillPay)).filter(sessions => {
                    return sessions.paymentMethod == process.env.PaymentMethodWallet;
                });

                let planCeme;
                if (request.data.chargerType === process.env.GireveCharger) {

                    //planCeme = infoUser.planRoaming;
                    planCeme = infoUser.planRoaming.find(plan => {
                        return plan.plan.CEME === "EVIO " + chargerFound.source;
                    })

                } else {

                    planCeme = infoUser.planCeme;

                };

                let chargerType = chargerFound.chargerType;
                let tariff = request.data.tariff;
                let fees = request.data.fees;
                let timeToValidatePayment = {
                    timeToReserve: process.env.TimeToValidatePaymentToReserve,
                    timeToConfirmation: process.env.TimeToValidatePaymentToConfirmation
                };


                let wallet = await WalletHandler.getWallet(userIdWillPay);
                let paymentMethods = await PaymentMethodHandler.paymentMethodsFind(queryPayments);
                let listPaymentMethod = await ListPaymentMethodHandler.getListPaymentMethod(userIdWillPay);

                let plugFound = chargerFound.plugs.find(plug => {
                    return plug.plugId == request.data.plugId;
                });

                let reservedAmount = await priceSimulator(timeToValidatePayment.timeToReserve, tariff, plugFound, evFound, request.data.chargerType, fees, chargerFound , userIdWillPay);
                let confirmationAmount = 0;
                if (!reservedAmount)
                    reservedAmount = 0;

                let userWillPay = true;
                let paymentType = process.env.PaymentTypeAD_HOC;

                if (listPaymentMethod) {

                    if (listPaymentMethod.userType === "b2b") {
                        let paymentPeriod = await getPaymentPeriod(userIdWillPay);
                        userWillPay = paymentPeriod.userWillPay;
                        paymentType = paymentPeriod.paymentType;
                    };

                };

            } catch (error) {

                console.error(`[${context}] Error `, error.message);
                reject(error);

            };
        });
    },
    priceSimulator,
    getNotPaidSessions,
    remainingWalletValue,
    buildPaymentInfo,
    adyenPreAuthorize,
    validateWalletQuantity,
}

function makePaymentB2C(payment) {
    const context = "Function makePaymentB2C";
    return new Promise(async (resolve, reject) => {
        try {
            payment.paymentType = process.env.PaymentTypeAD_HOC;
            payment.status = process.env.PaymentStatusStartPayment;
            payment.transactionType = process.env.TransactionType2ndWayPhysicalCard;

            let wallet = await WalletHandler.getWallet(payment.userId);
            let paymentMethod = await PaymentMethodHandler.getPaymentMethod(payment.userId);

            if (wallet.amount.value >= payment.amount.value) {

                Payments.createPayments(payment, async (err, paymentCreated) => {
                    if (err) {
                        console.error(`[${context}] Error `, err.message);
                        reject(err)
                    };

                    let transaction = await TransactionsHandler.createTransaction(paymentCreated, process.env.TransactionType2ndWayPhysicalCard)

                    let paymentUpdated = await Payments.findOneAndUpdate({ _id: paymentCreated._id }, { $set: { transactionId: transaction._id } }, { new: true })

                    transaction.status = process.env.TransactionStatusPaidOut;

                    let walletTransaction = await WalletHandler.removeBalanceFromWallet(transaction);

                    if (walletTransaction) {

                        let transactionUpdated = await TransactionsHandler.updateTransaction(transaction._id, { $set: { status: process.env.TransactionStatusPaidOut, provider: process.env.PaymentMethodWallet } })
                        paymentUpdated = await Payments.findOneAndUpdate({ _id: paymentCreated._id }, { $set: { status: process.env.PaymentStatusPaidOut, reason: process.env.ReasonSuccessBalance, paymentMethod: process.env.PaymentMethodWallet } }, { new: true })

                        resolve(process.env.PAYMENTRESPONSEPAID);

                    } else {

                        if (paymentMethod.length > 0) {

                            let paymentMethodFound = paymentMethod.find(method => { return method.defaultPaymentMethod === true });
                            if (!paymentMethodFound) {
                                paymentMethodFound = paymentMethod[0];
                            };

                            payment.paymentMethodId = paymentMethodFound.paymentMethodId;
                            payment.paymentMethod = process.env.PaymentMethodCard;

                            Payments.createPayments(payment, async (err, paymentCreated) => {
                                if (err) {
                                    console.error(`[${context}] Error `, err.message);
                                    reject(err)
                                };

                                let transaction = await TransactionsHandler.createTransaction(paymentCreated, process.env.TransactionType2ndWayPhysicalCard);
                                let paymentUpdated = await Payments.findOneAndUpdate({ _id: paymentCreated._id }, { $set: { transactionId: transaction._id } }, { new: true });

                                let paymentAdyen = await PaymentAdyenHandler.createPaymentAdyen(paymentUpdated, transaction);

                                //console.log("paymentAdyen", paymentAdyen);

                                if (paymentAdyen === process.env.PaymentStatusInPayment) {

                                    let transactionUpdated = await TransactionsHandler.updateTransaction(transaction._id, { $set: { status: process.env.TransactionStatusInPayment, provider: process.env.PaymentMethodCard } })
                                    paymentUpdated = await Payments.findOneAndUpdate({ _id: paymentCreated._id }, { $set: { status: process.env.PaymentStatusInPayment, paymentMethod: process.env.PaymentMethodCard } }, { new: true })

                                    resolve(process.env.PAYMENTRESPONSEWAITPAYMENT);

                                } else {

                                    let transactionUpdated = await TransactionsHandler.updateTransaction(transaction._id, { $set: { status: process.env.TransactionStatusFaild, provider: process.env.PaymentMethodCard } })
                                    paymentUpdated = await Payments.findOneAndUpdate({ _id: paymentCreated._id }, { $set: { status: process.env.PaymentStatusFaild, paymentMethod: process.env.PaymentMethodCard } }, { new: true })

                                    resolve(process.env.PAYMENTRESPONSEPAYMENTFAILURE);

                                };

                            });

                        } else {

                            resolve(process.env.PAYMENTRESPONSENOPAYMENTMETHODS);

                        };

                    };

                });

            } else if (paymentMethod.length > 0) {

                let paymentMethodFound = paymentMethod.find(method => { return method.defaultPaymentMethod === true });
                if (!paymentMethodFound) {
                    paymentMethodFound = paymentMethod[0];
                };

                payment.paymentMethodId = paymentMethodFound.paymentMethodId;
                payment.paymentMethod = process.env.PaymentMethodCard;

                Payments.createPayments(payment, async (err, paymentCreated) => {
                    if (err) {
                        console.error(`[${context}] Error `, err.message);
                        reject(err)
                    };

                    let transaction = await TransactionsHandler.createTransaction(paymentCreated, process.env.TransactionType2ndWayPhysicalCard);
                    let paymentUpdated = await Payments.findOneAndUpdate({ _id: paymentCreated._id }, { $set: { transactionId: transaction._id } }, { new: true });

                    let paymentAdyen = await PaymentAdyenHandler.createPaymentAdyen(paymentUpdated, transaction);

                    //console.log("paymentAdyen", paymentAdyen);

                    if (paymentAdyen === process.env.PaymentStatusInPayment) {

                        let transactionUpdated = await TransactionsHandler.updateTransaction(transaction._id, { $set: { status: process.env.TransactionStatusInPayment, provider: process.env.PaymentMethodCard } })
                        paymentUpdated = await Payments.findOneAndUpdate({ _id: paymentCreated._id }, { $set: { status: process.env.PaymentStatusInPayment, paymentMethod: process.env.PaymentMethodCard } }, { new: true })

                        resolve(process.env.PAYMENTRESPONSEWAITPAYMENT);

                    } else {

                        let transactionUpdated = await TransactionsHandler.updateTransaction(transaction._id, { $set: { status: process.env.TransactionStatusFaild, provider: process.env.PaymentMethodCard } })
                        paymentUpdated = await Payments.findOneAndUpdate({ _id: paymentCreated._id }, { $set: { status: process.env.PaymentStatusFaild, paymentMethod: process.env.PaymentMethodCard } }, { new: true })

                        resolve(process.env.PAYMENTRESPONSEPAYMENTFAILURE);

                    };

                });

            } else {

                resolve(process.env.PAYMENTRESPONSENOPAYMENTMETHODS);

            };
        } catch (error) {

            console.error(`[${context}] Error `, error.message);
            reject(error);

        };
    });
};

function makePaymentB2B(payment) {
    const context = "Function makePaymentB2B";
    return new Promise(async (resolve, reject) => {
        try {

            payment.paymentType = process.env.PaymentTypeMonthly;
            payment.status = process.env.PaymentStatusWaitingCapturByEVIO;
            payment.transactionType = process.env.TransactionType2ndWayPhysicalCard;
            payment.paymentMethod = process.env.PaymentMethodTransfer;

            Payments.createPayments(payment, async (err, paymentCreated) => {
                if (err) {
                    console.error(`[${context}] Error `, err.message);
                    reject(err)
                };

                let transaction = await TransactionsHandler.createTransaction(paymentCreated, process.env.TransactionType2ndWayPhysicalCard);
                resolve(process.env.PAYMENTRESPONSEPAID);

            });

        } catch (error) {

            console.error(`[${context}] Error `, error.message);
            reject(error);

        };
    });
};

function getClientTypeAndPlanCeme(userId) {
    let context = "Function getClientType";
    return new Promise((resolve, reject) => {

        try {

            let host = process.env.HostUser + process.env.PathInfoUser;
            let headers = {
                userid: userId
            };

            axios.get(host, { headers })
                .then((result) => {

                    resolve(result.data);

                })
                .catch((error) => {

                    console.error(`[${context}] [${host}] Error `, error.message);
                    resolve({
                        clientType: "b2c",
                        planCeme: {},
                        planRoaming: []
                    });

                });

        } catch (error) {

            console.error(`[${context}] Error `, error.message);
            resolve({
                clientType: "b2c",
                planCeme: {},
                planRoaming: []
            });

        };

    });
};

function getCharger(hwId, chargerType) {
    var context = "Function getCharger";
    return new Promise(async (resolve, reject) => {
        try {

            let proxy;
            let params;

            if (chargerType === process.env.MobieCharger || chargerType === process.env.OCMCharger || chargerType === process.env.TeslaCharger || chargerType === process.env.GireveCharger || chargerType === Enums.ChargerTypes.Hubject) {

                proxy = process.env.HostPublicNetwork + process.env.PathGetChargerPublicNetwork;

                params = {
                    hwId: hwId,
                    chargerType: chargerType
                };
            }
            else {

                proxy = process.env.HostCharger + process.env.PathGetChargerEVIOPrivate;

                params = {
                    hwId: hwId,
                    active: true,
                    hasInfrastructure: true
                };
            };

            axios.get(proxy, { params })
                .then((result) => {
                    resolve(result.data);
                })
                .catch((error) => {
                    console.error(`[${context}] Error `, error.message);
                    reject(error);
                });


        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function validateBillingProfile(userId) {
    let context = "Function getActiveSessionsMyChargers";
    return new Promise(async (resolve, reject) => {
        try {

            let proxy = process.env.HostUser + process.env.PathValidateBilling;
            let headers = {
                userid: userId
            };

            axios.get(proxy, { headers })
                .then((result) => {

                    resolve(result.data);

                })
                .catch((error) => {
                    console.error(`[${context}][${proxy}] Error `, error.message);
                    reject(error);
                });

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

async function priceSimulator(time, tariff, plugFound, evFound, chargerType, chargerFound , planId , clientName , minimumAuthorizeValue , userId) {
    const context = "Function priceSimulator";
    try {

        // Get dates to calculations
        const {sessionStartDate , sessionStopDate} = getSimulationDates(time)

        // Get consumption according to the used EV
        const consumption = getEvConsumedEnergy(evFound , plugFound.power , time)

        // Get calculations body request according to the charger network
        const body = priceSimulationBody(chargerType , sessionStartDate , sessionStopDate  , consumption , time , 0 ,chargerFound , plugFound , planId , tariff , clientName , userId)

        // Total value to pre authorize will be the maximum of a 10 min session and X euros (minimumAuthorizeValue)
        let total = await getTotalValuesSimulation(body)
        total = Math.max(minimumAuthorizeValue , total)

        return Math.abs(parseFloat(total.toFixed(2)))

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return minimumAuthorizeValue
    };
};

function getEvConsumedEnergy(evFound , chargerPower , time) {
    const context = "Function getEvConsumedEnergy";
    try {

        // time comes in minutes
        // chargerPower comes in kW
        // Default ev values are from : ID3 Pro Type  2 CSS  >=2021

        // Max baterry capacity of the ev in kWh which means that, with a power of 62 kW, we take an hour to fill the battery
        const maxBatteryCapacity = evFound?.evInfo?.maxBatteryCapacity ?? 62.00

        // Internal charger power is the highest power the ev can handle, in kW
        const internalChargerPower = ( ( evFound?.evInfo?.maxFastChargingPower && evFound?.evInfo?.maxFastChargingPower != 0) ? evFound.evInfo.maxFastChargingPower : evFound?.evInfo?.internalChargerPower ) ?? 124.00

        // Calculate energy consumed in kWh
        const usedPower = (chargerPower >= internalChargerPower) ? internalChargerPower : Math.min(maxBatteryCapacity, chargerPower);
        const usedTime = Math.min(time, (chargerPower >= internalChargerPower ? (maxBatteryCapacity / internalChargerPower) : (maxBatteryCapacity / maxBatteryCapacity)) * 60) / 60;

        return usedPower * usedTime;
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return chargerPower * (time / 60 )
    }
}

function priceSimulationBody(chargerType , sessionStartDate , sessionStopDate  , consumption , time , parkingTime ,chargerFound , plugFound , planId , tariff , clientName , userId) {
    const context = "Function priceSimulationBody";
    try {
        const { latitude, longitude } = getChargerLatitudeLongitude(chargerFound.geometry)
        if (chargerType === process.env.MobieCharger) {
            return {
                elements: plugFound?.serviceCost?.elements,
                planId,
                address: chargerFound.address,
                voltageLevel : chargerFound.voltageLevel,
                sessionStartDate,
                sessionStopDate,
                power: plugFound.power,
                total_energy: consumption,
                total_charging_time: time / 60, // convert to hours (OCPI protocol)
                total_parking_time: parkingTime,
                countryCode : chargerFound.countryCode,
                partyId: chargerFound.partyId,
                source: chargerFound.source,
                latitude,
                longitude,
                clientName,
                userId,
            }
        } else if (chargerType === process.env.GireveCharger || chargerType === process.env.HubjectCharger) {
            return {
                elements: plugFound?.serviceCost?.elements,
                sessionStartDate,
                sessionStopDate,
                power: plugFound.power,
                total_energy: consumption,
                total_charging_time: time / 60, // convert to hours (OCPI protocol)
                total_parking_time: parkingTime,
                countryCode : chargerFound.countryCode,
                partyId: chargerFound.partyId,
                source: chargerFound.source,
                latitude,
                longitude,
                userId,
            }

        } else {
            return {
                total_energy : consumption,
                total_charging_time: time,
                address,
                tariff,
                source: chargerFound?.source ?? chargerFound?.network,
                userId,
            }

        };
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null

    }
}

function getChargerLatitudeLongitude(geometry) {
    const context = "Function getChargerLatitudeLongitude";
    try {
        let latitude = geometry.coordinates[1]
        let longitude = geometry.coordinates[0]
        return { latitude, longitude }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return {}
    }
}

function getSimulationDates(time) {
    const context = "Function getSimulationDates";
    try {
        const sessionStartDate = moment.utc(new Date().toISOString()).format()
        const sessionStopDate = moment.utc(sessionStartDate).add(time, 'minutes').format()
        return {sessionStartDate , sessionStopDate}
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return {}
    }
}

async function getTotalValuesSimulation(data) {
    const context = "Function getTotalValuesSimulation";
    try {
        const serviceProxy = process.env.HostOcpi + process.env.PathGetOpcTariffsPrices;
        const response = await axios.post(serviceProxy, data)
        return response?.data?.detail?.total?.total ?? 0
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return 0
    };
};

async function getNotPaidSessions(userId) {
    const context = "Function getNotPaidSessions";
    try {
        // Set paths to get not paid sessions from EVIO and Public Network
        const notPaidSessionsPath = process.env.PathChargingSessionsNotPaid
        const evioProxy = process.env.HostCharger + notPaidSessionsPath
        const ocpiProxy = process.env.HostOcpi + notPaidSessionsPath

        const params = {
            userId
        };

        // Call services and join all sessions
        const evioSessions = await getSessions(evioProxy , params);
        const ocpiSessions = await getSessions(ocpiProxy , params);
        return [...evioSessions , ...ocpiSessions]

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return []
    };
};

async function getSessions(proxy , params) {
    const context = "Function getSessions";
    try {
        const sessions = await axios.get(proxy, { params });
        return sessions.data
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return []
    }
}

function remainingWalletValue(wallet , myActiveSessions , reservedAmount) {
    const context = "Function remainingWalletValue";
    try {
        const totalReservedAmount = myActiveSessions.reduce((accumulator , elem) => accumulator + elem.estimatedPrice , 0) + reservedAmount
        return Number((wallet.amount.value  - totalReservedAmount).toFixed(2))
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return Number((wallet.amount.value).toFixed(2))
    }
}

function buildPaymentInfo(paymentMethod , paymentMethodId , walletAmount , reservedAmount , confirmationAmount , userIdWillPay , adyenReference , transactionId , clientType , clientName , ceme , viesVAT , paymentType , billingPeriod , userIdToBilling , plafondId) {
    const context = "Function buildPaymentInfo";
    try {
        return {
            paymentMethod,
            paymentMethodId,
            walletAmount,
            reservedAmount,
            confirmationAmount,
            userIdWillPay,
            adyenReference,
            transactionId,
            clientType,
            clientName,
            ceme,
            viesVAT,
            paymentType: paymentType === process.env.PaymentTypeMonthly ? (clientType === process.env.ClientTypeB2B ? process.env.PaymentTypeAD_HOC : paymentType) : paymentType,
            billingPeriod,
            userIdToBilling,
            plafondId,
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return {}
    }
}



async function adyenPreAuthorize(paymentInfo ,evOwner , userIdWillPay , userIdToBilling , req , res) {
    const context = "Function adyenPreAuthorize";
    try {
        PaymentAdyenHandler.makeReservationPaymentAdyen(paymentInfo)
        .then((paymentInfo) => {

            if (paymentInfo.auth) {

                paymentInfo.auth = false;
                res.status(400).send(paymentInfo);
                RequestHistoryLogs.saveRequestHistoryLogs(req, res, paymentInfo);
                return res;

            }
            else {

                res.status(200).send(paymentInfo);
                RequestHistoryLogs.saveRequestHistoryLogs(req, res, paymentInfo);
                return res;

            };

        })
        .catch((error) => {
            if (error.response != undefined) {
                if (error.response.status === 400) {

                    var messageResponse;
                    if (evOwner) {
                        console.log("Tentativa 9 server_no_balance_paymentMethod_evOwner_required")
                        messageResponse = { auth: false, code: 'server_no_balance_paymentMethod_evOwner_required', message: "The selected EV belogns to other user, that doen's have payment methods available. To start charging, the EV owner must add payment  method.", userIdWillPay, userIdToBilling };
                    }
                    else {
                        messageResponse = { auth: false, code: 'server_no_balance_paymentMethod_required', message: 'No balance or payment methods available', redirect: "payments", userIdWillPay, userIdToBilling };
                    };
                    res.status(400).send(messageResponse);
                    RequestHistoryLogs.saveRequestHistoryLogs(req, res, messageResponse);
                    return res;

                }
                else {

                    console.error(`[${context}][makeReservationPaymentAdyen][.catch] Error`, error.response);
                    return res.status(500).send({ message: error.response, userIdWillPay, userIdToBilling });

                };
            }
            else {

                console.error(`[${context}][makeReservationPaymentAdyen] Error `, error.message);
                res.status(500).send({ message: error.message, userIdWillPay, userIdToBilling });
                RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
                return res;

            };
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        res.status(500).send({ message: error.message, userIdWillPay, userIdToBilling });
        RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
        return res;
    }
}


async function validateWalletQuantity(wallet, paymentMethods, reservedAmount, confirmationAmount, userIdWillPay, clientType, clientName, planCeme, viesVAT, paymentType, billingPeriod, evOwner, userIdToBilling, myActiveSessions, req, res, plafond) {
    const context = "Function validateWalletQuantity";
    try {

        /*
            With the price simulation (reservedAmount) and all sessions that still need to be charged
            we can know, in theory, the real wallet ammount ( walletAmount - (reservedAmount + myActiveSessions estimated prices) ).

            If that value is greater than 2.5, is safe to use the wallet.

            If not, we check if the user has the auto top up feature activated.
                If so, we'll add balance to his wallet,
                else, we'll try to use his credit card
        */

        let plafondId = plafond ? await validatePlafond(plafond, userIdWillPay, userIdToBilling, req, res) : "-1";
        console.log("plafondId" , JSON.stringify(plafondId))
        //TODO test when validatePlafond fails
        // if (plafondId === null) return res
        console.log("wallet.amount.value" , JSON.stringify(wallet.amount.value))
        console.log("reservedAmount" , JSON.stringify(reservedAmount))
        console.log("myActiveSessions" , JSON.stringify(myActiveSessions))

        const remaining = remainingWalletValue(wallet , myActiveSessions , reservedAmount)
        console.log("remaining" , JSON.stringify(remaining))
        if ( remaining > 2.5 ) {
            walletValidation(
                wallet , reservedAmount , confirmationAmount , userIdWillPay , clientType , clientName ,
                planCeme , viesVAT , paymentType , billingPeriod, userIdToBilling, plafondId  , req , res
            )
        } else {
            console.log("wallet.autoRecharger" , JSON.stringify(wallet.autoRecharger))
            if (wallet.autoRecharger) {
                // User has auto top up activated

                // TODO The value should be set according to the remainingWalletValue
                const successTopUp = await walletValidationTopUp(userIdWillPay , "EUR" , 20 , clientName)
                console.log("successTopUp" , JSON.stringify(successTopUp))
                if (successTopUp) {
                    walletValidation(
                        wallet , reservedAmount , confirmationAmount , userIdWillPay , clientType , clientName ,
                        planCeme , viesVAT , paymentType , billingPeriod, userIdToBilling, plafondId  , req , res
                    )
                } else {
                    // Failed to auto top up wallet, so, we try charge in the credit card
                    cardValidation(
                        paymentMethods , reservedAmount , confirmationAmount , userIdWillPay , clientType , clientName ,
                        planCeme , viesVAT , paymentType , billingPeriod, userIdToBilling, plafondId , evOwner , req , res
                    )
                }

            } else {
                cardValidation(
                    paymentMethods , reservedAmount , confirmationAmount , userIdWillPay , clientType , clientName ,
                    planCeme , viesVAT , paymentType , billingPeriod, userIdToBilling, plafondId , evOwner , req , res
                )

            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        res.status(500).send({ message: error.message, userIdWillPay, userIdToBilling });
        RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
        return res;
    }

};


async function validatePlafond(plafond, userIdWillPay, userIdToBilling, req, res) {
    let context = 'Function validatePlafond';
    try {
        let messageResponse = {
            auth: false,
            code: 'server_plafond_not_enough',
            message: 'Plafond amount is not enough',
            userIdWillPay,
            userIdToBilling,
        };

        if (plafond.amount.value >= plafond.minimumChargingValue.value) {
            console.log('plafond.amount.value >= plafond.minimumChargingValue.value');
            return plafond._id;
        }

        if (plafond.amount.value <= 0) {
            console.log('plafond.amount.value <= 0');
            res.status(400);
            RequestHistoryLogs.saveRequestHistoryLogs(req, res, messageResponse);
            return res.send(messageResponse);
        }

        switch (plafond.actionMinimumValue) {
            case 'CHARGINGNEXTPLAFOND':
                console.log('CHARGINGNEXTPLAFOND');

                if (!plafond.extraSessionTaken) {
                    const plafondUpdated = await Plafond.findOneAndUpdate({ _id: plafond._id }, { extraSessionTaken: true });
                    return plafond._id;
                }

                res.status(400);
                RequestHistoryLogs.saveRequestHistoryLogs(req, res, messageResponse);
                return res.send(messageResponse);
            default:
                res.status(400);
                RequestHistoryLogs.saveRequestHistoryLogs(req, res, messageResponse);
                return res.send(messageResponse);
        }
    } catch (error) {
        console.error(`[${context}] Error: ${error.message}`);
        const messageResponse = {
            message: error.message,
            userIdWillPay,
            userIdToBilling,
        };
        res.status(500);
        RequestHistoryLogs.saveRequestHistoryLogs(req, res, messageResponse);
        return res.send(messageResponse);
    }
}

async function cardValidation(paymentMethods , reservedAmount , confirmationAmount , userIdWillPay , clientType , clientName , planCeme , viesVAT , paymentType , billingPeriod, userIdToBilling, plafondId , evOwner , req , res) {
    const context = "Function cardValidation";
    try {
        if (paymentMethods) {
            console.log("paymentMethods" , JSON.stringify(paymentMethods))
            let paymentInfo = buildPaymentInfo(
                process.env.PaymentMethodCard, paymentMethods.paymentMethodId, 0, reservedAmount, confirmationAmount,
                userIdWillPay, "-1", "-1", clientType, clientName, planCeme, viesVAT ,
                paymentType, billingPeriod, userIdToBilling, plafondId
            )
            adyenPreAuthorize(paymentInfo ,evOwner , userIdWillPay , userIdToBilling , req , res)

        } else {
            var messageResponse = { auth: false, code: 'server_no_balance_paymentMethod_required', message: 'No balance or payment methods available', redirect: "payments", userIdWillPay, userIdToBilling };
            if (evOwner) {
                console.log("Tentativa 10 server_no_balance_paymentMethod_evOwner_required")
                messageResponse = { auth: false, code: 'server_no_balance_paymentMethod_evOwner_required', message: "The selected EV belogns to other user, that doen's have payment methods available. To start charging, the EV owner must add payment  method.", userIdWillPay, userIdToBilling };
            }
            res.status(400).send(messageResponse);
            RequestHistoryLogs.saveRequestHistoryLogs(req, res, messageResponse);
            return res;
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        res.status(500).send({ message: error.message, userIdWillPay, userIdToBilling });
        RequestHistoryLogs.saveRequestHistoryLogs(req, res, error);
        return res;
    }
}

async function walletValidation(wallet , reservedAmount , confirmationAmount , userIdWillPay , clientType , clientName , planCeme , viesVAT , paymentType , billingPeriod, userIdToBilling, plafondId  , req , res) {
    const context = "Function walletValidation";
    try {
        let paymentInfo = buildPaymentInfo(
            process.env.PaymentMethodWallet, "", wallet.amount.value, reservedAmount, confirmationAmount,
            userIdWillPay, "-1", "-1", clientType, clientName, planCeme, viesVAT ,
            paymentType, billingPeriod, userIdToBilling, plafondId
        )
        ExternalRequest.verifyBlockedRFID(userIdWillPay);
        res.status(200).send(paymentInfo);
        RequestHistoryLogs.saveRequestHistoryLogs(req, res, paymentInfo);
        return res;
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        res.status(500).send({ message: error.message, userIdWillPay, userIdToBilling });
        RequestHistoryLogs.saveRequestHistoryLogs(req, res, error);
        return res;
    }
}

async function walletValidationTopUp(userId , currency , value , clientName) {
    const context = "Function walletValidationTopUp";
    try {
        const defaultPaymentMethod = await getDefaultPaymentMethod(userId)
        console.log("defaultPaymentMethod" , JSON.stringify(defaultPaymentMethod))
        if (defaultPaymentMethod) {
            await walletTopUp(defaultPaymentMethod , userId , currency , value , clientName)
            return true

        }
        return false
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return false
    }
}

async function getDefaultPaymentMethod(userId) {
    const context = "Function getDefaultPaymentMethod"
    try {
        return await PaymentMethodHandler.paymentMethodsFind({userId,creditCard: true , status : {$ne : process.env.PaymentMethodStatusExpired}});
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    }
}

async function walletTopUp(defaultPaymentMethod , userId , currency , value , clientName) {
    const context = "Function walletTopUp"
    try {
        console.log("userId" , JSON.stringify(userId))
        console.log("currency" , JSON.stringify(currency))
        console.log("value" , JSON.stringify(value))
        console.log("clientName" , JSON.stringify(clientName))

        // Create transaction
        const transactionCreated = await TransactionsHandler.createTransactionEntry( userId , process.env.TransactionTypeCredit , process.env.TransactionStatusSentToGenerate , process.env.TransactionProviderCreditCard , currency, value , clientName)

        // Add the created transaction to wallet
        await WalletHandler.addTransactionToWallet(transactionCreated);

        // Get the adyen configuration objects according to the clientName
        const { adyenCheckoutObj , adyenModificationObj , adyenMerchantAccountName } = PaymentAdyenHandler.adyenConfigObjects(clientName);

        // Make a payment authorization with the specified value in the default payment method
        const checkoutResult = await PaymentAdyenHandler.checkoutPayment(adyenMerchantAccountName , adyenCheckoutObj , adyenModificationObj ,  transactionCreated._id.toString() , currency , Math.abs(value*100) , defaultPaymentMethod.paymentMethodId , userId);

        // Update transaction with authorization result
        const updatedTransaction = await TransactionsHandler.updateTransaction(transactionCreated._id.toString() , { $set: { status: checkoutPaymentStatusMapper(checkoutResult), data: checkoutResult } })

        // Capture previously authorized value from the card
        await captureWallet(checkoutResult , adyenMerchantAccountName , adyenModificationObj , transactionCreated._id.toString())

        // Update wallet transaction
        WalletHandler.updateTransactionToWallet(updatedTransaction)

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        throw error
    }
}

function checkoutPaymentStatusMapper(checkoutResult) {
    const context = "Function checkoutPaymentStatusMapper"
    try {
        switch (checkoutResult.resultCode) {
            case 'Error':
                return process.env.TransactionStatusFaild;
            case 'Refused':
                return process.env.TransactionStatusFaild;
            default:
                return process.env.TransactionStatusInPayment;
        };
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return process.env.TransactionStatusFaild
    }
}

async function captureWallet(checkoutResult , adyenMerchantAccountName , adyenModificationObj , transactionId) {
    const context = "Function captureWallet"
    try {
        await PaymentAdyenHandler.modificationCapture(adyenMerchantAccountName , adyenModificationObj , checkoutResult.pspReference , checkoutResult.amount ,  checkoutResult.merchantReference )
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        updateWalletTransactionStatus(transactionId , process.env.TransactionStatusFaild)
        throw error
    }
}

async function updateWalletTransactionStatus(transactionId , status) {
    const context = "Function updateWalletTransactionStatus"
    try {
        const updatedTransaction = await TransactionsHandler.updateTransaction(transactionId , { $set: { status: status} })
        WalletHandler.updateTransactionToWallet(updatedTransaction)

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}
