var moment = require('moment');
const axios = require("axios");
const OperationCenterCommands = require('../entities/OperationCenterCommands');

var Utils = {
    updateChargingSessionStop: function (ServiceProxy, chargingSessionId, status, meterStop, timeCharged, finalPrice) {
        return new Promise((resolve, reject) => {
            var dateNow = moment();
            //console.log("Date", dateNow);
            var body = {
                _id: chargingSessionId,
                command: process.env.StopCommand,
                status: status,
                stopDate: dateNow,
                meterStop: Number(meterStop),
                timeCharged: timeCharged,
                finalPrice: finalPrice
            }

            axios.patch(ServiceProxy, { body })
                .catch((error) => {
                    console.log(error.response.data);
                })
                .finally(() => {
                    resolve(true);
                })

            /*
            .then(function (response) {
                resolve(true);
            })
            .catch(function (error) {
                //TODO VERY IMPORTANT
                //IN CASE OF FAILED, WE NEED TO PREVENT FAILS AND MARK TO PROCESS AGAIN LATER
                //IN THIS SCENARIO, CHARGING SESSION WAS ALREADY STOPED ON OCPP CHARGER BUT NOT ON EVIO STORAGE DATABASE
            })
            */
        })
    },
    updateStatusCharger: function (ServiceProxy, ServiceProxyStatus, params) {
        var context = "Function updateStatusCharger";
        return new Promise((resolve, reject) => {
            axios.get(ServiceProxy, { params })
                .then(function (response) {
                    var charger = response.data.charger[0];
                    if (typeof charger !== 'undefined') {

                        var body = {
                            _id: charger._id,
                            status: params.status
                        };

                        axios.patch(ServiceProxyStatus, body)
                            .then(function (response) {
                                resolve(true);
                            })
                            .catch(function (error) {
                                console.log(`[${context}][.catch] Error`, error.response.data.message);
                                reject(error.response.data.message);
                            });
                    }
                    else
                        resolve(true);
                }).catch(function (error) {
                    console.log(`[${context}] Error `, error.response.data.message);
                })
        })
    },
    updateChargerPlugStatus: function (ServiceProxy, params) {
        var context = "Function updateChargerPlugStatus";
        return new Promise((resolve, reject) => {

            var body = {
                _id: params._id,
                plugId: params.plugId,
                status: params.status
            }

            axios.patch(ServiceProxy, { body })
                .then(function (response) {
                    resolve(true);
                })
                .catch(function (error) {
                    console.log(`[${context}][.catch] Error `, error.response.data.message);
                    reject(error.response.data.message);
                });
        });
    },
    updateChargerPlugStatusChargeEnd: function (ServiceProxy, MultiStatusProxy, req) {
        var context = "Function updateChargerPlugStatusChargeEnd";
        return new Promise((resolve, reject) => {

            var params = {
                hwId: req.hwId
            };

            this.checkIfChargerExists(ServiceProxy, params).then((charger) => {
                if (charger) {
                    //TO DO define endpoint
                    if (!charger.data.charger[0]) {
                        console.log("Failed retriving charger");
                        reject(false);
                    }

                    var char = charger.data.charger[0];

                    var body = {
                        _id: char._id,
                        plugId: req.plugId,
                        status: req.status
                    }

                    axios.patch(MultiStatusProxy, { body })
                        .then(function (response) {
                            resolve(true);
                        })
                        .catch(function (error) {
                            console.log(`[${context}][.catch] Error `, error.response.data.message);
                            reject(error.response.data.message);
                        })
                }
            })
        })
    },
    checkIfChargerExists: function (ServiceProxy, params) {
        return new Promise((resolve, reject) => {
            axios.get(ServiceProxy, { params })
                .then(function (response) {

                    var charger = response.data.charger[0];

                    if (typeof charger === 'undefined') {
                        resolve(false);
                    }
                    else {
                        resolve(response);
                    }

                }).catch(function (error) {
                    console.log("error" + error);
                    console.log(error);
                    resolve(false);
                });
        })
    },
    updateChargerData: function (ServiceProxy, body) {
        return new Promise((resolve, reject) => {
            axios.patch(ServiceProxy, body)
                .then(function (response) {
                    resolve(true);
                })
                .catch(function (error) {
                    console.log("error", error);
                    reject(false);
                });
        })
    },
    updateChargingSessionData: function (ServiceProxy, body) {
        return new Promise((resolve, reject) => {
            axios.patch(ServiceProxy, { body })
                .then(function (response) {
                    resolve(true);
                })
                .catch(function (error) {
                    console.log("error", error);
                    reject(false);
                });
        })
    },
    getChargingSessionData: function (ServiceProxy, params) {
        return new Promise((resolve, reject) => {
            axios.get(ServiceProxy, { params })
                .then(function (response) {
                    if (response) {
                        var session = response.data.chargingSession[0];
                        if (typeof session === 'undefined') {
                            resolve(false);
                        }
                        else {
                            resolve(session);
                        }
                    }
                })
                .catch(function (error) {
                    console.log("error" + error);
                    console.log(error.response.data.message);
                    resolve(false);
                });
        })
    },
    getChargingSessionBodyData: function (ServiceProxy, data) {
        return new Promise((resolve, reject) => {
            axios.get(ServiceProxy, { data })
                .then(function (response) {
                    if (response) {

                        console.log("RESPOSTA");
                        console.log(response.data.chargingSession[0]);

                        var session = response.data.chargingSession[0];
                        if (typeof session === 'undefined') {
                            resolve(false);
                        }
                        else {
                            resolve(session);
                        }
                    }
                })
                .catch(function (error) {
                    console.log("error" + error);
                    console.log(error.response.data.message);
                    resolve(false);
                });
        })
    },
    checkIdTagValidity: function (ServiceProxy, params) {
        return new Promise((resolve, reject) => {
            axios.get(ServiceProxy, { params })
                .then(function (response) {
                    if (response) {
                        var contract = response.data.contract;
                        if (typeof contract === 'undefined') {
                            resolve(false);
                        }
                        else {
                            resolve(contract);
                        }
                    }
                    else
                        resolve(false);
                }).catch(function (error) {
                    console.log("error" + error);
                    console.log(error.response.data.message);
                    resolve(false);
                });
        });
    },
    getChargingTime: function (chargingSession) {
        var dateNow = moment().utc();

        var startDate = chargingSession.startDate;

        var duration = moment.duration(dateNow.diff(startDate));
        var timeChargedinSeconds = duration.asSeconds();
        return timeChargedinSeconds;
    },
    updateChargingSessionStatus: function (ServiceProxy, status, chargingSession) {

        var body = {
            _id: chargingSession._id,
            status: status
        }

        axios.patch(ServiceProxy, { body })
            .then(function (response) {
                console.log("Success");
            })
            .catch(function (error) {
                console.log(error);
            })
    },
    updateChargingSessionData: function (ServiceProxy, chargingSession, idTag, chargerType) {

        var body = {
            _id: chargingSession._id,
            idTag: idTag,
            chargerType: chargerType
        }

        axios.patch(ServiceProxy, { body })
            .then(function (response) {
                console.log("Success");
            })
            .catch(function (error) {
                console.log(error);

            })
    },
    updateStartChargingSessionData: function (ServiceProxy, body) {

        var body = {
            _id: body._id,
            meterStart: body.meterStart
        }

        axios.patch(ServiceProxy, { body })
            .then(function (response) {
                if (response) {
                    console.log("Success");
                }
            })
            .catch(function (error) {
                console.log(error);
            })
    },
    getEstimatedPrice: function (chargingSession) {
        var dateNow = moment().utc();
        var startDate = chargingSession.startDate;

        var duration = moment.duration(dateNow.diff(startDate));
        var hours = duration.asHours();
        var estimatedPrice = hours * chargingSession.sessionPrice;
        return estimatedPrice;
    },
    updateChargingSessionToStop: function (ServiceProxy, session, status) {
        return new Promise((resolve, reject) => {

            var dateNow = moment().utc();

            var body = {
                _id: session._id,
                command: process.env.StopCommand,
                status: status,
                stopDate: dateNow
            }

            console.log(body);

            axios.patch(ServiceProxy, { body })
                .catch((error) => {
                    console.log(error.response.data);
                })
                .finally(() => {
                    resolve(true);
                })

        })
    },
    updateChargingSessionPlugId: function (ServiceProxy, session, plugId) {
        return new Promise((resolve, reject) => {

            var body = {
                _id: session._id,
                plugId: plugId
            }

            console.log(body);

            axios.patch(ServiceProxy, { body })
                .catch((error) => {
                    console.log(error.response.data);
                })
                .finally(() => {
                    resolve(true);
                })

        })
    }
}

module.exports = Utils;