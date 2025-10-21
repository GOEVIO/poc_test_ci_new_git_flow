const PaymentMethod = require('../models/paymentMethod');
const walletHandler = require('./wallet');
const AxiosHandler = require("../services/axios");

module.exports = {
    getPaymentMethod: function (userId) {
        const context = "Function getPaymentMethod";
        return new Promise(async (resolve, reject) => {
            try {

                let paymentMethod = await PaymentMethod.find({ userId: userId, status: { $ne: process.env.PaymentMethodStatusExpired } });

                resolve(paymentMethod);

            } catch (error) {

                console.error(`[${context}] Error `, error.message);
                reject(error);

            };
        });
    },
    paymentMethodsFind: (query) => {
        let context = "Function paymentMethodsFind";
        return new Promise((resolve, reject) => {
            PaymentMethod.find(query, (err, paymentMethodsFound) => {
                if (err) {
                    console.error(`[${context}] Error `, err.message);
                    resolve(null);
                }
                else {

                    if (paymentMethodsFound.length > 0) {

                        paymentMethodsFound.sort((x, y) => { return x.defaultPaymentMethod - y.defaultPaymentMethod });
                        paymentMethodsFound.reverse();
                        resolve(paymentMethodsFound[0]);
                    }
                    else {
                        resolve(null);
                    };

                };
            });
        });
    },
    cardsExpiredBolckRFID: async () => {
        let context = "Function cardsExpiredBolckRFID";
        try {

            let query = {
                status: process.env.PaymentMethodStatusExpired
            };

            let paymentMethodsFound = await PaymentMethod.find(query);

            if (paymentMethodsFound.length > 0) {

                paymentMethodsFound.forEach(async paymentMethod => {
                    query = {
                        userId: paymentMethod.userId,
                        status: { $ne: process.env.PaymentMethodStatusExpired }
                    };
                    //console.log("query", query);

                    let listOfPaymentMethods = await PaymentMethod.find(query);

                    //console.log("listOfPaymentMethods.length", listOfPaymentMethods.length);
                    if (listOfPaymentMethods.length === 0) {

                        let walletFound = await walletHandler.getWallet(paymentMethod.userId);
                        //console.log("walletFound", walletFound);
                        if (walletFound) {
                            if (walletFound.amount.value < 20) {
                                let host = process.env.HostUser + process.env.PathBlockRfidCard;
                                let data = {
                                    userId: paymentMethod.userId
                                };

                                let rfidBlocked = await AxiosHandler.axiosPatchBody(host, data);

                                console.log("rfidBlocked ", rfidBlocked)

                            }
                        }

                    }

                })
            }

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
        };
    }
}