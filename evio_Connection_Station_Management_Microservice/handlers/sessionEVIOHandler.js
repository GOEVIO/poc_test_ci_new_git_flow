require("dotenv-safe").load();
const axios = require("axios");

module.exports = {
    getSessionsPeriodic: function (userId, dateNow, paymentPeriod) {
        var context = "Function EVIO getSessionsPeriodic";
        return new Promise(async (resolve, reject) => {
            try {

                var host = process.env.ChargersServiceProxy + process.env.PathGetSessionsToPaymentPeriodics
                var data = {

                    userIdWillPay: userId,
                    status: process.env.SessionStatusStopped,
                    stopTransactionReceived: true,
                    $and: [
                        { paymentMethod: { $ne: process.env.PaymentMethodNotPay } },
                        { paymentMethod: { $ne: process.env.PaymentMethodTypeTransfer } }
                    ],
                    $or: [
                        { paymentId: { "$exists": false } },
                        {
                            $and: [
                                { paymentId: { "$exists": true, $ne: "" } },
                                { paymentStatus: process.env.ChargingSessionPaymentStatusUnpaid }
                            ]
                        }
                    ],
                    paymentType: paymentPeriod,
                    stopDate: { $lte: dateNow }

                };

                axios.get(host, { data })
                    .then((response) => {

                        //console.log("response.data.length", response.data.length);
                        resolve(response.data);

                    })
                    .catch((error) => {

                        console.error(` [${context}] [${host}] Error `, error.message);
                        resolve([]);

                    });


            } catch (error) {

                console.error(`[${context}] Error `, error.message);
                resolve([]);

            };

        });
    }
};