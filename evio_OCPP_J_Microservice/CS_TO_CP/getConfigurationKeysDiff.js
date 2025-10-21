const OcppJsonCall = require("../OcppJsonCall")
const global = require('../global');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const ConfigurationKey = require('../models/configurationKeys')
const EvioKey = require('../models/evioKeys')
const moment = require('moment')
const Utils = require('../utils');
const trigger = global.triggeredByCS

module.exports = {
    handle: async function (req, res, wss, eventEmitter) {

        const context = "[Get Configuration Keys Diff]";
        const action = 'GetConfiguration';
        const chargerId = req.body.hwId;
        const evioKeysId = req.body.evioKeysId;
        let reload = req.body.reload
        if (!evioKeysId)
            return res.status(500).send({ auth: 'true', code: "server_evioKeysId_required", message: 'evioKeysId required' });

        if (!chargerId)
            return res.status(500).send({ auth: 'true', code: "server_hw_required", message: 'HwId required' });

        const clients = Array.from(wss.clients);
        const client = clients.filter(a => a.id == chargerId)[0];
 
        try {
            let evioKeys = await EvioKey.findOneEvioKeys({_id : evioKeysId})
            if (reload) {
                if (client) {
                    if (client.readyState === WebSocket.OPEN) {
                        const messageId = uuidv4();

                        //const call = new OcppJsonCall(messageId, global.callRequest, action, {});
                        const call = [global.callRequest, messageId , action, {}];
                        console.log(JSON.stringify(call))
                        console.log(`Message sent to ${client.id}, ${action}`)
                        
                        client.send(JSON.stringify(call), function (result, err) {
                            //console.log("[GetConfiguration] result", result);
                            //console.log("[GetConfiguration] err: ", err);
                            eventEmitter.on(messageId, function (data) {
                                const lastUpdated = moment(new Date().toISOString()).utc()
                                upsertConfigurationKeys(chargerId,data,lastUpdated)
                                let chargerConfigurationKeysList = data.configurationKey ? data.configurationKey : []
                                let evioKeysList = evioKeys ? evioKeys.keys : []
                                let diffKeysArray = []
                                compareKeysLists(diffKeysArray , chargerConfigurationKeysList , evioKeysList)
                                Utils.saveLog(chargerId, {} , data , true , 'GetConfiguration' , 'GetConfiguration command' , 0 , trigger)
                                return res.status(200).send({data : diffKeysArray , lastReadDate : lastUpdated.format() });
                            });
                        });
                    }
                } else {
                    const message = `${context} Communication not established between the CS and the charging station ${chargerId}`;
                    console.error(message);
                    Utils.saveLog(chargerId, req.body , {} , false , 'GetConfiguration' , `Communication not established between the CS and the charging station ${chargerId}` , 0 , trigger)
                    return res.status(500).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
                }
                
            } else {
                let chargerConfigurationKeys = await ConfigurationKey.findOneConfigurationKeys({hwId : chargerId})
                if (chargerConfigurationKeys) {
                    let chargerConfigurationKeysList = chargerConfigurationKeys.keys
                    let evioKeysList = evioKeys ? evioKeys.keys : []
                    let diffKeysArray = []
                    compareKeysLists(diffKeysArray , chargerConfigurationKeysList , evioKeysList)
                    let lastReadDate = chargerConfigurationKeys.lastReadDate ? chargerConfigurationKeys.lastReadDate : moment(chargerConfigurationKeys.lastUpdated).utc().format()
                    return res.status(200).send({data : diffKeysArray , lastReadDate });
                } else {
                    if (client) {
                        if (client.readyState === WebSocket.OPEN) {
                            const messageId = uuidv4();

                            //const call = new OcppJsonCall(messageId, global.callRequest, action, {});
                            const call = [global.callRequest, messageId , action, {}];
                            console.log(JSON.stringify(call))
                            console.log(`Message sent to ${client.id}, ${action}`)
                            
                            client.send(JSON.stringify(call), function (result, err) {
                                //console.log("[GetConfiguration] result", result);
                                //console.log("[GetConfiguration] err: ", err);
                                eventEmitter.on(messageId, function (data) {
                                    const lastUpdated = moment(new Date().toISOString()).utc()
                                    upsertConfigurationKeys(chargerId,data,lastUpdated)
                                    let chargerConfigurationKeysList = data.configurationKey ? data.configurationKey : []
                                    let evioKeysList = evioKeys ? evioKeys.keys : []
                                    let diffKeysArray = []
                                    compareKeysLists(diffKeysArray , chargerConfigurationKeysList , evioKeysList)
                                    Utils.saveLog(chargerId, {} , data , true , 'GetConfiguration' , 'GetConfiguration accepted' , 0 , trigger)
                                    return res.status(200).send({data : diffKeysArray , lastReadDate : lastUpdated.format() });
                                });
                            });
                        }
                    } else {
                        const message = `${context} Communication not established between the CS and the charging station ${chargerId}`;
                        console.error(message);
                        Utils.saveLog(chargerId, req.body , {} , false , 'GetConfiguration' , `Communication not established between the CS and the charging station ${chargerId}` , 0 , trigger)
                        return res.status(500).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
                    }
                }
            }
        } catch (error) {
            const message = `${context} Communication not established between the CS and the charging station ${chargerId}`;
            console.error(message);
            Utils.saveLog(chargerId, req.body , {} , false , 'GetConfiguration' , `Communication not established between the CS and the charging station ${chargerId}` , 0 , trigger)
            return res.status(500).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
        }

    }
}

const upsertConfigurationKeys = async (chargerId,data , lastUpdated) => {
    const filter = {
        hwId : chargerId
    }
    const values = {
        keys : data.configurationKey,
        lastUpdated,
        lastReadDate : lastUpdated.format()
    }
    ConfigurationKey.upsertChargerConfigurationKeys(filter, values)
    .then((res) => {
        console.log(`[Get Configuration] Updated the configuration keys of the charging station ${chargerId}`)
    })
    .catch((err) => {
        console.error(`[Get Configuration] Error updating the configuration keys of the charging station ${chargerId}`)
    })
}

function compareKeysLists(diffKeysArray , chargerConfigurationKeysList , evioKeysList) {
    const context = "Function compareKeysLists"
    try {
        addChargerKeysToArray(diffKeysArray , chargerConfigurationKeysList , evioKeysList)

        addEvioKeysToArray(diffKeysArray , chargerConfigurationKeysList , evioKeysList)

        diffKeysArray.sort(function(a, b){
            if(a.key < b.key) { return -1; }
            if(a.key > b.key) { return 1; }
            return 0;
        })
        
    } catch (error) {
        console.error(`[${context}] Error`, error);
        return []
    }

}

function addChargerKeysToArray(diffKeysArray , chargerConfigurationKeysList , evioKeysList) {
    const context = "Function addChargerKeys"
    try {
        for (let configurationKeyObj of chargerConfigurationKeysList) {
            let configurationKey = configurationKeyObj.key
            let configurationKeyValue = String(configurationKeyObj.value ?? '')
            let readonly = configurationKeyObj.readonly
            let evioKeyObj = evioKeysList.find(obj => obj.key.toUpperCase() === configurationKey.toUpperCase())
            let evioKeyValue = "configurationKeys_notFound"
            if (evioKeyObj) {
                evioKeyValue = evioKeyObj.value
            }
            diffKeysArray.push({key : configurationKey , readonly , currentValue : configurationKeyValue , correctValue : evioKeyValue })
        }
    } catch (error) {
        console.error(`[${context}] Error`, error);
        return []
    }
}


function addEvioKeysToArray(diffKeysArray , chargerConfigurationKeysList , evioKeysList) {
    const context = "Function addEvioKeysToArray"
    try {
        for (let evioKeyObj of evioKeysList) {
            let evioKey = evioKeyObj.key
            let evioKeyValue = String(evioKeyObj.value ?? '')
            let readonly = evioKeyObj.readonly
            let configurationKeyObj = chargerConfigurationKeysList.find(obj => obj.key.toUpperCase() === evioKey.toUpperCase())
            if (!configurationKeyObj) {
                diffKeysArray.push({key : evioKey , readonly , currentValue : "configurationKeys_notFound" , correctValue : evioKeyValue })
            }
        }
    } catch (error) {
        console.error(`[${context}] Error`, error);
        return []
    }
}