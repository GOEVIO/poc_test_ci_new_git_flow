const OcppJsonCall = require("../OcppJsonCall")
const global = require('../global');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const Utils = require('../utils');
const ConfigurationKey = require('../models/configurationKeys')
const moment = require('moment')
const axios = require("axios");
var context = "[Change Configuration]";

var host = global.charger_microservice_host;
const chargerServiceUpdateProxy = `${host}/api/private/chargers`;
const chargerServiceProxy = `${host}/api/private/chargers/status`;
const trigger = global.triggeredByCS

module.exports = {
    handle: function (req, res, wss, eventEmitter) {

        const action = 'ChangeConfiguration';

        const hwId = req.body.hwId;
        if (!hwId)
            return res.status(400).send({ auth: 'true', code: "server_hw_id_required", message: 'Hardware ID required' });
        
        const configuration = req.body.configuration;
        if (!configuration)
            return res.status(400).send({ auth: 'true', code: "server_configuration_key_required", message: 'Configuration Key required' });

        if (!Array.isArray(configuration))
            return res.status(400).send({ auth: 'true', code: "server_configuration_key_required", message: 'Configuration Key is an array' });

        const chargerId = hwId;

        /////////////////////////////////////////////////////////////////////////////
        //Check if charger exists on EVIO Network and get data of charger
        const params = {
            hwId: hwId
        };

        const clients = Array.from(wss.clients);
        const client = clients.filter(a => a.id == hwId)[0];


        if (client) {
            if (client.readyState === WebSocket.OPEN) {

                Utils.chekIfChargerExists(chargerServiceProxy, params).then((charger) => {
                    if (charger) {

                        console.log(`${context} Trying changing configuration: ChargerId: ${hwId}; Endpoint: ${charger.endpoint} `);

                        Utils.updateManyConfigurationKeys(configuration , charger, client , eventEmitter , action , res)

                    }
                    else {
                        Utils.saveLog(hwId, req.body , {} , false , 'ChangeConfiguration' , `Charger ${hwId} does not exist` , 0 , trigger)
                        return res.status(500).send({ auth: true, status: false, message: `Charger ${hwId} does not exists` });
                    }
                });

            }

        } else {
            const message = `${context} Communication not established between the CS and the charging station ${chargerId}`;
            console.error(message);
            Utils.saveLog(hwId, req.body , {} , false , 'ChangeConfiguration' , `Communication not established between the CS and the charging station ${chargerId}` , 0 , trigger)
            return res.status(500).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
        }
    }
}

const updateChargerData = (ServiceProxy, body) => {

    return new Promise((resolve, reject) => {
        axios.patch(ServiceProxy, body)
            .then(function (response) {
                resolve(true);
            })
            .catch(function (error) {
                console.log("error", error);
                reject(false);
            });
    });
};

const updateConfigurationKeyValue = async (hwId , data) => {
    const lastUpdated = moment(new Date().toISOString()).utc()
    ConfigurationKey.updateConfigurationKey({
        $and : [
            {'hwId' : hwId} ,
            {'keys.key': data.key}
        ]
    }, {'$set': {
        'keys.$.value': data.value,
        'lastUpdated' : lastUpdated
    }})
    .then(res => {
        console.log(`[ ChangeConfiguration ] ${data.key} key was updated successfully`)
    })
    .catch(err => {
        console.log(`[ ChangeConfiguration ] ${data.key} key failed to update`)

    })
}

async function updateManyConfigurationKeys(configurationList , charger, client , eventEmitter , action , res) {
    const context = "Function updateManyConfigurationKeys"
    let result = {successConfigurationKeys : [] , failedConfigurationKeys : [] , total : 0}
    try {
        for (let configurationKeysObj of configurationList ) {
            let update = await updateConfigurationKeys(configurationKeysObj ,charger , client , eventEmitter , action)
            if (update.result === process.env.statusAccepted) {
                result.successConfigurationKeys.push(configurationKeysObj)
            } else {
                result.failedConfigurationKeys.push(configurationKeysObj)
            }
            result.total++
        }
        
        return res.status(200).send(result);
        

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(400).send({ auth: 'true', code: "server_error_connecting_charging_station", message: `Communication not established between the CS and the charging station ${hwId}`}); 
    }
}

function updateConfigurationKeys(configurationKeysObj ,charger , client , eventEmitter , action) {
    const context = "Function updateConfigurationKeys"
    return new Promise(async (resolve, reject) => {
        try {
            const messageId = uuidv4();           
            let data = new Object
            data.key = configurationKeysObj['key'];
            data.value = configurationKeysObj['value'];

            //const call = new OcppJsonCall(messageId, global.callRequest, action, data);
            const call = [global.callRequest, messageId , action, data];
            console.log(JSON.stringify(call))
            console.log(`Message sent to ${client.id}, ${action}`)

            client.send(JSON.stringify(call), function (temp) {
                eventEmitter.on(messageId, async function (result) {

                    const remoteStatus = result.status;
                    if (remoteStatus === process.env.statusAccepted) {
                        const body = {};

                        if (data.key == process.env.heartbeatInterval) {
                            body = {
                                _id: charger._id,
                                heartBeatInterval: data.value
                            }
                            await updateChargerData(chargerServiceUpdateProxy, body);
                        }
                        else if (data.key == process.env.meterValuesSampledData) {
                            body = {
                                _id: charger._id,
                                meterValueSampleInterval: data.value
                            }
                            await updateChargerData(chargerServiceUpdateProxy, body);
                        }

                        await updateConfigurationKeyValue(charger.hwId,data)
                        resolve({result : remoteStatus , data , message : ""})
                    }
                    else {
                        console.log(`${context} error changing configuration`, JSON.stringify(result));
                        resolve({
                            result: remoteStatus,
                            data,
                            message: `Failed to change configuration. Status: ${remoteStatus}`,
                            errorDetails: result 
                        });
                    }
                });

            });  
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            resolve({result : "Failed" , data , message : error.message})

        }
    });
}