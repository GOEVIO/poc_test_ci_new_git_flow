const global = require('../global');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const Utils = require('../utils');
const axios = require("axios");
const moment = require('moment');
const crypto = require('crypto');
const Sentry = require("@sentry/node");
const constants = require('../utils/constants')

const host = global.charger_microservice_host;
const chargingSessionServiceProxy = `${host}/api/private/chargingSession`;
const chargerServiceProxy = `${host}/api/private/chargers/status`;
const chargingSessionStartServiceProxy = `${host}/api/private/chargingSession/start`;
const trigger = global.triggeredByCS

module.exports = {
    handle: function (req, res, wss, eventEmitter) {
        const context = "[Remote Start Transaction]";
        const action = 'RemoteStartTransaction';

        const plugId = req.body.plugId;
        if (!plugId) {
            return res.status(400).send({ auth: 'true', code: "server_plug_id_required", message: 'Plug ID required' });
        }

        const hwId = req.body.hwId;
        if (!hwId) {
            return res.status(400).send({ auth: 'true', code: "server_hw_required", message: 'HwId required' });
        }

        const token = req.body.token;
        if (!token) {
            return res.status(400).send({ auth: 'true', code: "server_token_required", message: 'token required' });
        }

        const party_id = req.body.party_id;
        if (!party_id) {
            return res.status(400).send({ auth: 'true', code: "server_party_id_required", message: 'party_id required' });
        }

        const country_code = req.body.country_code;
        if (!country_code) {
            return res.status(400).send({ auth: 'true', code: "server_country_code_required", message: 'country_code required' });
        }

        const response_url = req.body.response_url;
        if (!response_url) {
            return res.status(400).send({ auth: 'true', code: "server_response_url_required", message: 'response_url required' });
        }

        const network = req.body.network;
        if (!network) {
            return res.status(400).send({ auth: 'true', code: "server_network_required", message: 'network required' });
        }

        const location_id = req.body.location_id;
        if (!location_id) {
            return res.status(400).send({ auth: 'true', code: "server_location_id_required", message: 'location_id required' });
        }

        const evse_uid = req.body.evse_uid;
        if (!evse_uid) {
            return res.status(400).send({ auth: 'true', code: "server_evse_uid_required", message: 'evse_uid required' });
        }

        const connector_id = req.body.connector_id;
        if (!connector_id) {
            return res.status(400).send({ auth: 'true', code: "server_connector_id_required", message: 'connector_id required' });
        }

        const operatorId = req.body.operatorId;
        if (!operatorId) {
            return res.status(400).send({ auth: 'true', code: "server_operatorId_required", message: 'operatorId required' });
        }

        const authorization_reference = req.body.authorization_reference;

        const currency = req.body.currency;
        

        const clients = Array.from(wss.clients);
        const client = clients.filter(a => a.id == hwId)[0];

        const commandType = 'START_SESSION'

        const commandResultBody = {
            response_url,
            party_id,
            network,
            hwId,
            plugId,
            commandType,
            operatorId,
        }

        if (client) {
            if (client.readyState === WebSocket.OPEN) {

                /////////////////////////////////////////////////////////////////////////////
                //Check if charger exists on EVIO Network and get data of charger
                const params = {
                    hwId: hwId
                };

                Utils.chekIfChargerExists(chargerServiceProxy, params)
                    .then(async (charger) => {

                        if (charger) {

                            const fees = await Utils.getFees(charger)

                            let evId = "-1";
                            let fleetId = "-1";
                            const dateNow = moment(new Date().toISOString()).utc();
                            const body = {
                                'hwId': hwId,
                                'fleetId': fleetId,
                                'evId': evId,
                                'idTag': token.uid,
                                'sessionPrice': -1,
                                'command': process.env.StartCommand,
                                'chargerType': charger.chargerType ? charger.chargerType : global.OCPPJ_16_DeviceType,
                                'status': process.env.SessionStatusToStart,
                                'userId': "UNKNOWN",
                                'plugId': plugId,
                                'startDate': dateNow,
                                'authType': 'APP_USER',
                                'tariffId': "-1",
                                'fees': fees,
                                'address': charger.address,
                                'userIdWillPay': charger.operatorId,
                                'operatorId': charger.operatorId,
                                'paymentMethod': process.env.PaymentMethodNotPay,
                                'freeOfCharge': charger.accessType === process.env.ChargerAccessFreeCharge,
                                'createdWay': process.env.createdWayOcpiCommand,
                                'network': network,
                                'response_url_start': response_url,
                                'authorization_reference': authorization_reference,
                                'country_code': country_code,
                                'party_id': party_id,
                                'cdr_token': Utils.buildCdrToken(network, token, token.uid),
                                'location_id': location_id,
                                'evse_uid': evse_uid,
                                'connector_id': connector_id,
                                'ocpiId': crypto.randomUUID(),
                                'auth_method': network === process.env.MobiePlatformCode ? process.env.authMethodCommand : process.env.authMethodWhitelist,
                                'currency': currency,
                                'cpoTariffIds': Utils.getCpoTariffIds(charger.plugs, network)

                            }

                            axios.post(chargingSessionStartServiceProxy, body)
                                .then(function (chargingSession) {

                                    console.log(`${context} Trying start FREE remote transaction: ChargerId: ${hwId}; PlugId: ${plugId}; userIdTag: ${token.uid}; Endpoint: ${charger.endpoint} `);
                                    const messageId = uuidv4();

                                    let data = new Object;
                                    data.idTag = token.uid;
                                    data.connectorId = parseInt(plugId);


                                    //const call = new OcppJsonCall(messageId, global.callRequest, action, data);
                                    const call = [global.callRequest, messageId, action, data];
                                    console.log(JSON.stringify(call))
                                    console.log(`Message sent to ${client.id}, ${action}`)

                                    client.send(JSON.stringify(call), function (temp) {
                                        eventEmitter.on(messageId, function (result) {

                                            const remoteStartTransactionStatus = result.status;
                                            if (remoteStartTransactionStatus === constants.responseStatus.Accepted) {
                                                Utils.saveLog(hwId, call[3], data, true, 'RemoteStartTransaction', 'RemoteStartTransaction accepted', plugId, trigger)
                                                return res.status(200).send({ auth: 'true', code: "", message: 'Remote Start accepted', sessionId: chargingSession.data._id });
                                            } else {
                                                if (remoteStartTransactionStatus !== constants.responseStatus.Rejected) {
                                                    console.error(`${context} Error - Unknown response status`, result)
                                                    Utils.saveLog(hwId, call[3], result, false, 'RemoteStartTransaction', 'Unknown remoteStart response status', plugId, trigger);
                                                    Sentry.captureException(new Error(`Unknown remoteStart response status response ${hwId}`));
                                                } else {
                                                    Utils.saveLog(hwId, call[3], data, false, 'RemoteStartTransaction', 'RemoteStartTransaction rejected', plugId, trigger)
                                                }
                                                const error = {
                                                    reasonCode: "other",
                                                    reasonText: "Communication not established between the Central System and the Charging Station"
                                                }
                                                stopChargingSession(hwId, plugId, error);
                                                return res.status(400).send({ auth: 'true', code: "server_error_connecting_charging_station", message: `Communication not established between the CS and the charging station ${chargerId}`, sessionId: chargingSession.data._id });
                                            }
                                        });
                                    });

                                })
                                .catch(function (error, err) {
                                    let resultMessage = ''
                                    if (!error) {
                                        console.error(`${context} error - Check error 45648431`);
                                    } else {
                                        console.error(`${context} error: , ${JSON.stringify(error)}`);
                                    }

                                    if (error) {
                                        if (error.response) {
                                            if (error.response.data) {
                                                if (error.response.data.idTag) {
                                                    resultMessage = error.response.data.idTag === token.uid ? 'The current user has an active transaction on the EVSE.' : 'The EVSE is currently occupied.'
                                                }
                                            }
                                            Utils.sendCommandResult(response_url, commandType, { ...commandResultBody, result: 'EVSE_OCCUPIED', message: resultMessage })
                                            Utils.saveLog(hwId, req.body, {}, false, 'RemoteStartTransaction', error.response.data.message, plugId, trigger)
                                            return res.status(500).send({ auth: true, status: false, message: error.response.data.message });
                                        } else {
                                            Utils.sendCommandResult(response_url, commandType, { ...commandResultBody, result: 'EVSE_OCCUPIED', message: resultMessage })
                                            Utils.saveLog(hwId, req.body, {}, false, 'RemoteStartTransaction', error.message, plugId, trigger)
                                            return res.status(500).send({ auth: true, status: false, message: error.message });
                                        }
                                    } else {
                                        Utils.sendCommandResult(response_url, commandType, { ...commandResultBody, result: 'EVSE_OCCUPIED', message: resultMessage })
                                        Utils.saveLog(hwId, req.body, {}, false, 'RemoteStartTransaction', `Communication not established between the CS and the charging station ${hwId}`, plugId, trigger)
                                        return res.status(500).send({ auth: true, status: false, message: `Communication not established between the CS and the charging station ${hwId}` });
                                    }

                                });

                        }
                        else {
                            Utils.sendCommandResult(response_url, commandType, { ...commandResultBody, result: 'FAILED', message: '' })
                            console.error(`Charger ${hwId} does not exists`);
                            Utils.saveLog(hwId, req.body, {}, false, 'RemoteStartTransaction', `Charger ${hwId} does not exist`, plugId, trigger)
                            return res.status(500).send({ auth: true, status: false, message: `Charger ${hwId} does not exists` });
                        }
                    });

            }
        }
        else {
            Utils.sendCommandResult(response_url, commandType, { ...commandResultBody, result: 'FAILED', message: '' })
            const message = `${context} Communication not established between the CS and the charging station ${hwId}`;
            console.error(message);
            Utils.saveLog(hwId, req.body, {}, false, 'RemoteStartTransaction', `Communication not established between the CS and the charging station ${hwId}`, plugId, trigger)
            return res.status(400).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
        }
    }

}

//Function to stop transaction notification when user does not connects the plug
const stopChargingSession = (hwId, connectorId, error) => {
    //Check if there is any charging session running to specific connector id
    const params = {
        hwId: hwId,
        plugId: connectorId,
        status: process.env.SessionStatusToStart
    };

    Utils.checkIfHasChargingSession(chargingSessionServiceProxy, params)
        .then((chargingSession) => {

            if (chargingSession) {
                //Update charging Session with failed
                updateChargingSession(chargingSessionServiceProxy, process.env.SessionStatusFailed, chargingSession, error);
                console.log(`[StatusNotification] A charging session ${chargingSession.sessionId} was canceled for charge station ${hwId} and connectorId  ${connectorId}`)
            }

        }).catch(function (error) {
            console.error(`${context} error checking if has any charging session`, error)
        });
};

const updateChargingSession = (ServiceProxy, status, chargingSession, error) => {
    const body = {
        _id: chargingSession._id,
        status: status,
        stopReason: error,
    }

    axios.patch(ServiceProxy, { body })
        .then(function (response) {
            // console.log("Success");
        })
        .catch(function (error) {
            console.error(error);
        });
};
