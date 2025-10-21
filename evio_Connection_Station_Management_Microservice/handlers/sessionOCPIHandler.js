require("dotenv-safe").load();
const axios = require("axios");

module.exports = {
    getSessionsPeriodic: function (userId, dateNow, paymentPeriod) {
        var context = "Function OCPI getSessionsPeriodic";
        return new Promise(async (resolve, reject) => {
            try {

                var host = process.env.HostChargingSessionMobie + process.env.PathGetSessionsToPaymentPeriodics;
                var data = {

                    userIdWillPay: userId,
                    status: process.env.SessionStatusStoppedOCPI,
                    $and: [
                        { cdrId: { $ne: "-1" } },
                        { cdrId: { $ne: "NA" } }
                    ],
                    paymentType: paymentPeriod,

                    stopTransactionReceived: true,
                    $or: [
                        { paymentId: "" },
                        { paymentId: null }
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
                    end_date_time: { $lte: dateNow }

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