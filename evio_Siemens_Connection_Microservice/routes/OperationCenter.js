const express = require('express');
const router = express.Router();
require("dotenv-safe").load();
var moment = require('moment');
const axios = require("axios");

const SessionConfig = require('../models/SessionConfig');
const OperationCenterCommands = require('../cpcl/entities/OperationCenterCommands');

const Utils = require('../cpcl/entities/Utils');

var host = 'http://chargers:3002';
const chargerServiceProxy = `${host}/api/private/chargers/status`;
const chargingSessionStartServiceProxy = `${host}/api/private/chargingSession/start`;
const chargingSessionServiceProxy = `${host}/api/private/chargingSession`;
const chargerServiceMultiStatusProxy = `${host}/api/private/chargers/multiStatus`;

var identity_microservice_host = 'http://identity:3003'
const idTagProxy = `${identity_microservice_host}/api/private/contracts/idTag`;

var configs_microservice_host = 'http://configs:3028';
const configProxy = `${configs_microservice_host}/api/private/config/siemensSession`;

let OperationCenter = require('../cpcl/entities/OperationCenter')(8091);
OperationCenter.createTCPServer();

router.post('/api/private/connectionstation/siemens_protocol/startService', (req, res, next) => {
    var context = "POST /api/private/connectionstation/siemens_protocol/startService";
    try {
        if (OperationCenter === undefined) {
            if (OperationCenter.checkServerIsRunning()) {
                return res.status(400).send({ code: 'server_already_running', message: 'Server already running' });
            } else {
                OperationCenter.createTCPServer();
                return res.status(200).send({ code: 'server_running', message: 'Server running' });
            }
        } else {
            return res.status(400).send({ code: 'server_already_running', message: 'Server already running' });
        }
    } catch (error) {
        console.log(`[${context}]`, error);
        return res.status(500).send(error);
    }
});

router.post('/api/private/connectionstation/siemens_protocol/stopService', (req, res, next) => {
    var context = "POST /api/private/connectionstation/siemens_protocol/stopService";
    try {
        //Fechar socket do Socket Server do posto de carregamento.
        //Fechar socket do Socket Client.
    } catch (error) {
        console.log(`[${context}]`, error);
        return res.status(500).send(error);
    };
});

router.post('/api/private/connectionstation/siemens_protocol/start', (req, res, next) => {
    var context = "POST /api/private/connectionstation/siemens_protocol/start";

    let sessionConfig = new SessionConfig();

    var idTag = req.body.idTag;
    if (!idTag || idTag == "") {
        return res.status(400).send({ auth: false, code: "server_id_tag_required", message: 'IdTag required' });
    }

    var tariffId = req.body.tariffId;
    if (!tariffId || tariffId == "") {
        return res.status(400).send({ auth: false, code: "tariff_id_required", message: 'tariffId required' });
    }

    var evId = req.body.evId;
    var chargerId = req.body.chargerId;
    var hwId = req.body.hwId;
    var plugId = req.body.plugId;
    var idTag = req.body.idTag;
    var tariffId = req.body.tariffId;
    var userId;

    if (!req.body.userId) {
        userId = req.headers['userid'];//in headers we can't use camelcase, always lowercase
    }
    else {
        userId = req.body.userId;
    }

    var body = {
        "hwId": hwId,
        "evId": evId,
        "idTag": idTag,
        "tariffId": tariffId,
        "plugId": plugId,
        'chargerType': '001',
        "status": process.env.SessionStatusToStart,
        "userId": userId,
        'command': process.env.StartCommand,
        'paymentMethod': req.body.paymentMethod,
        'paymentMethodId': req.body.paymentMethodId,
        'walletAmount': req.body.walletAmount,
        'reservedAmount': req.body.reservedAmount,
        'confirmationAmount': req.body.confirmationAmount,
        'userIdWillPay': req.body.userIdWillPay,
        'autoStop': req.body.autoStop,
        'adyenReference': req.body.adyenReference,
        'transactionId': req.body.transactionId,
        'address': req.body.address,
        'fees': req.body.fees,
        'tariff': req.body.tariff,
        'cardNumber': req.body.cardNumber,
        'clientType': req.body.clientType,
        'clientName': req.body.clientName,
        'userIdToBilling': req.body.userIdToBilling,
        'plafondId': req.body.plafondId,
    }

    //Start Charging Session
    try {
        if (OperationCenter === undefined) {
            console.log("Operation Center down");
            return res.status(400).send({ auth: false, code: 'server_not_running', message: 'Server not running' });
        } else {

            var params = {
                hwId: hwId
            }

            checkIfChargerExists(chargerServiceProxy, params)
                .then((charger) => {
                    if (charger) {

                        if (!charger.data.charger[0]) {
                            console.log("Charger not available");
                            return res.status(400).send({ auth: false, code: "server_endpoint_undefined", message: 'Endpoint undefined' });
                        }

                        axios.get(configProxy, {})
                            .then((config) => {
                                if (config) {
                                    let result = config.data;

                                    let sessionConfig = {
                                        session_max_current: result.session_max_current,
                                        session_max_duration: result.session_max_duration,
                                        session_max_energy_Wh: result.session_max_energy_Wh,
                                        price_kWh: 1000
                                    }

                                    console.log(sessionConfig);

                                    if (charger.data.charger[0].createUser === userId) {
                                        startSession(res, hwId, body, charger, plugId, idTag, sessionConfig, context);
                                    }
                                    else {

                                        params = {
                                            idTag: idTag,
                                            userId: userId
                                        }

                                        Utils.checkIdTagValidity(idTagProxy, params)
                                            .then((contract) => {
                                                if (contract == false) {
                                                    console.log("Invalid contract");
                                                    return res.status(400).send({ auth: false, code: "invalid_contract", message: 'Invalid contract' });
                                                } else {
                                                    startSession(res, hwId, body, charger, plugId, idTag, sessionConfig, context);
                                                }
                                            }).catch((error) => {
                                                console.log("Contract not found");
                                                return res.status(400).send({ code: 'contract_not_found', message: 'Contract not found' });
                                            });

                                    }

                                }
                                else {
                                    console.log("Session configurations not found");
                                    return res.status(400).send({ code: 'session_configurations_not_found', message: 'Session configurations not found' });
                                }
                            }).catch((error) => {
                                console.log("Session configurations not found");
                                return res.status(400).send({ code: 'session_configurations_not_found', message: 'Session configurations not found' });
                            });

                    } else {
                        console.log("Charger not found");
                        return res.status(400).send({ code: 'charger_not_found', message: 'Charger not found' });
                    }
                }).catch((error) => {
                    console.log("Charger not found");
                    return res.status(400).send({ code: 'charger_not_found', message: 'Charger not found' });
                });

        }
    } catch (error) {
        console.log('Error creating charging session');
        console.log(`[${context}]`, error);
        return res.status(500).send(error);
    }
});


const startSession = ((res, hwId, body, charger, plugId, idTag, sessionConfig, context) => {

    var params = {
        hwId: hwId,
        status: process.env.SessionStatusToStart
    }

    Utils.getChargingSessionData(chargingSessionServiceProxy, params)
        .then(session => {

            if (session) {
                console.log("Session already running");
                return res.status(400).send({ auth: false, code: "session_already_started", message: 'Charging session already started' });
            }
            else {

                axios.post(chargingSessionStartServiceProxy, body)
                    .then((chargingSession) => {

                        OperationCenter.getClientConnection(context, charger.data.charger[0])
                            .then((client) => {

                                if (client !== null) {

                                    const charge_section_init = OperationCenterCommands.charge_section_init(chargingSession.data._id, sessionConfig);

                                    OperationCenter.startTransaction(charge_section_init, client)
                                        .then(response => {

                                            verifySessionStart(response).then((result) => {
                                                if (result) {

                                                    var chargerType = charger.data.charger[0].chargerType;
                                                    Utils.updateChargingSessionData(chargingSessionServiceProxy,
                                                        chargingSession.data, idTag, chargerType)

                                                    var body = {
                                                        _id: charger.data.charger[0]._id,
                                                        plugId: plugId,
                                                        status: process.env.PlugsStatusInUse
                                                    }

                                                    Utils.updateChargerPlugStatus(chargerServiceMultiStatusProxy, body);

                                                    return res.status(200).send({
                                                        auth: true,
                                                        code: 'charge_session_started',
                                                        message: 'Charging Session started',
                                                        sessionId: chargingSession.data._id
                                                    });

                                                } else {
                                                    Utils.updateChargingSessionStatus(chargingSessionServiceProxy,
                                                        process.env.SessionStatusFailed, chargingSession.data);

                                                    console.log("Falha e altera o estado da sessão para 60");
                                                    return res.status(400).send({ code: 'charge_session_not_started', message: 'Charging Session not started' });
                                                }
                                            })
                                        })
                                        .catch((error) => {
                                            console.log("Charging session not started");
                                            return res.status(400).send({ code: 'charge_session_not_started', message: 'Charging Session not started' });
                                        })
                                } else {
                                    console.log("Cant reach the charging station");
                                    return res.status(400).send({ code: 'charge_session_not_started', message: 'Charging Session not started' });
                                }
                            })
                            .catch((error) => {
                                console.log("Cant reach the charging station");
                                return res.status(400).send({ code: 'charge_session_not_started', message: 'Charging Session not started' });
                            })
                    })
                    .catch((error) => {
                        console.log("Cant retrieve charger sessions");
                        return res.status(400).send({ code: 'charger_sessions_failed', message: 'Cant retrieve charger sessions' });
                    })

            }

        }).catch((error) => {
            console.log("Cant reach the charging station");
            return res.status(400).send({ code: 'charge_session_not_started', message: 'Charging Session not started' });
        });

});


/*
router.post('/api/private/connectionstation/siemens_protocol/start', (req, res, next) => {
    var context = "POST /api/private/connectionstation/siemens_protocol/start";

    let sessionConfig = new SessionConfig();

    var idTag = req.body.idTag;
    if (!idTag || idTag == "") {
        return res.status(400).send({ auth: false, code: "server_id_tag_required", message: 'IdTag required' });
    }

    var tariffId = req.body.tariffId;
    if (!tariffId || tariffId == "") {
        return res.status(400).send({ auth: false, code: "tariff_id_required", message: 'tariffId required' });
    }

    var evId = req.body.evId;
    var chargerId = req.body.chargerId;
    var hwId = req.body.hwId;
    var plugId = req.body.plugId;
    var idTag = req.body.idTag;
    var tariffId = req.body.tariffId;
    //var sessionPrice = req.body.sessionPrice;
    var userId;

    if (!req.body.userId) {
        userId = req.headers['userid'];//in headers we can't use camelcase, always lowercase
    }
    else {
        userId = req.body.userId;
    }

    var body = {
        "hwId": hwId,
        "evId": evId,
        "idTag": idTag,
        "tariffId": tariffId,
        "plugId": plugId,
        "status": process.env.SessionStatusToStart,
        "userId": userId,
    }

    //Start Charging Session
    try {
        if (OperationCenter === undefined) {
            console.log("Operation Center down");
            return res.status(400).send({ auth: false, code: 'server_not_running', message: 'Server not running' });
        } else {

            var params = {
                idTag: idTag,
                userId: userId
            }

            console.log(params);

            Utils.checkIdTagValidity(idTagProxy, params).then((contract) => {
                if (contract == false) {
                    console.log("Invalid contract");
                    return res.status(400).send({ auth: false, code: "invalid_contract", message: 'Invalid contract' });
                } else {

                    params = {
                        hwId: hwId
                    };

                    checkIfChargerExists(chargerServiceProxy, params).then((charger) => {
                        if (charger) {

                            if (!charger.data.charger[0]) {
                                console.log("Charger not available");
                                return res.status(400).send({ auth: false, code: "server_endpoint_undefined", message: 'Endpoint undefined' });
                            }

                            params = {
                                hwId: hwId,
                                status: process.env.SessionStatusToStart
                            }

                            Utils.getChargingSessionData(chargingSessionServiceProxy, params)
                                .then(session => {

                                    //session already running
                                    if (session) {
                                        console.log("Session already running");
                                        return res.status(400).send({ auth: false, code: "session_already_started", message: 'Charging session already started' });
                                    }
                                    else {

                                        //console.log(`${context} charger `, JSON.stringify(charger.data.charger[0]));

                                        axios.post(chargingSessionStartServiceProxy, body).then((chargingSession) => {

                                            //console.log(`${context} Charging Session created ${hwId}: ${chargingSession.data._id}`);

                                            OperationCenter.getClientConnection(context, charger.data.charger[0])
                                                .then((client) => {

                                                    if (client !== null) {

                                                        const charge_section_init = OperationCenterCommands.charge_section_init(chargingSession.data._id, sessionConfig);

                                                        //console.log(charge_section_init);

                                                        OperationCenter.startTransaction(charge_section_init, client)
                                                            .then(response => {

                                                                verifySessionStart(response).then((result) => {
                                                                    if (result) {

                                                                        var chargerType = charger.data.charger[0].chargerType;
                                                                        Utils.updateChargingSessionData(chargingSessionServiceProxy,
                                                                            chargingSession.data, idTag, chargerType)

                                                                        var body = {
                                                                            _id: charger.data.charger[0]._id,
                                                                            plugId: plugId,
                                                                            status: process.env.PlugsStatusInUse
                                                                        }

                                                                        Utils.updateChargerPlugStatus(chargerServiceMultiStatusProxy, body);

                                                                        console.log("Cria a sessão com sucesso");

                                                                        return res.status(200).send({
                                                                            auth: true,
                                                                            code: 'charge_session_started',
                                                                            message: 'Charging Session started',
                                                                            sessionId: chargingSession.data._id
                                                                        });

                                                                    } else {
                                                                        Utils.updateChargingSessionStatus(chargingSessionServiceProxy,
                                                                            process.env.SessionStatusFailed, chargingSession.data);

                                                                        console.log("Falha e altera o estado da sessão para 60");
                                                                        return res.status(400).send({ code: 'charge_session_not_started', message: 'Charging Session not started' });
                                                                    }
                                                                })
                                                            })
                                                            .catch(error => {
                                                                console.log("Charging session not started");
                                                                return res.status(400).send({ code: 'charge_session_not_started', message: 'Charging Session not started' });
                                                            })
                                                    } else {
                                                        console.log("Cant reach the charging station");
                                                        return res.status(400).send({ code: 'charge_session_not_started', message: 'Charging Session not started' });
                                                    }
                                                })
                                                .catch(error => {
                                                    console.log("Cant reach the charging station");
                                                    return res.status(400).send({ code: 'charge_session_not_started', message: 'Charging Session not started' });
                                                })
                                        })
                                    }

                                })

                        } else {
                            console.log("Charger not found");
                            return res.status(400).send({ code: 'charger_not_found', message: 'Charger not found' });
                        }

                    })

                }
            })

        }
    } catch (error) {
        console.log('Error creating charging session');
        console.log(`[${context}]`, error);
        return res.status(500).send(error);
    }
});
*/

router.post('/api/private/connectionstation/siemens_protocol/stop', (req, res, next) => {
    var context = "POST /api/private/connectionstation/siemens_protocol/stop";

    var evId = req.body.evId;
    var chargerId = req.body.chargerId;
    var hwId = req.body.hwId;
    var plugId = req.body.plugId;
    var sessionId = req.body.sessionId;
    var idTag = req.body.idTag;
    var userId;

    if (!req.body.userId) {
        userId = req.headers['userid'];//in headers we can't use camelcase, always lowercase
    }
    else {
        userId = req.body.userId;
    }

    if (!idTag || idTag === "") {
        return res.status(400).send({ auth: false, code: "server_id_tag_required", message: 'IdTag required' });
    }

    if (!sessionId || sessionId === "") {
        return res.status(400).send({ auth: false, code: "server_session_id_required", message: 'Charging session ID required' });
    }

    try {
        if (OperationCenter === undefined) {
            return res.status(400).send({ auth: false, code: 'server_not_running', message: 'Server not running' });
        } else {

            var params = {
                hwId: hwId
            }

            checkIfChargerExists(chargerServiceProxy, params)
                .then((charger) => {
                    if (charger) {

                        if (!charger.data.charger[0]) {
                            console.log("Charger not available");
                            return res.status(400).send({ auth: false, code: "server_endpoint_undefined", message: 'Endpoint undefined' });
                        }

                        if (charger.data.charger[0].createUser === userId) {
                            stopSession(res, hwId, charger, plugId, sessionId, context);
                        }
                        else {

                            params = {
                                idTag: idTag,
                                userId: userId
                            }

                            Utils.checkIdTagValidity(idTagProxy, params).then((contract) => {
                                if (contract == false) {
                                    console.log("Invalid contract");
                                    return res.status(400).send({ auth: false, code: "invalid_contract", message: 'Invalid contract' });
                                } else {
                                    stopSession(res, hwId, charger, plugId, sessionId, context);
                                }
                            }).catch((error) => {
                                console.log("Contract not found");
                                return res.status(400).send({ code: 'contract_not_found', message: 'Contract not found' });
                            });

                        }

                    } else {
                        console.log("Charger not found");
                        return res.status(400).send({ code: 'charger_not_found', message: 'Charger not found' });
                    }
                }).catch((error) => {
                    console.log("Charger not found");
                    return res.status(400).send({ code: 'charger_not_found', message: 'Charger not found' });
                });

        }
    } catch (error) {
        console.log(`[${context}]`, error);
        return res.status(500).send(error);
    }
});


const stopSession = ((res, hwId, charger, plugId, sessionId, context) => {

    var params = {
        status: process.env.SessionStatusRunning,
        hwId: hwId,
        plugId: plugId,
        sessionId: sessionId
    };

    axios.get(chargingSessionServiceProxy, { params })
        .then((response) => {

            if (typeof response.data.chargingSession[0] === 'undefined') {
                console.log("Charging session not started");
                return res.status(400).send({ auth: false, code: "charging_session_not_found", message: `Charging Session ${sessionId} not found` });
            }
            else {

                var chargingSession = response.data.chargingSession[0];

                Utils.updateChargingSessionToStop(chargingSessionServiceProxy, chargingSession, process.env.SessionStatusToStop)
                    .then((result) => {

                        if (result) {

                            console.log("Changed to 30");

                            OperationCenter.getClientConnection(context, charger.data.charger[0])
                                .then((client) => {

                                    if (client !== null) {

                                        const charge_section_end = OperationCenterCommands.charge_section_end(chargingSession._id);

                                        OperationCenter.startTransaction(charge_section_end, client)
                                            .then(response => {
                                                if (response.result === 'OK') {

                                                    console.log("Session stopped sucess");
                                                    return res.status(200).send({ code: 'charge_session_ended', message: 'Charging Session ended' });

                                                } else {
                                                    console.log("Session stopped failed");
                                                    return res.status(400).send({ code: 'charge_session_not_ended', message: 'Charging Session not ended' });
                                                }
                                            })
                                            .catch(error => {
                                                console.log("Failed to start transaction");
                                                console.log(error);
                                                return res.status(400).send({ code: 'charge_session_not_ended', message: 'Charging Session not ended' });
                                            })
                                    } else {
                                        console.log("Cant reach the charging station. Null client");
                                        return res.status(400).send({ code: 'charge_session_not_started', message: 'Charging Session not started' });
                                    }
                                })
                                .catch((error) => {
                                    console.log(error);
                                    return res.status(400).send({ code: 'charge_session_not_started', message: 'Charging Session not started' });
                                })
                        } else {
                            console.log("Charging session not found");
                            return res.status(400).send({ auth: false, code: "charging_session_not_found", message: `Charging Session ${sessionId} not found` });
                        }
                    })
                    .catch((error) => {
                        console.log(error);
                        return res.status(400).send({ code: 'charge_session_not_started', message: 'Charging Session not started' });
                    })
            }
        }).catch((error) => {
            console.log(error);
            return res.status(400).send({ code: 'charge_session_not_started', message: 'Charging Session not started' });
        });

});


/*
router.post('/api/private/connectionstation/siemens_protocol/stop', (req, res, next) => {
    var context = "POST /api/private/connectionstation/siemens_protocol/stop";

    var evId = req.body.evId;
    var chargerId = req.body.chargerId;
    var hwId = req.body.hwId;
    var plugId = req.body.plugId;
    var sessionId = req.body.sessionId;
    var idTag = req.body.idTag;
    var userId;

    if (!req.body.userId) {
        userId = req.headers['userid'];//in headers we can't use camelcase, always lowercase
    }
    else {
        userId = req.body.userId;
    }

    if (!idTag || idTag === "") {
        return res.status(400).send({ auth: false, code: "server_id_tag_required", message: 'IdTag required' });
    }

    if (!sessionId || sessionId === "") {
        return res.status(400).send({ auth: false, code: "server_session_id_required", message: 'Charging session ID required' });
    }

    try {
        if (OperationCenter === undefined) {
            return res.status(400).send({ auth: false, code: 'server_not_running', message: 'Server not running' });
        } else {

            var params = {
                idTag: idTag,
                userId: userId
            }

            Utils.checkIdTagValidity(idTagProxy, params).then((contract) => {
                if (!contract) {
                    console.log("Invalid contract");
                    return res.status(400).send({ auth: false, code: "invalid_contract", message: 'Invalid contract' });
                } else {

                    params = {
                        hwId: hwId
                    };

                    checkIfChargerExists(chargerServiceProxy, params).then((charger) => {
                        if (charger) {

                            if (!charger.data.charger[0]) {
                                console.log("Charger not found");
                                return res.status(400).send({ auth: false, code: "server_charger_undefined", message: 'Charger undefined' });
                            }

                            params = {
                                status: process.env.SessionStatusRunning,
                                hwId: hwId,
                                plugId: plugId,
                                sessionId: sessionId
                            };

                            axios.get(chargingSessionServiceProxy, { params })
                                .then((response) => {

                                    if (typeof response.data.chargingSession[0] === 'undefined') {
                                        console.log("Charging session not started");
                                        return res.status(400).send({ auth: false, code: "charging_session_not_found", message: `Charging Session ${sessionId} not found` });
                                    }
                                    else {

                                        var chargingSession = response.data.chargingSession[0];

                                        Utils.updateChargingSessionToStop(chargingSessionServiceProxy, chargingSession, process.env.SessionStatusToStop)
                                            .then((result) => {

                                                if (result) {

                                                    console.log("Changed to 30");

                                                    OperationCenter.getClientConnection(context, charger.data.charger[0])
                                                        .then((client) => {

                                                            if (client !== null) {

                                                                const charge_section_end = OperationCenterCommands.charge_section_end(chargingSession._id);

                                                                OperationCenter.startTransaction(charge_section_end, client)
                                                                    .then(response => {
                                                                        if (response.result === 'OK') {

                                                                            console.log("Session stopped sucess");
                                                                            return res.status(200).send({ code: 'charge_session_ended', message: 'Charging Session ended' });

                                                                        } else {
                                                                            console.log("Session stopped failed");
                                                                            return res.status(400).send({ code: 'charge_session_not_ended', message: 'Charging Session not ended' });
                                                                        }
                                                                    })
                                                                    .catch(error => {
                                                                        console.log("Failed to start transaction");
                                                                        console.log(error);
                                                                        return res.status(400).send({ code: 'charge_session_not_ended', message: 'Charging Session not ended' });
                                                                    })
                                                            } else {
                                                                console.log("Cant reach the charging station. Null client");
                                                                return res.status(400).send({ code: 'charge_session_not_started', message: 'Charging Session not started' });
                                                            }
                                                        })
                                                        .catch(error => {
                                                            console.log(error);
                                                            return res.status(400).send({ code: 'charge_session_not_started', message: 'Charging Session not started' });
                                                        })
                                                } else {
                                                    console.log("Charging session not found");
                                                    return res.status(400).send({ auth: false, code: "charging_session_not_found", message: `Charging Session ${sessionId} not found` });
                                                }
                                            })
                                            .catch(error => {
                                                console.log(error);
                                                return res.status(400).send({ code: 'charge_session_not_started', message: 'Charging Session not started' });
                                            })
                                    }
                                })
                        }
                    })

                }
            })
        }
    } catch (error) {
        console.log(`[${context}]`, error);
        return res.status(500).send(error);
    }
});
*/


router.post('/api/private/connectionstation/siemens_protocol/charge_section_update', (req, res, next) => {
    var context = "POST /api/private/connectionstation/siemens_protocol/charge_section_update";
    try {

        var evId = req.body.evId;
        var chargerId = req.body.chargerId;
        var hwId = req.body.hwId;
        var plugId = req.body.plugId;
        var sessionId = req.body.sessionId

        if (!sessionId) {
            return res.status(400).send({ auth: false, code: "server_session_id_required", message: 'Charging session ID required' });
        }

        var params = {
            hwId: hwId
        };

        if (OperationCenter === undefined) {
            return res.status(400).send({ auth: false, code: 'server_not_running', message: 'Server not running' });
        } else {

            checkIfChargerExists(chargerServiceProxy, params).then((charger) => {
                if (charger) {

                    if (!charger.data.charger[0]) {
                        return res.status(400).send({ auth: false, code: "server_charger_undefined", message: 'Charger undefined' });
                    }

                    params = {
                        status: process.env.SessionStatusRunning,
                        hwId: hwId,
                        plugId: plugId,
                        sessionId: sessionId
                    };

                    axios.get(chargingSessionServiceProxy, { params })
                        .then((response) => {

                            if (typeof response.data.chargingSession[0] === 'undefined')
                                return res.status(400).send({ auth: false, code: "", message: `Charging Session ${sessionId} not found` });
                            else {

                                //console.log("response", response.data.chargingSession[0]);

                                OperationCenter.getClientConnection(context, charger.data.charger[0])
                                    .then((client) => {

                                        if (client !== null) {

                                            const charge_section_update = OperationCenterCommands.charge_section_update(sessionId, sessionConfig);

                                            OperationCenter.startTransaction(charge_section_update, client)
                                                .then(response => {
                                                    if (response.result === 'OK') {
                                                        return res.status(200).send({ code: 'charging_session_updated', message: 'Charging session updated' });
                                                    } else {
                                                        return res.status(400).send({ code: 'charging_session_not_updated', message: 'Charging session not updated' });
                                                    }
                                                })
                                                .catch(error => {
                                                    return res.status(400).send({ code: 'charging_session_not_updated', message: 'Charging session not updated' });
                                                })
                                        }
                                    })
                                    .catch(error => {
                                        return res.status(400).send({ auth: false, code: 'charge_station_not_found', message: 'Charging Station not found' });
                                    })
                            }
                        })
                }
            })
        }
    } catch (error) {
        console.log(`[${context}]`, error);
        return res.status(500).send(error);
    };
});

router.post('/api/private/connectionstation/siemens_protocol/unlockHatch', (req, res, next) => {
    var context = "POST /api/private/connectionstation/siemens_protocol/unlockHatch";

    var evId = req.body.evId;
    var chargerId = req.body.chargerId;
    var hwId = req.body.hwId;
    var plugId = req.body.plugId;
    var sessionId = req.body.sessionId

    if (!sessionId) {
        return res.status(400).send({ auth: false, code: "server_session_id_required", message: 'Charging session ID required' });
    }

    var params = {
        hwId: hwId
    }

    try {
        if (OperationCenter === undefined) {
            return res.status(400).send({ auth: false, code: 'server_not_running', message: 'Server not running' });
        } else {

            checkIfChargerExists(chargerServiceProxy, params).then((charger) => {
                if (charger) {
                    //TO DO define endpoint
                    if (!charger.data.charger[0]) {
                        return res.status(400).send({ auth: false, code: "server_charger_undefined", message: 'Charger undefined' });
                    }

                    params = {
                        status: process.env.SessionStatusStopped,
                        hwId: hwId,
                        plugId: plugId,
                        sessionId: sessionId
                    };

                    axios.get(chargingSessionServiceProxy, { params })
                        .then((response) => {

                            if (typeof response.data.chargingSession[0] === 'undefined')
                                return res.status(400).send({ auth: false, code: "", message: `Charging Session ${sessionId} not found` });
                            else {

                                OperationCenter.getClientConnection(context, charger.data.charger[0])
                                    .then((client) => {

                                        if (client !== null) {

                                            const unlock_hatch = OperationCenterCommands.unlock_hatch();

                                            OperationCenter.startTransaction(unlock_hatch, client)
                                                .then(response => {
                                                    if (response.result === 'OK') {
                                                        return res.status(200).send({ code: 'hatch_unlocked', message: 'Hatch Unlocked' });
                                                    } else {
                                                        return res.status(400).send({ code: 'hatch_not_unlocked', message: 'Hatch not unlocked' });
                                                    }
                                                })
                                                .catch(error => {
                                                    return res.status(400).send({ code: 'hatch_not_unlocked', message: 'Hatch not unlocked' });
                                                })
                                        }
                                    })
                                    .catch(error => {
                                        return res.status(400).send({ auth: false, code: 'charge_station_not_found', message: 'Charging Station not found' });
                                    })

                            }
                        })
                }
            })
        }
    } catch (error) {
        console.log(`[${context}]`, error);
        return res.status(500).send(error);
    };
});

router.post('/api/private/connectionstation/siemens_protocol/unlockConnector', (req, res, next) => {
    var context = "POST /api/private/connectionstation/siemens_protocol/unlockConnector";
    try {

        var evId = req.body.evId;
        var chargerId = req.body.chargerId;
        var hwId = req.body.hwId;
        var plugId = req.body.plugId;
        var sessionId = req.body.sessionId

        if (!sessionId) {
            return res.status(400).send({ auth: false, code: "server_session_id_required", message: 'Charging session ID required' });
        }

        var params = {
            hwId: hwId
        };

        if (OperationCenter === undefined) {
            return res.status(400).send({ auth: false, code: 'server_not_running', message: 'Server not running' });
        } else {

            checkIfChargerExists(chargerServiceProxy, params).then((charger) => {
                if (charger) {
                    //TO DO define endpoint
                    if (!charger.data.charger[0]) {
                        return res.status(400).send({ auth: false, code: "server_charger_undefined", message: 'Charger undefined' });
                    }

                    params = {
                        status: process.env.SessionStatusStopped,
                        hwId: hwId,
                        plugId: plugId,
                        sessionId: sessionId
                    };

                    axios.get(chargingSessionServiceProxy, { params })
                        .then((response) => {

                            if (typeof response.data.chargingSession[0] === 'undefined')
                                return res.status(400).send({ auth: false, code: "", message: `Charging Session ${sessionId} not found` });
                            else {

                                OperationCenter.getClientConnection(context, charger.data.charger[0])
                                    .then((client) => {

                                        if (client !== null) {

                                            const unlock_plug = OperationCenterCommands.unlock_plug();

                                            OperationCenter.startTransaction(unlock_plug, client)
                                                .then(response => {
                                                    if (response.result === 'OK') {
                                                        return res.status(200).send({ code: 'plug_unlocked', message: 'Plug unlocked' });
                                                    } else {
                                                        return res.status(400).send({ code: 'plug_not_unlocked', message: 'Plug not unlocked' });
                                                    }
                                                })
                                                .catch(error => {
                                                    return res.status(400).send({ code: 'plug_not_unlocked', message: 'Plug not unlocked' });
                                                })
                                        }
                                    })
                                    .catch(error => {
                                        return res.status(400).send({ auth: false, code: 'charge_station_not_found', message: 'Charging Station not found' });
                                    })

                            }
                        })
                }
            })
        }
    } catch (error) {
        console.log(`[${context}]`, error);
        return res.status(500).send(error);
    };
});

router.post('/api/private/connectionstation/siemens_protocol/reset', (req, res, next) => {
    var context = "POST /api/private/connectionstation/siemens_protocol/reset";

    var chargerId = req.body.chargerId;
    var hwId = req.body.hwId;

    var params = {
        hwId: hwId
    }

    try {
        if (OperationCenter === undefined) {
            return res.status(400).send({ auth: false, code: 'server_not_running', message: 'Server not running' });
        } else {

            checkIfChargerExists(chargerServiceProxy, params).then((charger) => {
                if (charger) {

                    if (!charger.data.charger[0]) {
                        return res.status(400).send({ auth: false, code: "server_charger_undefined", message: 'Charger undefined' });
                    }

                    OperationCenter.getClientConnection(context, charger.data.charger[0])
                        .then((client) => {

                            if (client !== null) {

                                const reboot = OperationCenterCommands.reboot();

                                OperationCenter.startTransaction(reboot, client)
                                    .then(response => {
                                        if (response.result === 'OK') {

                                            OperationCenter.removeConnection(charger.data.charger[0].hwId);

                                            return res.status(200).send({ code: 'reboot', message: 'Charging Station Rebooted' });
                                        } else {
                                            return res.status(400).send({ code: 'not_reboot', message: 'Charging Station not Rebooted' });
                                        }
                                    })
                                    .catch(error => {
                                        return res.status(400).send({ code: 'not_reboot', message: 'Charging Station not Rebooted' });
                                    })
                            }
                        })
                        .catch(error => {
                            return res.status(400).send({ auth: false, code: 'charge_station_not_found', message: 'Charging Station not found' });
                        })
                }
            })
        }
    } catch (error) {
        console.log(`[${context}]`, error);
        return res.status(500).send(error);
    };
});

router.post('/api/private/connectionstation/siemens_protocol/getStatus', (req, res, next) => {
    var context = "POST /api/private/connectionstation/siemens_protocol/getStatus";

    var chargerId = req.body.chargerId;
    var hwId = req.body.hwId;

    var params = {
        hwId: hwId
    }

    try {
        if (OperationCenter === undefined) {
            return res.status(500).send({ code: 'server_not_running', message: 'Server not running' });
        } else {

            checkIfChargerExists(chargerServiceProxy, params).then((charger) => {
                if (charger) {

                    if (!charger.data.charger[0]) {
                        return res.status(500).send({ auth: 'true', code: "server_charger_undefined", message: 'Charger undefined' });
                    }

                    OperationCenter.getClientConnection(context, charger.data.charger[0])
                        .then((client) => {

                            if (client !== null) {

                                const status = OperationCenterCommands.chargingStationStatus(charger.data.charger[0]._id);

                                console.log(status);

                                OperationCenter.startTransaction(status, client)
                                    .then(response => {

                                        if (response.result === 'OK') {

                                            return res.status(200).send({
                                                code: 'getStatus',
                                                message: 'Charging Station failed status',
                                                status: "0"
                                            });

                                        } else {
                                            return res.status(400).send({
                                                code: 'not_stationStatus',
                                                message: 'Charging Station failed to retrieve status'
                                            });
                                        }
                                    })
                                    .catch(error => {
                                        return res.status(400).send({ code: 'not_status', message: 'Charging Station failed to retrieve status' });
                                    })
                            }
                        })
                        .catch(error => {
                            return res.status(500).send({ code: 'charge_station_not_found', message: 'Charging Station not found' });
                        })
                }
            })
        }
    } catch (error) {
        console.log(`[${context}]`, error);
        return res.status(500).send(error);
    };
});

router.post('/api/private/connectionstation/siemens_protocol/getConfiguration', (req, res, next) => {
    var context = "POST /api/private/connectionstation/siemens_protocol/getConfiguration";

    var chargerId = req.body.chargerId;
    var hwId = req.body.hwId;

    var params = {
        hwId: hwId
    }

    try {
        if (OperationCenter === undefined) {
            return res.status(400).send({ auth: false, code: 'server_not_running', message: 'Server not running' });
        } else {

            checkIfChargerExists(chargerServiceProxy, params).then((charger) => {
                if (charger) {

                    if (!charger.data.charger[0]) {
                        return res.status(400).send({ auth: false, code: "server_charger_undefined", message: 'Charger undefined' });
                    }

                    OperationCenter.getClientConnection(context, charger.data.charger[0])
                        .then((client) => {

                            if (client !== null) {

                                const getConfiguration = OperationCenterCommands.getConfiguration();

                                OperationCenter.startTransaction(getConfiguration, client)
                                    .then(response => {
                                        if (response) {
                                            return res.status(200).send({
                                                code: 'getConfiguration',
                                                message: 'Charging Station configuration',
                                                configuration: response
                                            });
                                        } else {
                                            return res.status(400).send({ code: 'not_getConfiguration', message: 'Charging Station configuration failed' });
                                        }
                                    })
                                    .catch(error => {
                                        return res.status(400).send({ code: 'not_getConfiguration', message: 'Charging Station configuration failed' });
                                    })
                            }
                        })
                        .catch(error => {
                            return res.status(400).send({ auth: false, code: 'charge_station_not_found', message: 'Charging Station not found' });
                        })
                }
            })
        }
    } catch (error) {
        console.log(`[${context}]`, error);
        return res.status(500).send(error);
    };
});


router.post('/api/private/connectionstation/siemens_protocol/changeConfiguration', (req, res, next) => {
    var context = "POST /api/private/connectionstation/siemens_protocol/changeConfiguration";

    var chargerId = req.body.chargerId;
    var hwId = req.body.hwId;
    var configuration = req.body.configuration;

    var params = {
        hwId: hwId
    }

    try {
        if (OperationCenter === undefined) {
            return res.status(400).send({ auth: false, code: 'server_not_running', message: 'Server not running' });
        } else {

            checkIfChargerExists(chargerServiceProxy, params).then((charger) => {
                if (charger) {

                    if (!charger.data.charger[0]) {
                        return res.status(400).send({ auth: false, code: "server_charger_undefined", message: 'Charger undefined' });
                    }

                    OperationCenter.getClientConnection(context, charger.data.charger[0])
                        .then((client) => {

                            if (client !== null) {

                                console.log(configuration);

                                const changeConfiguration = OperationCenterCommands.changeConfiguration(configuration);

                                OperationCenter.startTransaction(changeConfiguration, client)
                                    .then(response => {
                                        if (response.result === 'OK') {
                                            return res.status(200).send({ code: 'changeConfiguration', message: 'Charging Station configuration updated' });
                                        } else {
                                            return res.status(400).send({ code: 'not_changeConfiguration', message: 'Charging Station configuration update failed' });
                                        }
                                    })
                                    .catch(error => {
                                        return res.status(400).send({ code: 'not_getConfiguration', message: 'Charging Station configuration failed' });
                                    })
                            }
                        })
                        .catch(error => {
                            return res.status(400).send({ auth: false, code: 'charge_station_not_found', message: 'Charging Station not found' });
                        })
                }
            })
        }
    } catch (error) {
        console.log(`[${context}]`, error);
        return res.status(500).send(error);
    };
});

const checkIfChargerExists = (ServiceProxy, params) => {
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
                console.log(error.response.data.message);
                resolve(false);
            });
    });
};

/*
const updateChargingSessionStop = (ServiceProxy, chargingSessionId, status) => {
    return new Promise((resolve, reject) => {
        var dateNow = moment();
        var body = {
            sessionId: chargingSessionId,
            command: process.env.StopCommand,
            status: status,
            stopDate: dateNow
        }

        console.log(body);

        axios.patch(ServiceProxy, { body })
            .then(function (response) {
                resolve(true);
            })
            .catch(function (error) {
                //TODO VERY IMPORTANT
                //IN CASE OF FAILED, WE NEED TO PREVENT FAILS AND MARK TO PROCESS AGAIN LATER
                //IN THIS SCENARIO, CHARGING SESSION WAS ALREADY STOPED ON OCPP CHARGER BUT NOT ON EVIO STORAGE DATABASE
            })

        .catch((error) => {
                console.log(error.response.data);
            })
            .finally(() => {
                resolve(true);
            })
    })
};*/

/*
function verifySessionStart(data) {
    return new Promise(function (resolve, reject) {
        
        try {
            if (data.id) {
                resolve(true);
            }
        } catch (error) {
            console.log(`[${context}] Error `, error);
            reject(error);
        }
    })
}*/

function verifySessionStart(data) {
    return new Promise(function (resolve, reject) {

        if (data.meter_Abs != undefined) {
            resolve(true);
        }

        if (data.result != undefined) {
            if (data.result === "OK") {
                resolve(true);
            } else {
                resolve(false);
            }
        }
        resolve(false);
    })
}

router.post('/api/private/siemens_protocol/endChargerConnection', (req, res, next) => {
    var context = "POST /api/private/siemens_protocol/endChargerConnection";
    try {

        if (req.body != null) {

            let chargerId = req.body.data.hwId;
            console.log("Charger: " + chargerId);
            //OperationCenter.removeConnection(chargerId);

            return res.status(200).send({ code: 'connection_closed', message: 'Connection closed: ' + chargerId });

        } else {
            return res.status(400).send({ code: 'empty_request', message: 'Empty Request' });
        }

    } catch (error) {
        console.log(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
});

module.exports = router;