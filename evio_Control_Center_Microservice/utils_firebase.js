const axios = require("axios");

var notificationsProxy = 'http://notifications:3008';
const firebaseStart = `${notificationsProxy}/api/private/firebase/start`;
const firebaseStop = `${notificationsProxy}/api/private/firebase/stop`;
const firebaseData = `${notificationsProxy}/api/private/firebase/data`;

var notificationsFirebaseWLProxy = 'http://notifications-firebase-wl:3032';
const firebaseStartWL = `${notificationsFirebaseWLProxy}/api/private/firebase/start`;
const firebaseStopWL = `${notificationsFirebaseWLProxy}/api/private/firebase/stop`;
const firebaseDataWL = `${notificationsFirebaseWLProxy}/api/private/firebase/data`;

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

                if (session.kwh === undefined) {
                    body.totalPower = 0;
                }
                else {
                    body.totalPower = session.totalPower;
                }

                if (session.estimatedPrice === undefined) {
                    body.estimatedPrice = 0;
                }
                else {
                    body.estimatedPrice = session.estimatedPrice;
                }

                if (session.timeCharged === undefined) {
                    body.timeCharged = 0;
                }
                else {
                    body.timeCharged = session.timeCharged;
                }

                if (session.batteryCharged === undefined) {
                    body.batteryCharged = -1;
                }
                else {
                    body.batteryCharged = session.batteryCharged;
                }

                if (session.clientName === "EVIO") {
                    axios.post(firebaseStart, body)
                        .then((response) => {
                            if (response) {
                                console.log(`[${context}] Firebase start notification sent successfully`);
                            }
                            else {
                                console.error(`[${context}] Error `, response);
                            }
                        })
                        .catch((error) => {
                            //console.log("error", error.response.status);
                            if (error.response != undefined && error.response.status === 400) {
                                console.error(`[${context}] Error `, error.response.data);
                            }
                            else {
                                console.error(`[${context}] Error `, error.message);
                            };
                        });
                } else {
                    axios.post(firebaseStartWL, body)
                        .then((response) => {
                            if (response) {
                                console.log(`[${context}] Firebase start notification sent successfully`);
                            }
                            else {
                                console.error(`[${context}] Error `, response);
                            }
                        })
                        .catch((error) => {
                            //console.log("error", error.response.status);
                            if (error.response != undefined && error.response.status === 400) {
                                console.error(`[${context}] Error `, error.response.data);
                            }
                            else {
                                console.error(`[${context}] Error `, error.message);
                            };
                        });
                }
            });

        } catch (error) {
            console.error(`[${context}] Error `, error);
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

                if (session.kwh === undefined) {
                    body.totalPower = 0;
                }
                else {
                    body.totalPower = session.totalPower;
                }

                if (session.estimatedPrice === undefined) {
                    body.estimatedPrice = 0;
                }
                else {
                    body.estimatedPrice = session.estimatedPrice;
                }

                if (session.timeCharged === undefined) {
                    body.timeCharged = 0;
                }
                else {
                    body.timeCharged = session.timeCharged;
                }

                if (session.batteryCharged === undefined) {
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

                if (session.clientName === "EVIO") {
                    axios.post(firebaseStop, body)
                        .then((response) => {
                            if (response) {
                                console.log(`[${context}] Firebase stop notification sent successfully`);
                            } else {
                                console.error(`[${context}] Error `, response);
                            }
                        })
                        .catch((error) => {
                            if (error.response) {
                                if (error.response.status === 400) {
                                    console.error(`[${context}] Error `, error.response.data);
                                }
                                else {
                                    console.error(`[${context}] Error `, error.response);
                                };
                            }
                            else {
                                console.error(`[${context}] Error `, error.message);
                            };
                        });
                } else {
                    axios.post(firebaseStopWL, body)
                        .then((response) => {
                            if (response) {
                                console.log(`[${context}] Firebase stop notification sent successfully`);
                            } else {
                                console.error(`[${context}] Error `, response);
                            }
                        })
                        .catch((error) => {
                            if (error.response) {
                                if (error.response.status === 400) {
                                    console.error(`[${context}] Error `, error.response.data);
                                }
                                else {
                                    console.error(`[${context}] Error `, error.response);
                                };
                            }
                            else {
                                console.error(`[${context}] Error `, error.message);
                            };
                        });
                }
            });

        } catch (error) {
            console.error(`[${context}] Error `, error);
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

                if (readPoint.batteryCharged === undefined) {
                    body.batteryCharged = -1;
                }
                else {
                    body.batteryCharged = readPoint.batteryCharged;
                }

                if (body.instantPower === undefined) {
                    body.instantPower = 0;
                }

                if (session.clientName === "EVIO") {
                    axios.post(firebaseData, body)
                        .then((response) => {
                            if (response) {
                                console.log(`[${context}] Firebase session update notification sent successfully`);
                            } else {
                                console.error(`[${context}] Error `, response);
                            }
                        })
                        .catch((error) => {
                            if (error.response != undefined && error.response.status === 400) {
                                console.error(`[${context}] Error `, error.response.data);
                            }
                            else {
                                console.error(`[${context}] Error `, error.message);
                            };
                        });
                } else {
                    axios.post(firebaseDataWL, body)
                        .then((response) => {
                            if (response) {
                                console.log(`[${context}] Firebase session update notification sent successfully`);
                            } else {
                                console.error(`[${context}] Error `, response);
                            }
                        })
                        .catch((error) => {
                            if (error.response != undefined && error.response.status === 400) {
                                console.error(`[${context}] Error `, error.response.data);
                            }
                            else {
                                console.error(`[${context}] Error `, error.message);
                            };
                        });
                }
            }

        } catch (error) {
            console.error(`[${context}] Error `, error);
            //return res.status(500).send(error.message);
        };

    }

}

module.exports = UtilsFirebase;
