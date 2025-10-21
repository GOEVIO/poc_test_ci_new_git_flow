const axios = require("axios");
const Session = require('./models/sessions')
const moment = require('moment');


const notificationsProxy = 'http://notifications:3008';
const firebaseStart = `${notificationsProxy}/api/private/firebase/start`;
const firebaseStop = `${notificationsProxy}/api/private/firebase/stop`;
const firebaseData = `${notificationsProxy}/api/private/firebase/data`;

const notificationsFirebaseWLProxy = 'http://notifications-firebase-wl:3032';
const firebaseWLStart = `${notificationsFirebaseWLProxy}/api/private/firebase/start`;
const firebaseWLStop = `${notificationsFirebaseWLProxy}/api/private/firebase/stop`;
const firebaseWLData = `${notificationsFirebaseWLProxy}/api/private/firebase/data`;

var UtilsFirebase = {

    startFirebaseNotification(sessions) {
        var context = "Function startFirebaseNotification";

        try {

            sessions.forEach(session => {
                let body = {
                    _id: session._id,
                    hwId: session.location_id,
                    plugId: session.connector_id,
                    userId: session.userId,
                    instantPower: 0
                }


                if (session.kwh === undefined || session.kwh === null) {
                    body.totalPower = 0;
                }
                else {
                    body.totalPower = session.kwh * 1000;
                }

                if (session.estimatedPrice === undefined || session.estimatedPrice === null) {
                    body.estimatedPrice = 0;
                }
                else {
                    body.estimatedPrice = session.estimatedPrice;
                }

                if (session.timeCharged === undefined || session.timeCharged === null) {
                    body.timeCharged = 0;
                }
                else {
                    body.timeCharged = session.timeCharged;
                }

                if (session.batteryCharged === undefined || session.batteryCharged === null) {
                    body.batteryCharged = -1;
                }
                else {
                    body.batteryCharged = session.batteryCharged;
                }

                if (session.total_cost) {
                    if (session.total_cost.incl_vat !== null &&  session.total_cost.incl_vat !== undefined) {
                        body.estimatedPrice = session.total_cost.incl_vat
                    } else {
                        body.estimatedPrice = 0
                    }
                } else {
                    body.estimatedPrice = 0
                }

                if (session.clientName === "EVIO") {
                    axios.post(firebaseStart, body)
                        .then((response) => {
                            if (response) {
                                updateNotificationsHistory(session , 'CHARGING_SESSION_START')
                                console.log(`[${context}] Firebase start notification sent successfully`);
                            }
                            else {
                                console.log(`[${context}] Error `, response);
                            }
                        })
                        .catch((error) => {
                            //console.log("error", error.response.status);
                            if (error.response != undefined && error.response.status === 400) {
                                console.log(`[${context}] Error `, error.response.data);
                            }
                            else {
                                console.log(`[${context}] Error `, error.message);
                            };
                        });
                } else {

                    axios.post(firebaseWLStart, body)
                        .then((response) => {
                            if (response) {
                                updateNotificationsHistory(session , 'CHARGING_SESSION_START')
                                console.log(`[${context}] Firebase start notification sent successfully`);
                            }
                            else {
                                console.log(`[${context}] Error `, response);
                            }
                        })
                        .catch((error) => {
                            //console.log("error", error.response.status);
                            if (error.response != undefined && error.response.status === 400) {
                                console.log(`[${context}] Error `, error.response.data);
                            }
                            else {
                                console.log(`[${context}] Error `, error.message);
                            };
                        });
                }
            });

        } catch (error) {
            console.log(`[${context}] Error `, error);
            //return res.status(500).send(error.message);
        };

    },

    stopFirebaseNotification(sessions) {
        var context = "Function stopFirebaseNotification";

        try {

            sessions.forEach(session => {
                let body = {
                    _id: session._id,
                    hwId: session.location_id,
                    plugId: session.connector_id,
                    userId: session.userId,
                }

                if (session.kwh === undefined || session.kwh === null) {
                    body.totalPower = 0;
                }
                else {
                    body.totalPower = session.kwh * 1000;
                }

                if (session.estimatedPrice === undefined || session.estimatedPrice === null) {
                    body.estimatedPrice = 0;
                }
                else {
                    body.estimatedPrice = session.estimatedPrice;
                }

                if (session.timeCharged === undefined || session.timeCharged === null) {
                    body.timeCharged = 0;
                }
                else {
                    body.timeCharged = session.timeCharged;
                }

                if (session.batteryCharged === undefined || session.batteryCharged === null) {
                    body.batteryCharged = -1;
                }
                else {
                    body.batteryCharged = session.batteryCharged;
                }

                if (session.readingPoints.length !== 0) {
                    if (session.readingPoints[session.readingPoints.length - 1].kwh !== undefined) {
                        body.instantPower = session.readingPoints[session.readingPoints.length - 1].kwh;
                    }
                    else {
                        body.instantPower = 0;
                    }
                }
                else {
                    body.instantPower = 0;
                }

                if (session.total_cost) {
                    if (session.total_cost.incl_vat !== null &&  session.total_cost.incl_vat !== undefined) {
                        body.estimatedPrice = session.total_cost.incl_vat
                    } else {
                        body.estimatedPrice = 0
                    }
                } else {
                    body.estimatedPrice = 0
                }

                if (session.clientName === "EVIO") {
                    axios.post(firebaseStop, body)
                        .then((response) => {
                            if (response) {
                                updateNotificationsHistory(session , 'CHARGING_SESSION_STOP')
                                console.log(`[${context}] Firebase stop notification sent successfully`);
                            } else {
                                console.log(`[${context}] Error `, response);
                            }
                        })
                        .catch((error) => {
                            if (error.response) {
                                if (error.response.status === 400) {
                                    console.log(`[${context}] Error `, error.response.data);
                                }
                                else {
                                    console.log(`[${context}] Error `, error.response);
                                };
                            }
                            else {
                                console.log(`[${context}] Error `, error.message);
                            };
                        });
                } else {
                    axios.post(firebaseWLStop, body)
                        .then((response) => {
                            if (response) {
                                updateNotificationsHistory(session , 'CHARGING_SESSION_STOP')
                                console.log(`[${context}] Firebase stop notification sent successfully`);
                            } else {
                                console.log(`[${context}] Error `, response);
                            }
                        })
                        .catch((error) => {
                            if (error.response) {
                                if (error.response.status === 400) {
                                    console.log(`[${context}] Error `, error.response.data);
                                }
                                else {
                                    console.log(`[${context}] Error `, error.response);
                                };
                            }
                            else {
                                console.log(`[${context}] Error `, error.message);
                            };
                        });
                }
            });

        } catch (error) {
            console.log(`[${context}] Error `, error);
            //return res.status(500).send(error.message);
        };

    },

    dataFirebaseNotification(session, readPoint) {
        var context = "Function dataFirebaseNotification";

        try {
            if (session.readingPoints.length !== 0) {

                let body = {
                    _id: session._id,
                    instantPower: session.readingPoints[session.readingPoints.length - 1].instantPower,
                    totalPower: readPoint.totalPower,
                    estimatedPrice: readPoint.estimatedPrice,
                    timeCharged: readPoint.timeCharged,
                    userId: session.userId
                }

                if (readPoint.batteryCharged === undefined || readPoint.batteryCharged === null) {
                    body.batteryCharged = -1;
                }
                else {
                    body.batteryCharged = readPoint.batteryCharged;
                }

                if (body.instantPower === undefined || body.instantPower === null) {
                    body.instantPower = 0;
                }

                if (session.total_cost) {
                    if (session.total_cost.incl_vat !== null &&  session.total_cost.incl_vat !== undefined) {
                        body.estimatedPrice = session.total_cost.incl_vat
                    } else {
                        body.estimatedPrice = 0
                    }
                } else {
                    body.estimatedPrice = 0
                }

                if (session.clientName === "EVIO") {
                    axios.post(firebaseData, body)
                        .then((response) => {
                            if (response) {
                                updateNotificationsHistory(session , 'CHARGING_SESSION_DATA')
                                console.log(`[${context}] Firebase session update notification sent successfully`);
                            } else {
                                console.log(`[${context}] Error `, response);
                            }
                        })
                        .catch((error) => {
                            if (error.response != undefined && error.response.status === 400) {
                                console.log(`[${context}] Error `, error.response.data);
                            }
                            else {
                                console.log(`[${context}] Error `, error.message);
                            };
                        });
                } else {

                    axios.post(firebaseWLData, body)
                        .then((response) => {
                            if (response) {
                                updateNotificationsHistory(session , 'CHARGING_SESSION_DATA')
                                console.log(`[${context}] Firebase session update notification sent successfully`);
                            } else {
                                console.log(`[${context}] Error `, response);
                            }
                        })
                        .catch((error) => {
                            if (error.response != undefined && error.response.status === 400) {
                                console.log(`[${context}] Error `, error.response.data);
                            }
                            else {
                                console.log(`[${context}] Error `, error.message);
                            };
                        });
                }
            }

        } catch (error) {
            console.log(`[${context}] Error `, error);
            //return res.status(500).send(error.message);
        };

    }

}


async function updateNotificationsHistory(session , type) {
    const context = "Function updateNotificationsHistory"
    try {
        return await Session.findOneAndUpdate({_id : session._id} , { $push: { notificationsHistory: { type: type, timestamp : notificationTimestamp(session , type) , totalPower : notificationTotalPower(session) } } })
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
    }
}

function notificationTimestamp(session , type) {
    const context = "Function notificationTimestamp"
    try {
        switch (type) {
            case 'CHARGING_SESSION_START':
                return session.start_date_time ? moment.utc(session.start_date_time).format() : new Date().toISOString()
            case 'CHARGING_SESSION_STOP':
                return session.end_date_time ? moment.utc(session.end_date_time).format() : new Date().toISOString()
            case 'CHARGING_SESSION_DATA':
                return session.readingPoints.length > 0 ?  moment.utc(session.readingPoints[session.readingPoints.length -1].readDate).format() : new Date().toISOString()
            default:
                return new Date().toISOString()
        };
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return new Date().toISOString()
    }
}

function notificationTotalPower(session) {
    const context = "Function notificationTotalPower"
    try {
        return session.kwh ? session.kwh * 1000 : 0
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return 0
    }
}

module.exports = UtilsFirebase;
