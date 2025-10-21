const axios = require("axios");
const AxiosHandler = require("../services/axios");
const { logger } = require('../utils/constants');

module.exports = {
    getPaymentMethods: (userId) => {
        const context = "Funciton getPaymentMethods";
        return new Promise(async (resolve, reject) => {
            try {

                let headers = {
                    userid: userId
                };

                let proxyPayments = process.env.HostPayments + process.env.PathGetPaymentMethods;

                let result = await axios.get(proxyPayments, { headers })

                console.log(`Payment methods found for user ${userId}: ${result.data.length}`);

                resolve(result.data);
            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }
        });

    },
    getTariffCEME: (params) => {
        const context = "Funciton getTariffCEME";
        return new Promise(async (resolve, reject) => {
            try {

                let host = process.env.HostTariffCEME + process.env.PathTariffCEME;

                let result = await axios.get(host, { params })

                console.log(`Tariff found for user ${params.userId}: ${result.data.length}`);

                if (Object.keys(result.data).length != 0 && result.data.schedule.tariffType === process.env.TariffTypeBiHour) {
                    result.data = JSON.parse(JSON.stringify(result.data));
                    resolve(result.data);
                }
                else {
                    resolve(result.data);
                };

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }
        });

    },
    getTariffCEMERoaming: (tariffRoaming) => {
        const context = "Funciton getTariffCEMERoaming";
        return new Promise(async (resolve, reject) => {
            try {

                let plansId = [];

                await tariffRoaming.forEach(tariff => {
                    plansId.push(tariff.planId);
                });

                let params = {
                    _id: plansId
                };

                let host = process.env.HostTariffCEME + process.env.PathTariffCEMEbyCEME;
                let result = await axios.get(host, { params })

                resolve(result.data);

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }
        });

    },
    createMobiETokenType: (userId, body) => {
        const context = "Function createMobiETokenType";
        return new Promise(async (resolve, reject) => {
            try {

                let config = {
                    headers: {
                        userid: userId,
                        apikey: process.env.ocpiApiKey
                    }
                }

                let host = process.env.HostMobie + process.env.PathMobieTokens

                axios.put(host, body, config)
                    .then((response) => {
                        console.log(`MobiE ${body.type} ${body.uid} token created`)
                        resolve(response.data)
                    })
                    .catch((error) => {
                        if (error.response) {
                            console.log("body error", body);
                            console.log(`[${context}][${host}][400] Error `, error.response.data);
                            reject(error)
                        }
                        else {
                            console.log(`[${context}][${host}] Error `, error.message);
                            reject(error)
                        };

                    });

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error)
            };
        });
    },
    createInternationalTokenType: (userId, body, network) => {
        const context = "Function createInternationalTokenType";
        return new Promise(async (resolve, reject) => {
            try {

                let config = {
                    headers: {
                        userid: userId,
                        apikey: process.env.ocpiApiKey
                    }
                };

                let host = process.env.HostMobie + process.env.PathGireveTokens;

                axios.put(host, body, config)
                    .then((response) => {

                        if (body.type == process.env.TokensTypeOTHER) {
                            console.log(`${network} ${body.type} ${body.uid} token created`)
                            resolve(response.data)
                        } else {
                            resolve(body)
                        };

                    })
                    .catch((error) => {
                        if (error.response) {

                            console.log(`[${context}][${host}][400] Error `, error.response.data);
                            reject(error)
                            //resolve(body)
                        } else {

                            console.log(`[${context}][${host}] Error `, error.message);
                            reject(error)

                        };

                    });

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error)
            };
        });
    },
    sendEmails: (headers, mailOptions) => {
        const context = "Function sendEmails";

        let host = process.env.HostNotifications + process.env.PathNotificationsSendEmail;
        axios.post(host, { mailOptions }, { headers })
            .then((result) => {
                console.log("Email sent")
            })
            .catch((error) => {
                console.log(`[${context}][.catch] Error `, error.message);
            });
    },

    getTariffInfo: (contractsFound, paymentMethods) => {
        let context = "Function getTariffInfo";
        return new Promise(async (resolve, reject) => {
            try {

                let host = process.env.HostTariffCEME + process.env.PathGetTariffInfo
                let data = {
                    contractsFound: contractsFound,
                    paymentMethods: paymentMethods
                };

                let response = await AxiosHandler.axiosPatchBody(host, data)
                resolve(response);
            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                resolve(contractsFound);
            }
        })
    },
    sendNewMobileSMS: (user, code, headers) => {
        let context = "Function sendActivationSMS";
        return new Promise((resolve, reject) => {
            let host = process.env.HostNotifications + process.env.PathNotificationsChangeNumber;
            let params = {
                user: user,
                message: code,
                headers: headers
            };

            AxiosHandler.axiosPostBody(host, params)
                .then((result) => {
                    if (result)
                        resolve();
                    else
                        reject();
                })
                .catch((error) => {
                    console.log(`[${context}] Error `, error.message);
                    reject(error);
                });
        });
    },
    sendRecoverSMS: (user, code, headers) => {
        let context = "Function sendRecoverSMS";
        return new Promise((resolve, reject) => {
            try {
                let host = process.env.HostNotifications + process.env.PathNotificationsRecoverPassword;
                let params = {
                    user: user,
                    message: code,
                    headers: headers
                };
                AxiosHandler.axiosPostBody(host, params)
                    .then((result) => {
                        if (result)
                            resolve();
                        else
                            reject("SMS sent unsuccessfully!");
                    })
                    .catch((error) => {
                        console.log(`[${context}][.catch] Error `, error.message);
                        reject(error);
                    });
            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            };
        });
    }

}
