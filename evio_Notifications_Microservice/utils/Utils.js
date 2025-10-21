const { response } = require('express');
const FirebaseTokenUser = require('../models/FirebaseUserTokens');
const FirebaseNotification = require('../models/FirebaseNotification');
const axios = require("axios");
var moment = require('moment');
const Excel = require('exceljs');
const Sentry = require('@sentry/node');

const {firebaseConnect} = require('evio-library-notifications').default
const { ClientName } = require('./constants');


var Utils = {

    verifyRegistrationToken: async function (token) {
        const admin = await firebaseConnect(ClientName);
        return  admin.messaging().send({token: token}, true);;
    },


    verifyUserTokens: function (userId) {
        return new Promise(async (resolve, reject) => {

            FirebaseTokenUser.findOne({ userId: userId }, (error, firebaseToken) => {
                if (error) {
                    reject(error);
                }
                else {
                    if (firebaseToken) {

                        if (firebaseToken.tokenList.length === 0) {
                            resolve(true);
                        }
                        else {
                            for (let i = firebaseToken.tokenList.length - 1; i >= 0; i--) {
                                let element = firebaseToken.tokenList[i];
                                console.log("Token: " + element.token);
                                console.log("Client Type: " + element.clientType);

                                 this.verifyRegistrationToken(element.token)
                                    .then(result => {
                                        console.log("VALID - ", element.clientType);
                                        if (i - 1 < 0) {
                                            let query = { _id: firebaseToken._id };
                                            console.log("query - ", query);
                                            FirebaseTokenUser.updateFirebaseTokenUser(query, { $set: firebaseToken }, (error, doc) => {
                                                if (error) {
                                                    resolve(false);
                                                }
                                                else {
                                                    if (doc != null) {
                                                        resolve(true);
                                                    }
                                                }
                                            });
                                        }

                                    })
                                    .catch(err => {
                                        console.log("NOTVALID - ", element.clientType);
                                        firebaseToken.tokenList.splice(i, 1);

                                        if (i - 1 < 0) {
                                            let query = { _id: firebaseToken._id };
                                            FirebaseTokenUser.updateFirebaseTokenUser(query, { $set: firebaseToken }, (error, doc) => {
                                                if (error) {
                                                    resolve(false);
                                                }
                                                else {
                                                    if (doc != null) {
                                                        resolve(true);
                                                    }
                                                }
                                            });
                                        }

                                    });
                            }
                        }

                    }
                    else {
                        resolve(true);
                    }
                }
            });

        });

    },
    addTopicToActiveTopics: function (userId, topic, tokens) {
        return new Promise((resolve, reject) => {

            FirebaseTokenUser.findOne({ userId: userId }, (error, firebaseToken) => {
                if (error) {
                    console.error(`[][.then][find] Error `, error.message);
                    reject(error);
                }
                else {
                    if (firebaseToken) {

                        tokens.forEach(element => {
                            let index = firebaseToken.tokenList.findIndex(item => item.token === element.token);
                            if (index > -1) {
                                if (!firebaseToken.tokenList[index].activeSubscriptions.includes(topic)) {
                                    firebaseToken.tokenList[index].activeSubscriptions.push(topic);
                                }
                            }
                        });

                        let query = { _id: firebaseToken._id };
                        FirebaseTokenUser.updateFirebaseTokenUser(query, { $set: firebaseToken }, (error, doc) => {
                            if (error) {
                                resolve(false);
                            }
                            else {
                                if (doc != null) {
                                    resolve(true);
                                }
                            }
                        });

                    }
                    else {
                        resolve(false);
                    }
                }
            });

        });
    },
    removeTopicFromActiveTopics: function (userId, topic, tokens) {
        return new Promise((resolve, reject) => {

            FirebaseTokenUser.findOne({ userId: userId }, (error, firebaseToken) => {
                if (error) {
                    console.error(`[][.then][find] Error `, error.message);
                    reject(error);
                }
                else {
                    if (firebaseToken) {

                        tokens.forEach(element => {
                            let index = firebaseToken.tokenList.findIndex(item => item.token === element.token);
                            if (index > -1) {
                                let removeIndex = firebaseToken.tokenList[index].activeSubscriptions.indexOf(topic);
                                if (removeIndex > -1) {
                                    firebaseToken.tokenList[index].activeSubscriptions.splice(removeIndex, 1);
                                }
                            }
                        });

                        let query = { _id: firebaseToken._id };
                        FirebaseTokenUser.updateFirebaseTokenUser(query, { $set: firebaseToken }, (error, doc) => {
                            if (error) {
                                resolve(false);
                            }
                            else {
                                if (doc != null) {
                                    resolve(true);
                                }
                            }
                        });

                    }
                    else {
                        resolve(false);
                    }
                }
            });

        });
    },
    subscribeToTopic: function (res, admin, tokensInfo, topic, userId) {
        return new Promise((resolve, reject) => {

            let registrationTokens = [];
            tokensInfo.map(tokenInfo => {
                registrationTokens.push(tokenInfo.token);
            });

            admin.
                messaging().
                subscribeToTopic(registrationTokens, topic)
                .then((response) => {
                    // See the MessagingTopicManagementResponse reference documentation
                    // for the contents of response.
                    if (response.errors.length !== 0) {
                        console.log('Failed subscription to topic:', response);
                    } else {
                        console.log('Successfully subscribed to topic:', response);
                    }

                    this.addTopicToActiveTopics(userId, topic, tokensInfo)
                        .then((result) => {

                            if (result) {
                                resolve(true);
                            }
                            else {
                                resolve(false);
                            }

                        }).catch((error) => {
                            return res.status(400).send(error);
                        });


                })
                .catch(function (error) {
                    console.log('Error subscribing to topic:', error);
                    return res.status(400).send({ code: 'subscription_to_topic_error', message: "Topic subscription failed" });
                });

        });

    },
    unsubscribeFromTopic: function (res, admin, tokensInfo, topic, userId) {
        return new Promise((resolve, reject) => {

            let registrationTokens = [];
            tokensInfo.map(tokenInfo => {
                registrationTokens.push(tokenInfo.token);
            });

            admin.
                messaging().
                unsubscribeFromTopic(registrationTokens, topic)
                .then((response) => {
                    // See the MessagingTopicManagementResponse reference documentation
                    // for the contents of response.
                    if (response.errors.length !== 0) {
                        console.log('Failed unsubscribed from topic:', response);
                    } else {
                        console.log('Successfully unsubscribed from topic:', response);
                    }

                    this.removeTopicFromActiveTopics(userId, topic, tokensInfo)
                        .then((result) => {

                            if (result) {
                                resolve(true);
                            }
                            else {
                                resolve(false);
                            }

                        }).catch((error) => {
                            return res.status(400).send(error);
                        });

                    //return res.status(200).send({ code: 'subscription_to_topic_success', message: "Topic subscription successful" });
                })
                .catch(function (error) {
                    console.log('Error subscribing to topic:', error);
                    return res.status(400).send({ code: 'subscription_to_topic_error', message: "Topic subscription failed" });
                });

        });

    },
    getUserStoredTokens: function (userId, notificationType, bypassNotificationSettings = false) {
        return new Promise((resolve, reject) => {

            FirebaseTokenUser.findOne({ userId: userId }, async (error, firebaseToken) => {
                if (error) {
                    reject(error);
                }
                else {
                    //console.log("firebaseToken", firebaseToken);
                    if (firebaseToken) {
                        let tokenList = [];

                        const clientTypesToNotity = bypassNotificationSettings ? ["android","iOS","BackOffice"] : await this.checkUserNotificationsSettings(userId, notificationType);

                        console.log("clientTypesToNotity", clientTypesToNotity);
                        firebaseToken.tokenList.forEach(element => {
                            if (clientTypesToNotity.includes(element.clientType)) {
                                let token = {
                                    token: element.token
                                }
                                tokenList.push(token);
                            }
                        });

                        resolve(tokenList);
                    }
                    else {
                        resolve([]);
                    }
                }
            });

        });
    },
    checkUserNotificationsSettings: function (userId, notificationType) {
        return new Promise((resolve, reject) => {

            var host = process.env.ConfigsHost + process.env.PathCheckNotificationSettings;

            let params = {
                userId: userId,
                notificationType: notificationType
            }

            axios.get(host, { params })
                .then((result) => {
                    if (result) {
                        let clientTypesToNotity = result.data;
                        resolve(clientTypesToNotity);
                    } else {
                        resolve([]);
                    }
                })
                .catch((error) => {
                    console.error("No settings for the user", error);
                    resolve([]);
                });

        });
    },
    createBillingPeriodExcelColumns: (translations) => {
        const context = "Function createBillingPeriodExcelColumns"
        try {
            return [
                { header: getKeyValue(translations, "report_startDate"), key: 'startDate' },
                { header: getKeyValue(translations, "report_stopDate"), key: 'stopDate' },
                { header: getKeyValue(translations, "report_network"), key: 'network' },
                { header: getKeyValue(translations, "report_charger"), key: 'hwId' },
                { header: getKeyValue(translations, "report_city"), key: 'city' },
                { header: getKeyValue(translations, "report_durationInMin"), key: 'durationMin' },
                { header: getKeyValue(translations, "report_energyInKWh"), key: 'totalPower' },
                { header: getKeyValue(translations, "report_timeChargedInMin"), key: 'realTimeCharging' },
                { header: getKeyValue(translations, "report_averagePower"), key: 'averagePower' },
                { header: getKeyValue(translations, "report_co2"), key: 'CO2emitted' },
                { header: getKeyValue(translations, "report_totalExclVat"), key: 'totalExclVat' },
                { header: getKeyValue(translations, "report_vatRate"), key: 'vat' },
                { header: getKeyValue(translations, "report_totalInclVat"), key: 'totalInclVat' },
                { header: getKeyValue(translations, "report_fleet"), key: 'fleetName' },
                { header: getKeyValue(translations, "report_ev"), key: 'licensePlate' },
                { header: getKeyValue(translations, "report_group"), key: 'groupName' },
                { header: getKeyValue(translations, "report_user"), key: 'userIdName' },
                { header: getKeyValue(translations, "report_userIdWillPayName"), key: 'userIdWillPayName' },
                { header: getKeyValue(translations, "report_documentNumber"), key: 'documentNumber' },
                { header: getKeyValue(translations, "report_emissionDate"), key: 'emissionDate' },
                { header: getKeyValue(translations, "report_dueDate"), key: 'dueDate' },
                { header: getKeyValue(translations, "report_billingPeriodStart"), key: 'billingPeriodStart' },
                { header: getKeyValue(translations, "report_billingPeriodEnd"), key: 'billingPeriodEnd' },
                { header: getKeyValue(translations, "report_durationAfterCharge"), key: 'parkingMin' },
                { header: getKeyValue(translations, "report_activationFee"), key: 'activationFee' },
                { header: getKeyValue(translations, "report_tariffEnergy"), key: 'energyTariff' },
                { header: getKeyValue(translations, "report_tariffTime"), key: 'timeTariff' },
                { header: getKeyValue(translations, "report_parkingDuringCharge"), key: 'chargingUseTariff' },
                { header: getKeyValue(translations, "report_parkingTariff"), key: 'parkingTariff' },
                { header: getKeyValue(translations, "report_roamingTimeCost"), key: 'roamingTimeCost' },
                { header: getKeyValue(translations, "report_roamingEnergyCost"), key: 'roamingEnergyCost' },
                { header: getKeyValue(translations, "report_voltageLevel"), key: 'voltageLevel' },
                { header: getKeyValue(translations, "report_energyConsumedEmpty"), key: 'energyConsumedEmpty' },
                { header: getKeyValue(translations, "report_energyConsumedOutEmpty"), key: 'energyConsumedOutEmpty' },
                { header: getKeyValue(translations, "report_mobieCemeTotal"), key: 'cemeTotalPrice' },
                { header: getKeyValue(translations, "report_cemeFlatTariff"), key: 'cemeFlatTariff' },
                { header: getKeyValue(translations, "report_unitPriceCEMEEmpty"), key: 'unitPriceCEMEEmpty' },
                { header: getKeyValue(translations, "report_unitPriceCEMEOutEmpty"), key: 'unitPriceCEMEOutEmpty' },
                { header: getKeyValue(translations, "report_mobieTarTotal"), key: 'tarTotalPrice' },
                { header: getKeyValue(translations, "report_unitPriceTAREmptyMT"), key: 'unitPriceTAREmptyMT' },
                { header: getKeyValue(translations, "report_unitPriceTAROutEmptyMT"), key: 'unitPriceTAROutEmptyMT' },
                { header: getKeyValue(translations, "report_unitPriceTAREmptyBT"), key: 'unitPriceTAREmptyBT' },
                { header: getKeyValue(translations, "report_unitPriceTAROutEmptyBT"), key: 'unitPriceTAROutEmptyBT' },
                { header: getKeyValue(translations, "report_mobieOpcTotal"), key: 'opcTotalPrice' },
                { header: getKeyValue(translations, "report_unitPriceOPCTime"), key: 'unitPriceOPCTime' },
                { header: getKeyValue(translations, "report_unitPriceOPCEnergy"), key: 'unitPriceOPCEnergy' },
                { header: getKeyValue(translations, "report_opcTimeCost"), key: 'opcTimeCost' },
                { header: getKeyValue(translations, "report_opcEnergyCost"), key: 'opcEnergyCost' },
                { header: getKeyValue(translations, "report_opcFlatCost"), key: 'opcFlatCost' },
                { header: getKeyValue(translations, "report_mobieSupportEM"), key: 'mobiEGrant' },
                { header: getKeyValue(translations, "report_mobieIecTotal"), key: 'iecTotalPrice' },
            ]
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return []
        }
    },
    createBillingPeriodExcelLines: (invoice, attach, billingDates) => {
        const context = "Function createBillingPeriodExcelLines"
        try {
            let attachLines = attach.chargingSessions.lines
            let sessions = attachLines.map(obj => Object.values(obj)[0]).flat(1).sort((a, b) => moment(a.startDateTime) - moment(b.startDateTime))
            let excelLines = mappingExcelLinesValues(sessions, invoice, billingDates)
            return excelLines
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return []
        }
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
            console.error(`[${context}] Error `, error.message);
            return null
        }
    },
    sendFailedEmailToSentry: (email, error) => {
        // Remove the content of the attachments and let only the filename
        if (email.requestBody?.mailOptions?.attachments?.length > 0) {
            email.requestBody.mailOptions.attachments = email.requestBody.mailOptions.attachments.map(attachment => attachment.filename);
        }
        Sentry.captureException(error, email);
        console.log(`Failed to send ${email.requestBody.mailOptions.type} email to ${ email.requestBody.mailOptions.to}`);
    }

}

function getKeyValue(translations, key) {
    const context = "Function getKeyValue"
    try {
        return translations.find(translation => translation.key === key).value
    } catch (error) {
        console.log(`[Error][${context}]`, error.message);
        return key
    }
}

function mappingExcelLinesValues(sessions, invoice, billingDates) {
    const context = "Function mappingExcelLinesValues"
    try {
        let excelLines = []
        let otherNetworksNumber = {
            international: {
                exists: false,
                number: 1,
            },
            whiteLabel: {
                exists: false,
                number: 1,
            },
        }
        for (let session of sessions) {
            if (session.network === process.env.NetworkEVIO /* "EVIO" */) {
                excelLines.push(
                    {
                        'startDate': insertSessionValue(moment(session.startDateTime).format("DD/MM/YYYY HH:mm")),
                        'stopDate': insertSessionValue(moment(session.endDateTime).format("DD/MM/YYYY HH:mm")),
                        'network': insertSessionValue(session.network),
                        'hwId': insertSessionValue(session.hwId),
                        'city': insertSessionValue(session.city),
                        'durationMin': insertSessionValue(session.durationMin),
                        'totalPower': insertSessionValue(session.totalPower),
                        'realTimeCharging': insertSessionValue(session.realTimeCharging),
                        'averagePower': insertSessionValue(session.averagePower),
                        'CO2emitted': insertSessionValue(session.CO2emitted),
                        'totalExclVat': insertSessionValue(session.total_exc_vat),
                        'vat': insertSessionValue(session.vat),
                        'totalInclVat': insertSessionValue(session.total_inc_vat),
                        'fleetName': insertSessionValue(session.fleetName),
                        'licensePlate': insertSessionValue(session.licensePlate),
                        'groupName': insertSessionValue(session.groupName),
                        'userIdName': insertSessionValue(session.userIdName),
                        'userIdWillPayName': insertSessionValue(session.userIdWillPayName),
                        'documentNumber': invoice.documentNumber,
                        'emissionDate': insertSessionValue(billingDates.emissionDate),
                        'dueDate': insertSessionValue(billingDates.dueDate),
                        'billingPeriodStart': insertSessionValue(billingDates.startDate ? moment(billingDates.startDate).format("YYYY-MM-DD") : billingDates.startDate),
                        'billingPeriodEnd': insertSessionValue(billingDates.startDate ? moment(billingDates.endDate).format("YYYY-MM-DD") : billingDates.startDate),
                        'parkingMin': insertSessionValue(session.parkingMin),
                        'activationFee': insertSessionValue(session.opcFlatCost),
                        'energyTariff': insertSessionValue(session.tariffEnergy),
                        'timeTariff': insertSessionValue(session.tariffTime),
                        'chargingUseTariff': insertSessionValue(session.parkingDuringChargingTariff),
                        'parkingTariff': insertSessionValue(session.charging_after_parking),
                        'roamingTimeCost': insertSessionValue(null),
                        'roamingEnergyCost': insertSessionValue(null),
                        'voltageLevel': insertSessionValue(null),
                        'energyConsumedEmpty': insertSessionValue(null),
                        'energyConsumedOutEmpty': insertSessionValue(null),
                        'cemeTotalPrice': insertSessionValue(null),
                        'cemeFlatTariff': insertSessionValue(null),
                        'unitPriceCEMEEmpty': insertSessionValue(null),
                        'unitPriceCEMEOutEmpty': insertSessionValue(null),
                        'tarTotalPrice': insertSessionValue(null),
                        'unitPriceTAREmptyMT': insertSessionValue(null),
                        'unitPriceTAROutEmptyMT': insertSessionValue(null),
                        'unitPriceTAREmptyBT': insertSessionValue(null),
                        'unitPriceTAROutEmptyBT': insertSessionValue(null),
                        'opcTotalPrice': insertSessionValue(null),
                        'unitPriceOPCTime': insertSessionValue(null),
                        'unitPriceOPCEnergy': insertSessionValue(null),
                        'opcTimeCost': insertSessionValue(null),
                        'opcEnergyCost': insertSessionValue(null),
                        'opcFlatCost': insertSessionValue(null),
                        'mobiEGrant': insertSessionValue(null),
                        'iecTotalPrice': insertSessionValue(null),
                    }
                )
            } else if (session.network === process.env.NetworkMobiE /* "MobiE" */) {
                excelLines.push(
                    {
                        'startDate': insertSessionValue(moment(session.startDateTime).format("DD/MM/YYYY HH:mm")),
                        'stopDate': insertSessionValue(moment(session.endDateTime).format("DD/MM/YYYY HH:mm")),
                        'network': insertSessionValue(session.network),
                        'hwId': insertSessionValue(session.hwId),
                        'city': insertSessionValue(session.city),
                        'durationMin': insertSessionValue(session.durationMin),
                        'totalPower': insertSessionValue(session.totalPower),
                        'realTimeCharging': insertSessionValue(session.realTimeCharging),
                        'averagePower': insertSessionValue(session.averagePower),
                        'CO2emitted': insertSessionValue(session.CO2emitted),
                        'totalExclVat': insertSessionValue(session.total_exc_vat),
                        'vat': insertSessionValue(session.vat),
                        'totalInclVat': insertSessionValue(session.total_inc_vat),
                        'fleetName': insertSessionValue(session.fleetName),
                        'licensePlate': insertSessionValue(session.licensePlate),
                        'groupName': insertSessionValue(session.groupName),
                        'userIdName': insertSessionValue(session.userIdName),
                        'userIdWillPayName': insertSessionValue(session.userIdWillPayName),
                        'documentNumber': invoice.documentNumber,
                        'emissionDate': insertSessionValue(billingDates.emissionDate),
                        'dueDate': insertSessionValue(billingDates.dueDate),
                        'billingPeriodStart': insertSessionValue(billingDates.startDate ? moment(billingDates.startDate).format("YYYY-MM-DD") : billingDates.startDate),
                        'billingPeriodEnd': insertSessionValue(billingDates.startDate ? moment(billingDates.endDate).format("YYYY-MM-DD") : billingDates.startDate),
                        'parkingMin': insertSessionValue(null),
                        'activationFee': insertSessionValue(null),
                        'energyTariff': insertSessionValue(null),
                        'timeTariff': insertSessionValue(null),
                        'chargingUseTariff': insertSessionValue(null),
                        'parkingTariff': insertSessionValue(null),
                        'roamingTimeCost': insertSessionValue(null),
                        'roamingEnergyCost': insertSessionValue(null),
                        'voltageLevel': insertSessionValue(session.voltageLevel),
                        'energyConsumedEmpty': insertSessionValue(session.energyConsumedEmpty),
                        'energyConsumedOutEmpty': insertSessionValue(session.energyConsumedOutEmpty),
                        'cemeTotalPrice': insertSessionValue(session.cemeTotalPrice),
                        'cemeFlatTariff': insertSessionValue(session.activationFee),
                        'unitPriceCEMEEmpty': insertSessionValue(session.unitPriceCEMEEmptyBT),
                        'unitPriceCEMEOutEmpty': insertSessionValue(session.unitPriceCEMEOutEmptyBT),
                        'tarTotalPrice': insertSessionValue(session.tar),
                        'unitPriceTAREmptyMT': insertSessionValue(session.unitPriceTAREmptyMT),
                        'unitPriceTAROutEmptyMT': insertSessionValue(session.unitPriceTAROutEmptyMT),
                        'unitPriceTAREmptyBT': insertSessionValue(session.unitPriceTAREmptyBT),
                        'unitPriceTAROutEmptyBT': insertSessionValue(session.unitPriceTAROutEmptyBT),
                        'opcTotalPrice': insertSessionValue(session.opcTotalPrice),
                        'unitPriceOPCTime': insertSessionValue(session.unitPriceOPCTime),
                        'unitPriceOPCEnergy': insertSessionValue(session.unitPriceOPCEnergy),
                        'opcTimeCost': insertSessionValue(session.opcTimeCost),
                        'opcEnergyCost': insertSessionValue(session.opcEnergyCost),
                        'opcFlatCost': insertSessionValue(session.opcFlatCost),
                        'mobiEGrant': insertSessionValue(session.mobiEGrant),
                        'iecTotalPrice': insertSessionValue(session.iec),
                    }
                )
            } else if (session.network === process.env.NetworkInternational  /* "Gireve" */) {
                let network = getNetworkToExcel(session.network, invoice, otherNetworksNumber, "international")
                excelLines.push(
                    {
                        'startDate': insertSessionValue(moment(session.startDateTime).format("DD/MM/YYYY HH:mm")),
                        'stopDate': insertSessionValue(moment(session.endDateTime).format("DD/MM/YYYY HH:mm")),
                        'network': insertSessionValue(network),
                        'hwId': insertSessionValue(session.hwId),
                        'city': insertSessionValue(session.country),
                        'durationMin': insertSessionValue(session.durationMin),
                        'totalPower': insertSessionValue(session.totalPower),
                        'realTimeCharging': insertSessionValue(session.realTimeCharging),
                        'averagePower': insertSessionValue(session.averagePower),
                        'CO2emitted': insertSessionValue(session.CO2emitted),
                        'totalExclVat': insertSessionValue(session.total_exc_vat),
                        'vat': insertSessionValue(session.vat),
                        'totalInclVat': insertSessionValue(session.total_inc_vat),
                        'fleetName': insertSessionValue(session.fleetName),
                        'licensePlate': insertSessionValue(session.licensePlate),
                        'groupName': insertSessionValue(session.groupName),
                        'userIdName': insertSessionValue(session.userIdName),
                        'userIdWillPayName': insertSessionValue(session.userIdWillPayName),
                        'documentNumber': invoice.documentNumber,
                        'emissionDate': insertSessionValue(billingDates.emissionDate),
                        'dueDate': insertSessionValue(billingDates.dueDate),
                        'billingPeriodStart': insertSessionValue(billingDates.startDate ? moment(billingDates.startDate).format("YYYY-MM-DD") : billingDates.startDate),
                        'billingPeriodEnd': insertSessionValue(billingDates.startDate ? moment(billingDates.endDate).format("YYYY-MM-DD") : billingDates.startDate),
                        'parkingMin': insertSessionValue(null),
                        'activationFee': insertSessionValue(session.flatCost),
                        'energyTariff': insertSessionValue(session.unitPriceRoamingEnergy),
                        'timeTariff': insertSessionValue(session.unitPriceRoamingTime),
                        'chargingUseTariff': insertSessionValue(null),
                        'parkingTariff': insertSessionValue(null),
                        'roamingTimeCost': insertSessionValue(session.timeCost),
                        'roamingEnergyCost': insertSessionValue(session.energyCost),
                        'voltageLevel': insertSessionValue(session.voltageLevel),
                        'energyConsumedEmpty': insertSessionValue(null),
                        'energyConsumedOutEmpty': insertSessionValue(null),
                        'cemeTotalPrice': insertSessionValue(null),
                        'cemeFlatTariff': insertSessionValue(null),
                        'unitPriceCEMEEmpty': insertSessionValue(null),
                        'unitPriceCEMEOutEmpty': insertSessionValue(null),
                        'tarTotalPrice': insertSessionValue(null),
                        'unitPriceTAREmptyMT': insertSessionValue(null),
                        'unitPriceTAROutEmptyMT': insertSessionValue(null),
                        'unitPriceTAREmptyBT': insertSessionValue(null),
                        'unitPriceTAROutEmptyBT': insertSessionValue(null),
                        'opcTotalPrice': insertSessionValue(null),
                        'unitPriceOPCTime': insertSessionValue(null),
                        'unitPriceOPCEnergy': insertSessionValue(null),
                        'opcTimeCost': insertSessionValue(null),
                        'opcEnergyCost': insertSessionValue(null),
                        'opcFlatCost': insertSessionValue(null),
                        'mobiEGrant': insertSessionValue(null),
                        'iecTotalPrice': insertSessionValue(null),
                    }
                )
                incrementOtherNetworksNumber(otherNetworksNumber, "international")
            } else if (session.network === process.env.NetworkGoCharge || session.network === process.env.NetworkHyundai || session.network === process.env.NetworkKLC || session.network === process.env.NetworkKinto/* "EVIO" */) {
                let network = getNetworkToExcel(session.network, invoice, otherNetworksNumber, "whiteLabel")
                excelLines.push(
                    {
                        'startDate': insertSessionValue(moment(session.startDateTime).format("DD/MM/YYYY HH:mm")),
                        'stopDate': insertSessionValue(moment(session.endDateTime).format("DD/MM/YYYY HH:mm")),
                        'network': insertSessionValue(network),
                        'hwId': insertSessionValue(session.hwId),
                        'city': insertSessionValue(session.city),
                        'durationMin': insertSessionValue(session.durationMin),
                        'totalPower': insertSessionValue(session.totalPower),
                        'realTimeCharging': insertSessionValue(session.realTimeCharging),
                        'averagePower': insertSessionValue(session.averagePower),
                        'CO2emitted': insertSessionValue(session.CO2emitted),
                        'totalExclVat': insertSessionValue(session.total_exc_vat),
                        'vat': insertSessionValue(session.vat),
                        'totalInclVat': insertSessionValue(session.total_inc_vat),
                        'fleetName': insertSessionValue(session.fleetName),
                        'licensePlate': insertSessionValue(session.licensePlate),
                        'groupName': insertSessionValue(session.groupName),
                        'userIdName': insertSessionValue(session.userIdName),
                        'userIdWillPayName': insertSessionValue(session.userIdWillPayName),
                        'documentNumber': invoice.documentNumber,
                        'emissionDate': insertSessionValue(billingDates.emissionDate),
                        'dueDate': insertSessionValue(billingDates.dueDate),
                        'billingPeriodStart': insertSessionValue(billingDates.startDate ? moment(billingDates.startDate).format("YYYY-MM-DD") : billingDates.startDate),
                        'billingPeriodEnd': insertSessionValue(billingDates.startDate ? moment(billingDates.endDate).format("YYYY-MM-DD") : billingDates.startDate),
                        'parkingMin': insertSessionValue(session.parkingMin),
                        'activationFee': insertSessionValue(session.opcFlatCost),
                        'energyTariff': insertSessionValue(session.tariffEnergy),
                        'timeTariff': insertSessionValue(session.tariffTime),
                        'chargingUseTariff': insertSessionValue(session.parkingDuringChargingTariff),
                        'parkingTariff': insertSessionValue(session.charging_after_parking),
                        'roamingTimeCost': insertSessionValue(null),
                        'roamingEnergyCost': insertSessionValue(null),
                        'voltageLevel': insertSessionValue(null),
                        'energyConsumedEmpty': insertSessionValue(null),
                        'energyConsumedOutEmpty': insertSessionValue(null),
                        'cemeTotalPrice': insertSessionValue(null),
                        'cemeFlatTariff': insertSessionValue(null),
                        'unitPriceCEMEEmpty': insertSessionValue(null),
                        'unitPriceCEMEOutEmpty': insertSessionValue(null),
                        'tarTotalPrice': insertSessionValue(null),
                        'unitPriceTAREmptyMT': insertSessionValue(null),
                        'unitPriceTAROutEmptyMT': insertSessionValue(null),
                        'unitPriceTAREmptyBT': insertSessionValue(null),
                        'unitPriceTAROutEmptyBT': insertSessionValue(null),
                        'opcTotalPrice': insertSessionValue(null),
                        'unitPriceOPCTime': insertSessionValue(null),
                        'unitPriceOPCEnergy': insertSessionValue(null),
                        'opcTimeCost': insertSessionValue(null),
                        'opcEnergyCost': insertSessionValue(null),
                        'opcFlatCost': insertSessionValue(null),
                        'mobiEGrant': insertSessionValue(null),
                        'iecTotalPrice': insertSessionValue(null),
                    }
                )
                incrementOtherNetworksNumber(otherNetworksNumber, "whiteLabel")

            }
        }
        return excelLines
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return []
    }
}

function insertSessionValue(value) {
    const context = "Function insertSessionValue"
    try {
        return value !== null && value !== undefined && value !== "" ? value : "-"
    } catch (error) {
        console.log(`[Error][${context}]`, error.message);
        return "-"
    }
}

function incrementOtherNetworksNumber(otherNetworksNumber, network) {
    otherNetworksNumber[network].exists = true
    for (let otherNetwork in otherNetworksNumber) {
        if (!otherNetworksNumber[otherNetwork].exists) {
            otherNetworksNumber[otherNetwork].number += 1
        }
    }
}

function getNetworkToExcel(sessionNetwork, invoice, otherNetworksNumber, network) {

    if (invoice.clientName === process.env.clientNameHyundai) {
        if (sessionNetwork === process.env.NetworkGoCharge || sessionNetwork === process.env.NetworkInternational || sessionNetwork === process.env.NetworkKLC || sessionNetwork === process.env.NetworkKinto) {
            return `Outras redes ${otherNetworksNumber[network].number}`
        } else {
            return sessionNetwork
        }
    } else if (invoice.clientName === process.env.clientNameSC) {
        if (sessionNetwork === process.env.NetworkHyundai || sessionNetwork === process.env.NetworkInternational || sessionNetwork === process.env.NetworkKLC || sessionNetwork === process.env.NetworkKinto) {
            return `Outras redes ${otherNetworksNumber[network].number}`
        } else {
            return sessionNetwork
        }
    } else if (invoice.clientName === process.env.clientNameKLC) {
        if (sessionNetwork === process.env.NetworkHyundai || sessionNetwork === process.env.NetworkInternational || sessionNetwork === process.env.NetworkGoCharge || sessionNetwork === process.env.NetworkKinto) {
            return `Outras redes ${otherNetworksNumber[network].number}`
        } else {
            return sessionNetwork
        }
    } else if (invoice.clientName === process.env.WhiteLabelKinto) {
        if (sessionNetwork === process.env.NetworkHyundai || sessionNetwork === process.env.NetworkInternational || sessionNetwork === process.env.NetworkGoCharge || sessionNetwork === process.env.NetworkKLC) {
            return `Outras redes ${otherNetworksNumber[network].number}`
        } else {
            return sessionNetwork
        }
    } else {
        if (sessionNetwork === process.env.NetworkHyundai || sessionNetwork === process.env.NetworkGoCharge || sessionNetwork === process.env.NetworkInternational || sessionNetwork === process.env.NetworkKLC || sessionNetwork === process.env.NetworkKinto) {
            return `Outras redes ${otherNetworksNumber[network].number}`
        } else {
            return sessionNetwork
        }
    }

}
module.exports = Utils;