const express = require('express');
const router = express.Router();
// Disable node-cron by mocking for an easy turn-back 
// const cron = require('node-cron'); 
const cron = {
    schedule: ()=>({
     start: ()=>{},
     stop: ()=>{},   
     validate: ()=>{},
     status: '',
    })
};
const axios = require("axios");
const Charger = require('../models/charger');
const moment = require('moment');

const siemensHost = 'http://siemens-connection:3012';
const siemensChargerConnection = `${siemensHost}/api/private/siemens_protocol/endChargerConnection`;

const notificationsHost = 'http://notifications:3008';
const mailNotification = `${notificationsHost}/api/private/mailNotification`;
const checkMailRepeatNotification = `${notificationsHost}/api/private/chargerNotification`;

//========== job to check the charger heartbeat ==========

//console.log("process.env.NODE_ENV", process.env.NODE_ENV);
//if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'pre-production') {
//cron.schedule('*/20 * * * *', () => {
//cron.schedule('*/1 * * * *', () => {
/* console.log('running every 20 minutes');

        getChargersHeartbeat()
            .then((chargers) => {
                //console.log("chargers", chargers);
                if (chargers.length > 0) {

         console.log("hargers.length", chargers.length);
         if (chargers.length != 0) {

             let chargersList = [];

                        if (ch.chargerType == process.env.SiemensChargerType && ch.status == process.env.ChargePointStatusEVIO) {



                 if (ch.chargerType == process.env.SiemensChargerType
                     && ch.status == process.env.ChargePointStatusEVIO) {

                     var data = {
                         hwId: ch.hwId
                     }

                     axios.post(siemensChargerConnection, { data })
                         .then((response) => {
                             if (response) {
                                 console.log("Connection closed");
                             } else {
                                 console.log("Could not close connection");
                             }
                         })
                         .catch((error) => {
                             console.log("Siemens connection error");
                         });

                     return checkChargerRepeatNotification(ch)
                         .then((response) => {
                             if (response) {
                                 //console.log(response);
                                 if (response === 'send_email' && ch.offlineNotification) {

                                     chargersList.push(ch);

                                 }
                                 else {
                                     //console.log("Mail Notification not sent");
                                 }

                             }
                         })
                         .catch((error) => {
                             console.log("Siemens connection error");
                         });

                 }
                 else {

                     if (ch.status == process.env.ChargePointStatusEVIOFaulted) {

                         return checkChargerRepeatNotification(ch)
                             .then((response) => {
                                 if (response) {
                                     //console.log(response);

                                     if (response === 'send_email' && ch.offlineNotification) {

                                         chargersList.push(ch);

                                     }
                                     else {
                                         //console.log("Mail Notification not sent");
                                     }

                                 }
                             })
                             .catch((error) => {
                                 console.log("Siemens connection error");
                             });

                     }
                     else {

                         changeChargerStatus(ch.hwId)
                             .then((result) => {
                                 if (result) {
                                     console.log("Status changed: " + ch.hwId);
                                 } else {
                                     console.log("Status could not be changed: " + ch.hwId);
                                 }
                             })
                             .catch((error) => {
                                 console.log("Failed status update");
                             });

                         return checkChargerRepeatNotification(ch)
                             .then((response) => {
                                 if (response) {
                                     //console.log(response);

                                     if (response === 'send_email' && ch.offlineNotification) {

                                         chargersList.push(ch);

                                     }
                                     else {
                                         //console.log("Mail Notification not sent");
                                     }

                                 }
                             })
                             .catch((error) => {
                                 console.log("Siemens connection error");
                             });

                     }

                 }

             });

             console.log("chargersList", chargersList);
             Promise.all(chargersRequests)
                 .then(() => {

                     if (chargersList.length != 0) {
                         sendMailNotifications(chargersList)
                             .then((result) => {
                                 if (result) {
                                     console.log(chargersList.length + " Mail Notifications scheduled successfully");
                                 }
                                 else {
                                     console.log("Mail Notifications not sent");
                                 }
                             });
                     }
                     else {
                         console.log("No Mail Notifications to send");
                     }

                 }).catch((error) => {
                     console.log("Unabled to send notifications");
                 })

         }
     });

});
//}*/

//console.log("process.env.NODE_ENV", process.env.NODE_ENV);
if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'pre-production') {
    cron.schedule('0 0 * * *', () => {
        //cron.schedule('*/1 * * * *', () => {
        console.log('running every day at 00:00 ');

        getChargersHeartbeat()
            .then((chargers) => {

                //console.log("hargers.length", chargers.length);
                if (chargers.length != 0) {

                    let chargersList = [];

                    const chargersRequests = (ch) => {

                        return new Promise(async (resolve, reject) => {

                            if (ch.chargerType == process.env.SiemensChargerType && ch.status == process.env.ChargePointStatusEVIO) {

                                let data = {
                                    hwId: ch.hwId
                                }

                                axios.post(siemensChargerConnection, { data })
                                    .then((response) => {
                                        if (response) {
                                            console.log("Connection closed");
                                        } else {
                                            console.log("Could not close connection");
                                        }
                                    })
                                    .catch((error) => {
                                        console.log("Siemens connection error");
                                    });

                                checkChargerRepeatNotification(ch)
                                    .then((response) => {
                                        if (response) {
                                            //console.log(response);
                                            if (response === 'send_email' && ch.offlineNotification) {

                                                chargersList.push(ch);
                                                resolve(true)

                                            }
                                            else {
                                                //console.log("Mail Notification not sent");
                                                resolve(false)
                                            }

                                        }
                                    })
                                    .catch((error) => {
                                        console.log("Siemens connection error");
                                        resolve(false)
                                    });

                            } else {
                                //console.log("2")
                                if (ch.status == process.env.ChargePointStatusEVIOFaulted) {
                                    //console.log("3")
                                    checkChargerRepeatNotification(ch)
                                        .then((response) => {
                                            if (response) {
                                                //console.log(response);

                                                if (response === 'send_email' && ch.offlineNotification) {

                                                    chargersList.push(ch);
                                                    resolve(true)
                                                }
                                                else {
                                                    console.log("Mail Notification not sent");
                                                    resolve(false)
                                                }

                                            } else {
                                                resolve(false)
                                            }
                                        })
                                        .catch((error) => {
                                            console.log("Siemens connection error");
                                            resolve(false)
                                        });

                                }
                                else {
                                    //console.log("4")
                                    changeChargerStatus(ch.hwId)
                                        .then((result) => {
                                            if (result) {
                                                console.log("Status changed: " + ch.hwId);
                                            } else {
                                                console.log("Status could not be changed: " + ch.hwId);
                                            }
                                        })
                                        .catch((error) => {
                                            console.log("Failed status update");
                                        });

                                    checkChargerRepeatNotification(ch)
                                        .then((response) => {
                                            if (response) {
                                                //console.log(response);

                                                if (response === 'send_email' && ch.offlineNotification) {

                                                    chargersList.push(ch);
                                                    resolve(true)

                                                }
                                                else {
                                                    //console.log("Mail Notification not sent");
                                                    resolve(false)
                                                }

                                            }
                                        })
                                        .catch((error) => {
                                            console.log("Siemens connection error");
                                            resolve(false)
                                        });

                                }

                            }

                        });

                    };

                    console.log("chargersList 0", chargersList);
                    Promise.all(chargers.map(ch => chargersRequests(ch)))
                        .then(() => {
                            console.log("chargersList 1", chargersList);
                            if (chargersList.length > 0) {
                                sendMailNotifications(chargersList)
                                    .then((result) => {
                                        if (result) {
                                            console.log(chargersList.length + " Mail Notifications scheduled successfully");
                                        }
                                        else {
                                            console.log("Mail Notifications not sent");
                                        }
                                    });
                            }
                            else {
                                console.log("No Mail Notifications to send");
                            }

                        }).catch((error) => {
                            console.log("Unabled to send notifications");
                        })

                }
            });
    });
}

const getChargersHeartbeat = (() => {
    const context = "Function getChargersHeartbeat";
    return new Promise((resolve, reject) => {

        let lastUpdateDate = moment.utc();
        lastUpdateDate = lastUpdateDate.subtract(process.env.MonitoringHeartBeatInterval, 'minutes').format();

        console.log(lastUpdateDate.toString());

        let query = {
            heartBeat: {
                $lte: lastUpdateDate
            },
            hasInfrastructure: true,
            active: true,
            // offlineNotification: true
        };

        let fields = {
            hwId: 1,
            chargerType: 1,
            status: 1,
            createUser: 1,
            heartBeat: 1,
            offlineNotification: 1,
            offlineEmailNotification: 1,
            clientName: 1
        }

        Charger.find(query, fields, (err, chargers) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);
                resolve([]);
            }
            else {
                if (chargers.length == 0) {
                    console.log("No chargers found");
                    resolve([]);
                }
                else {

                    /*
                    var listOfChargers = [];
                    chargers = JSON.parse(JSON.stringify(chargers));
 
                    for (elem of chargers) {
                        let c = {
                            hwId: elem.hwId,
                            chargerType: elem.chargerType,
                            status: elem.status,
                            createUser: elem.createUser,
                            lastHeartBeat: elem.heartBeat,
                            offlineNotification: elem.offlineNotification,
                            offlineEmailNotification: elem.offlineEmailNotification
                        }
                        listOfChargers.push(c);
                    }
                    */

                    resolve(chargers);
                }
            }
        });

    });
});

//change status to 50
const changeChargerStatus = ((chargerId) => {
    return new Promise((resolve, reject) => {

        if (chargerId !== undefined) {

            var query = {
                hwId: chargerId,
                hasInfrastructure: true,
                active: true
            }

            Charger.findOne(query, (error, result) => {
                if (error) {
                    console.log("Could not perform the operation");
                }
                else {
                    if (result) {
                        result.status = process.env.ChargePointStatusEVIOFaulted;
                        var newValues = { $set: result };
                        try {
                            Charger.updateCharger(query, newValues, (err, result) => {
                                if (err) {
                                    console.log("[Error] " + err.message);
                                    reject(err);
                                } else {
                                    if (result) {
                                        resolve(true);
                                    } else {
                                        resolve(false);
                                    }
                                }
                            });
                        } catch (error) {
                            console.log("[Error] " + error);
                            reject(error);
                        }

                    }
                }
            });

        }

    });
});

const sendMailNotifications = ((chargersInfoList) => {
    return new Promise((resolve, reject) => {

        let chargersList = [];

        chargersInfoList.map(chargerInfo => {

            let data = {
                hwId: chargerInfo.hwId,
                createUser: chargerInfo.createUser,
                lastHeartBeat: chargerInfo.heartBeat,
                offlineNotification: chargerInfo.offlineNotification,
                offlineEmailNotification: chargerInfo.offlineEmailNotification,
                clientName: chargerInfo.clientName
            }

            chargersList.push(data);

        });

        //console.log("chargersInfoList", chargersInfoList);

        axios.post(mailNotification, { chargersList })
            .then((response) => {
                if (response) {
                    //console.log(response.message);
                    resolve(true);
                } else {
                    console.log("[Error] Mail Notification error");
                    resolve(false);
                }
            });

    });
});

const checkChargerRepeatNotification = ((chargerInfo) => {
    return new Promise((resolve, reject) => {

        var data = {
            hwId: chargerInfo.hwId,
            interval: process.env.MonitoringRepeatMailInterval,
            lastHeartBeat: chargerInfo.heartBeat
        }

        axios.post(checkMailRepeatNotification, { data })
            .then((response) => {
                if (response) {
                    resolve(response.data.code);
                }
            });
    });

});

module.exports = router;