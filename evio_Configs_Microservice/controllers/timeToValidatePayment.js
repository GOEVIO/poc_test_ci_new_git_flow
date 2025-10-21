const TimeToValidatePayment = require('../models/timeToValidatePayment');
require("dotenv-safe").load();

module.exports = {
    addTimeToValidatePayment: function (req) {
        var context = "Function addTimeToValidatePayment";
        return new Promise((resolve, reject) => {
            var userId = req.headers['userid'];

            var timeToValidatePayment = new TimeToValidatePayment(req.body);
            timeToValidatePayment.userId = userId;

            var query = {
                active: true
            };
            var newValues = { $set: { active: false } };

            TimeToValidatePayment.updateTimeToValidatePayment(query, newValues, (err, result) => {

                if (err) {

                    console.log(`[${context}] Error `, err.message);
                    reject(err);

                }
                else {

                    TimeToValidatePayment.createTimeToValidatePayment(timeToValidatePayment, (err, result) => {

                        if (err) {

                            console.log(`[${context}] Error `, err.message);
                            reject(err);

                        }
                        else {

                            resolve(result);

                        };

                    });

                };

            });
        });
    },
    getTimeToValidatePayment: function (req) {
        var context = "Function getTimeToValidatePayment";
        return new Promise((resolve, reject) => {

            var query = {
                active: true
            };

            TimeToValidatePayment.findOne(query, (err, result) => {

                if (err) {

                    console.log(`[${context}] Error `, err.message);
                    reject(err);

                }
                else {

                    resolve(result);

                };

            });
        });
    }
}