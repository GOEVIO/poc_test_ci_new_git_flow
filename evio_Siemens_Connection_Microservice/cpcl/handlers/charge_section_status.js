const ChargingPointResponse = require('../entities/OperationCenterResponses')
var moment = require('moment');
const Utils = require('../entities/Utils');
const OperationCenterCommands = require('../../cpcl/entities/OperationCenterCommands');

var host = 'http://chargers:3002';
//var host = 'http://localhost:3002';

const chargingSessionServiceProxy = `${host}/api/private/chargingSession`;
const chargerServiceProxy = `${host}/api/private/chargers/status`;
const chargerServiceMultiStatusProxy = `${host}/api/private/chargers/multiStatus`;
const chargingSessionSiemensServiceProxy = `${host}/api/private/chargingSession/siemens`;

var plug_status = '0';

module.exports = {
    handle: function (data) {
        return new Promise(function (resolve, reject) {

            console.log(JSON.stringify("[Charging Station] Charge Section Status Operation"));

            try {
                var command_id = data["command"]["$"]["id"].toString();
                var values = data["command"]["STATES"]["0"];
                var id = null;
                var sn = null;
                var iec_plug = null;
                var household_plug = null;

                for (var attribute in values) {
                    if (attribute === 'Section_State') {
                        id = values[attribute][0]["ID"][0];
                        console.log(attribute + ": " + id);
                    }
                    if (attribute === 'Sn') {
                        sn = values[attribute][0];
                        console.log(attribute + ": " + sn);
                    }
                    if (attribute === 'IEC_Plug_Present') {
                        iec_plug = values[attribute][0];
                        console.log(attribute + ": " + iec_plug);
                    }
                    if (attribute === 'Household_Plug_Present') {
                        household_plug = values[attribute][0];
                        console.log(attribute + ": " + household_plug);
                    }
                }

                if (id != null && sn != null) {
                    console.log("Entra section state");
                    setTimeout(() => {
                        console.log("enter timeout");
                        chargingPointStatus(id, sn);
                    }, 3 * 1000);
                    resolve(false);
                }

                if (iec_plug != null && sn != null) {

                    if (plug_status == "0") {

                        plug_status = "1";

                        //validação de plug e sem timeout
                        console.log("SN_REPORT1: " + sn);


                        getCurrentSession(sn).then(session => {
                            if (session) {
                                console.log("Entra session1");
                                checkIECPlugStatus(iec_plug, session, sn);

                                resolve(false);
                            }
                        })

                        resolve(false);

                    } else {

                        console.log("interlock cicle");
                        setTimeout(() => {
                            console.log("enter timeout");
                            plugICEStatus(sn, iec_plug);
                        }, 20 * 1000);

                        resolve(false);

                    }

                }

                if (household_plug != null && sn != null) {

                    if (plug_status == "0") {

                        plug_status = "1";

                        //validação de plug e sem timeout
                        console.log("SN_REPORT2: " + sn);

                        getCurrentSession(sn).then(session => {
                            if (session) {
                                console.log("Entra session2");
                                checkSchukoPlugStatus(household_plug, session, sn);

                                resolve(false);
                            }
                        })

                        resolve(false);

                    } else {

                        console.log("houseplug cicle");
                        setTimeout(() => {
                            console.log("enter timeout");
                            plugHouseholdStatus(sn, household_plug);
                        }, 20 * 1000);

                        resolve(false);

                    }

                }


                /*if (iec_plug != null && sn != null) {

                    if (plug_status == "0") {

                        plug_status = "1";

                        console.log("SN_REPORT: " + sn);

                        var chargingSession = getStartedSession(sn);

                        if (chargingSession) {

                            if (iec_plug == "true") {

                                console.log("TYPE 2");

                                console.log("Find session");
                                if (session.plugId !== "1") {
                                    console.log("Change to Type2");
                                    Utils.updateChargingSessionPlugId(chargingSessionServiceProxy, chargingSession, process.env.SiemensType2PlugId);
                                }
                                resolve(false);

                            } else {

                                console.log("SCHUKO");

                                console.log("Find session");
                                if (session.plugId !== "2") {
                                    console.log("Change to SCHUKO");
                                    Utils.updateChargingSessionPlugId(chargingSessionServiceProxy, chargingSession, process.env.SiemensSchukoPlugId);
                                }
                                resolve(false);
                            }

                        }

                    } else {

                        console.log("interlock cicle");
                        setTimeout(() => {
                            console.log("enter timeout");
                            plugICEStatus(sn, iec_plug);
                        }, 20 * 1000);

                        resolve(false);
                    }

                }*/

                /*if (household_plug != null && sn != null) {
                    console.log("houseplug cicle");
                    setTimeout(() => {
                        console.log("enter timeout");
                        plugHouseholdStatus(sn, household_plug);
                    }, 20 * 1000);
                    resolve(false);
                }*/

            } catch (error) {
                console.log('[MESSAGE] error: ' + error);
                resolve(false);
            }

        })
    }
}

/*
const getStartedSession = (hwId) => {

    console.log("Get Started Session");

    var data = {
        $and: [
            {
                hwId: hwId
            },
            {
                $or: [
                    {
                        status: process.env.SessionStatusToStart
                    },
                    {
                        status: process.env.SessionStatusRunning
                    }
                ]
            }
        ]
    }

    Utils.getChargingSessionBodyData(chargingSessionSiemensServiceProxy, data)
        .then(session => {

            console.log(session);

            if (session) {
                return session;
            }
            else {
                return false;
            }
        })
}
*/

const getCurrentSession = (hwId) => {
    return new Promise(function (resolve, reject) {

        var params = {
            hwId: hwId,
            status: process.env.SessionStatusStopped
        }

        Utils.getChargingSessionData(chargingSessionServiceProxy, params)
            .then(session => {
                if (session) {

                    console.log("Descobre session")

                    if (session) {
                        resolve(session);
                    }
                    else {
                        resolve(false);
                    }
                }

            })

    })
}

const checkIECPlugStatus = (iec_plug, session, sn) => {
    return new Promise(function (resolve, reject) {

        if (iec_plug == "true") {

            console.log("TYPE1 2");

            console.log("Find session");
            if (session.plugId !== "1") {
                console.log("Change to Type2");
                Utils.updateChargingSessionPlugId(chargingSessionServiceProxy, session, process.env.SiemensType2PlugId);
            }

            plugICEStatus(sn, "true");

            resolve(false);

        } else {

            console.log("SCHUKO1");

            console.log("Find session");
            if (session.plugId !== "2") {
                console.log("Change to SCHUKO");
                Utils.updateChargingSessionPlugId(chargingSessionServiceProxy, session, process.env.SiemensSchukoPlugId);
            }

            plugHouseholdStatus(sn, "true");

            resolve(false);

        }

    })

}


const checkSchukoPlugStatus = (household_plug, session, sn) => {
    return new Promise(function (resolve, reject) {

        if (household_plug == "true") {

            console.log("SCHUKO2");

            console.log("Find session");
            if (session.plugId !== "2") {
                console.log("Change to SCHUKO");
                Utils.updateChargingSessionPlugId(chargingSessionServiceProxy, session, process.env.SiemensSchukoPlugId);
            }

            plugHouseholdStatus(sn, "true");

            resolve(false);

        } else {

            console.log("TYPE2 2");

            console.log("Find session");
            if (session.plugId !== "1") {
                console.log("Change to Type2");
                Utils.updateChargingSessionPlugId(chargingSessionServiceProxy, session, process.env.SiemensType2PlugId);
            }

            plugICEStatus(sn, "true");

            resolve(false);

        }

    })

}



const chargingPointStatus = (id, sn) => {
    return new Promise(function (resolve, reject) {

        var params = {
            hwId: sn,
            status: process.env.SessionStatusToStart
        }

        Utils.getChargingSessionData(chargingSessionServiceProxy, params)
            .then(session => {
                if (session) {

                    let status = session.status;
                    console.log("Status: " + status);

                    if (process.env.SiemensChargingStatus != Number(id)
                        && process.env.SiemensSuspendedStatus != Number(id)) {

                        let newId = moment().format('YYYY-MM-DDTHH:mm:ss');
                        let statusNew = OperationCenterCommands.chargingStationStatus(newId);

                        var charger = {
                            hwId: session.hwId
                        }

                        console.log("Start Transaction");

                        process.send({
                            status: statusNew,
                            charger: charger
                        });

                        console.log("Passa aqui");

                        resolve(false);

                    } else {

                        if (session.status == process.env.SessionStatusToStart) {
                            console.log("Changed Status to running. WAY1");
                            Utils.updateChargingSessionStatus(chargingSessionServiceProxy,
                                process.env.SessionStatusRunning, session);
                        }

                        resolve(false);
                    }
                }
                else {
                    resolve(false);
                }
            })
            .finally(() => {
                resolve(false);
            })

    })

};

const plugICEStatus = (sn, iec_plug) => {
    return new Promise(function (resolve, reject) {

        var params = {
            hwId: sn
            //status: process.env.SessionStatusToStart
        }

        Utils.getChargingSessionData(chargingSessionServiceProxy, params)
            .then(session => {
                if (session) {

                    console.log("IEC plug");

                    if (iec_plug.toString() == "true") {

                        console.log("IEC plug true");

                        let newId = moment().format('YYYY-MM-DDTHH:mm:ss');
                        let plugStatus = OperationCenterCommands.chargingStationIECPlugStatus(newId);

                        var charger = {
                            hwId: session.hwId
                        }

                        process.send({
                            plug: plugStatus,
                            charger: charger
                        })

                        resolve(false);

                    } else {

                        console.log("IEC plug false");

                        var body = {
                            hwId: session.hwId,
                            plugId: session.plugId,
                            status: process.env.PlugStatusAvailable
                        }

                        console.log(body);

                        Utils.updateChargerPlugStatusChargeEnd(chargerServiceProxy, chargerServiceMultiStatusProxy, body);

                        plug_status = "0";

                        resolve(true);
                    }

                }
                else {
                    resolve(false);
                }
            })
            .finally(() => {
                resolve(false);
            })

    })

};

const plugHouseholdStatus = (sn, household_plug) => {
    return new Promise(function (resolve, reject) {

        var params = {
            hwId: sn
            //status: process.env.SessionStatusToStart
        }

        Utils.getChargingSessionData(chargingSessionServiceProxy, params)
            .then(session => {
                if (session) {

                    if (household_plug.toString() == "true") {

                        let newId = moment().format('YYYY-MM-DDTHH:mm:ss');
                        let plugStatus = OperationCenterCommands.chargingStationHouseholdPlugStatus(newId);

                        var charger = {
                            hwId: session.hwId
                        }

                        process.send({
                            plug: plugStatus,
                            charger: charger
                        })

                        resolve(false);

                    } else {

                        var body = {
                            hwId: session.hwId,
                            plugId: session.plugId,
                            status: process.env.PlugStatusAvailable
                        }

                        console.log(body);

                        Utils.updateChargerPlugStatusChargeEnd(chargerServiceProxy, chargerServiceMultiStatusProxy, body);

                        plug_status = "0";

                        resolve(true);

                    }

                }
                else {
                    resolve(false);
                }
            })
            .finally(() => {
                resolve(false);
            })

    })
};



/*
if (plugStatusCheck == false) {

    console.log("Plug check");
    plugStatusCheck = true;

    if (iec_plug == "true") {

        console.log("TYPE 2");

        var data = {
            $and: [
                {
                    hwId: sn
                },
                {
                    $or: [
                        {
                            status: process.env.SessionStatusToStop
                        },
                        {
                            status: process.env.SessionStatusRunning
                        }
                    ]
                }
            ]
        }

        Utils.getChargingSessionBodyData(chargingSessionSiemensServiceProxy, data)
            .then(session => {
                if (session) {
                    console.log("Find session");
                    if (session.plugId !== "1") {
                        console.log("Change to Type2");
                        Utils.updateChargingSessionPlugId(chargingSessionServiceProxy, session, process.env.SiemensType2PlugId);
                    }
                    resolve(false);
                }
                else {
                    resolve(false);
                }
            })
            .finally(() => {
                resolve(false);
            })

        resolve(false);

    } else {

        console.log("SCHUKO");

        var data = {
            $and: [
                {
                    hwId: sn
                },
                {
                    $or: [
                        {
                            status: process.env.SessionStatusToStop
                        },
                        {
                            status: process.env.SessionStatusRunning
                        }
                    ]
                }
            ]
        }

        Utils.getChargingSessionBodyData(chargingSessionSiemensServiceProxy, data)
            .then(session => {
                if (session) {
                    console.log("Find session");
                    if (session.plugId !== "2") {
                        console.log("Change to SCHUKO");
                        Utils.updateChargingSessionPlugId(chargingSessionServiceProxy, session, process.env.SiemensSchukoPlugId);
                    }
                    resolve(false);
                }
                else {
                    resolve(false);
                }
            })
            .finally(() => {
                resolve(false);
            })

        resolve(false);
    }

} else {
    console.log("interlock cicle");
    setTimeout(() => {
        console.log("enter timeout");
        plugICEStatus(sn, iec_plug);
    }, 20 * 1000);
    resolve(false);
}*/