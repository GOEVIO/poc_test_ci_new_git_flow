const moment = require('moment');//For calculate time
require("dotenv-safe").load();

//Deprecated
function sessionsStatisticsController() {
    const getSessionAveragesPower = function (resChargingSession, chargingSession) {
        return new Promise((resolve, reject) => {
            var context = "Function getSessionAveragesPower";
            try {
                //Add a multiPointer

                if (chargingSession.multiPointer !== null) {
                    resChargingSession.multiPointer.push.apply(resChargingSession.multiPointer, chargingSession.multiPointer);
                }

                if (chargingSession.command === process.env.StopCommand) {
                    resChargingSession.command = chargingSession.command;
                    resChargingSession.status = process.env.SessionStatusStopped
                }

                var arrayLength = resChargingSession.multiPointer.length;
                var averagePowerEvio = 0;
                var timeCharged;

                resChargingSession.multiPointer.forEach((item, index) => {

                    averagePowerEvio = averagePowerEvio + item['power'];

                    //Calc of time charged
                    if (index === arrayLength - 1) {
                        var startDate = moment(resChargingSession.startDate, "YYYY-MM-DD'T'HH:mm:ss:SSSZ");
                        var readData = moment(item['readDate'], "YYYY-MM-DD'T'HH:mm:ss:SSSZ");
                        var diff = moment.duration(startDate.diff(readData));
                        if (diff < 0) {
                            diff = Math.abs(diff);
                        }
                        timeCharged = moment.utc(diff).format("HH:mm:ss");
                        //console.log(timeCharged);
                        resChargingSession.timeCharged = moment.duration(timeCharged).asSeconds();
                        //console.log(resChargingSession.timeCharged);

                    };
                });
                //Calc of the average power
                resChargingSession.averagePowerEvio = averagePowerEvio / arrayLength;

                //Calc battery charged
                var timeFullCharged = 12 * 3600 //Exemple for zoe (time in seconds)

                resChargingSession.batteryCharged = (resChargingSession.timeCharged * 100) / timeFullCharged //In %


            } catch (error) {
                console.log(`[${context}] Error `, error);
                return reject(new Error(error));
            }
            resolve(resChargingSession);
        });

    };

    const getSessionAveragesPrice = function (finalChargingSession, resCharger) {
        var context = "Function getSessionAveragesPrice";
        return new Promise((resolve, reject) => {
            try {

                //Calc of the average price

                //finalChargingSession.averagePriceEvio = 0.15 * finalChargingSession.averagePowerEvio;
                //console.log("Average Price Evio: " + finalChargingSession.averagePriceEvio);

                // When the charger have price.
                //finalChargingSession.averagePriceEvio = resCharger.price * (finalChargingSession.averagePowerEvio / (finalChargingSession.timeCharged / 3600)); // price * (kw/h) - current price
                if (resCharger && finalChargingSession)
                    finalChargingSession.averagePriceEvio = (resCharger.price * 0.10) * (finalChargingSession.timeCharged / 60);

                //var price = (resCharger.price * 0.10) * (finalChargingSession.timeCharged / 60);

            } catch (error) {
                console.log(`[${context}] Error `, error);
                reject(new Error(error));
            };
            resolve(finalChargingSession);
        });
    };
    return { getSessionAveragesPower, getSessionAveragesPrice };
};

module.exports = sessionsStatisticsController;

