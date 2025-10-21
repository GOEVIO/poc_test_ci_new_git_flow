const global = require('../global');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const LocalAuthorizationList = require('../models/localAuthorizationLists');
const ConfigurationKey = require('../models/configurationKeys')
const moment = require('moment');
const host = global.charger_microservice_host;
const chargerServiceProxy = `${host}/api/private/chargers/status`;
const Utils = require('../utils');
const trigger = global.triggeredByCS


module.exports = {
    handle: function (req, res, wss, eventEmitter) {
        const context = "[Send Local List]";
        const action = 'SendLocalList';
        
        const hwId = req.body.hwId;
        if (!hwId) {
            return res.status(400).send({ auth: 'true', code: "server_hw_id_required", message: 'Hardware ID required' });
        }

        // let listVersion = req.body.listVersion;
        // if (typeof listVersion === 'undefined' || listVersion === null || typeof listVersion !== 'number' || listVersion < 0) {
        //     return res.status(400).send({ auth: 'true', code: "server_plug_id_required", message: 'ListVersion is required, and it should be a number greater than or equal to zero.' });
        // }
        
        let authorizationList = req.body.authorizationList || [];
        if (!Array.isArray(authorizationList)) {
            return res.status(400).send({
                auth: 'true',
                code: "server_authorization_list_invalid",
                message: 'Authorization list is invalid.'
            });
        }

        let updateType = req.body.updateType;
        if (!updateType || typeof updateType !== 'string' || (updateType !== 'Full' && updateType !== 'Differential')) {
            return res.status(400).send({ 
                auth: 'true', 
                code: "server_updateType_key_required", 
                message: 'UpdateType Type required. It must be either "Full" or "Differential".' 
            });
        }

        const clients = Array.from(wss.clients);
        const client = clients.filter(a => a.id == hwId)[0];

        if (client) {
            if (client.readyState === WebSocket.OPEN) {

                /////////////////////////////////////////////////////////////////////////////
                //Check if charger exists on EVIO Network and get data of charger
                const params = {
                    hwId: hwId
                };

                Utils.chekIfChargerExists(chargerServiceProxy, params)
                .then((charger) => {
                    if (charger) {
                        console.log(`${context} Trying to call GetLocalListVersion: ChargerId: ${hwId}; Endpoint: ${charger.endpoint} `);

                        const getLocalListMessageId = uuidv4();
                        const localListData = new Object;
                        const callLocal = [global.callRequest, getLocalListMessageId, 'GetLocalListVersion', localListData];
                        console.log(JSON.stringify(callLocal))
                        console.log(`Message sent to ${client.id}, ${'GetLocalListVersion'}`)

                        client.send(JSON.stringify(callLocal), function (temp) {

                            eventEmitter.on(getLocalListMessageId, async function (result) {

                                Utils.saveLog(hwId, localListData , result , true , 'GetLocalListVersion' , `GetLocalListVersion command` , 0 , trigger)

                                let listVersion = result.listVersion
                                if (result.listVersion == 0) {
                                    console.log(`${context} Local authorization list of charger ${hwId} is empty `)
                                    updateType = global.fullUpdate
                                    listVersion++
                                } else if (result.listVersion == -1) {
                                    console.error(`${context} Charge Point: ${hwId}  does not support Local Authorization Lists `)
                                    return res.status(400).send({ auth: 'true', code: "", message: `Charge Point: ${hwId}  does not support Local Authorization Lists` });
                                } else {
                                    console.log(`${context} Local authorization version of charger ${hwId} : ${result.listVersion} `)
                                    if (updateType !== global.fullUpdate) {
                                        listVersion++
                                    }
                                }


                                //Call sendLocalList 

                                console.log(`${context} Trying to SendLocalList: ChargerId: ${hwId}; Endpoint: ${charger.endpoint} `);


                                let chargerConfigurationKeys = await ConfigurationKey.findOneConfigurationKeys({hwId})
                                let localListMaxLengthKey = chargerConfigurationKeys ? chargerConfigurationKeys.keys.find(obj => obj.key === global.ocppLocalAuthListMaxLength) : null
                                let sendListMaxLengthKey = chargerConfigurationKeys ? chargerConfigurationKeys.keys.find(obj => obj.key === global.ocppSendLocalListMaxLength) : null
                                let sendListMaxLengthValue = sendListMaxLengthKey ? Number(sendListMaxLengthKey.value) : global.defaultSendLocalListLength
                                let localListMaxLengthKeyValue = localListMaxLengthKey ? Number(localListMaxLengthKey.value) : global.defaultLocalAuthListLength
                                
                                /* 
                                    TODO : For now, due to the limit, I'm slicing the array. Maybe in the future we'll decide the priority or something 
                                */
                                authorizationList = authorizationList.slice(0,localListMaxLengthKeyValue)

                                /*
                                    Here, the authroziation list exceeds the send limit, so we'll divide it into smaller chunks
                                    To make an easier implementation in the dependent microservices, the updateType is always Full. 
                                    Due to the size limits, we'll have to turn it into many differential requests, after an empty ([]) Full
                                 */
                                
                                if (authorizationList.length > sendListMaxLengthValue) {
                                    if (updateType === global.fullUpdate) {
                                        var messageId = uuidv4();
                                        var data = new Object;
                                        data.listVersion = listVersion
                                        data.localAuthorizationList = []
                                        data.updateType = updateType

                                        const call = [global.callRequest, messageId, action, data];
                                        console.log(JSON.stringify(call))
                                        console.log(`Message sent to ${client.id}, ${action}`)

                                        client.send(JSON.stringify(call), function (temp) {

                                            eventEmitter.on(messageId, async function (result) {
                                                const sendLocalListVersion = result.status;
                                                if (sendLocalListVersion === process.env.statusAccepted) {
                                                    await updateAuthlist(global.fullUpdate,{...data , hwId})
                                                    Utils.saveLog(hwId, data , result , true , 'SendLocalList' , `SendLocalList command` , 0 , trigger)
                                                    sendManyLocalLists(authorizationList , global.diffUpdate ,sendListMaxLengthValue, hwId , listVersion + 1 , client , eventEmitter , action ,res)
                                                } else if (sendLocalListVersion === process.env.statusFailed) {
                                                    Utils.saveLog(hwId, data , result , false , 'SendLocalList' , 'Failed to update the Local Authorization List.' , 0 , trigger)
                                                    return res.status(400).send({ auth: 'true', code: "", message: 'Failed to update the Local Authorization List.' });
                                                } else if (sendLocalListVersion === process.env.statusNotSupported) {
                                                    Utils.saveLog(hwId, data , result , false , 'SendLocalList' , 'Update of Local Authorization List is not supported by Charge Point.' , 0 , trigger)
                                                    return res.status(406).send({ auth: 'true', code: "", message: 'Update of Local Authorization List is not supported by Charge Point.' });
                                                } else if (sendLocalListVersion === process.env.statusVersionMismatch) {
                                                    Utils.saveLog(hwId, data , result , false , 'SendLocalList' , 'Version number in the request for a differential update is less or equal then version number of current list.' , 0 , trigger)
                                                    return res.status(409).send({ auth: 'true', code: "", message: 'Version number in the request for a differential update is less or equal then version number of current list.' });
                                                } else {
                                                    Utils.saveLog(hwId, data, result, false, 'SendLocalList', 'An error occurred while processing the request. Please check your request and try again.', 0, trigger);
                                                    return res.status(500).send({ auth: 'true', code: "error_processing_request", message: 'An error occurred while processing the request. Please check your request and try again.' });
                                                }
                                            });

                                        });
                                    } else {
                                        sendManyLocalLists(authorizationList , updateType , sendListMaxLengthValue , hwId ,listVersion , client , eventEmitter , action ,res)
                                    }                                    

                                } else {
                                    const messageId = uuidv4();

                                    let data = new Object;
                                    data.listVersion = listVersion
                                    data.localAuthorizationList = authorizationList
                                    data.updateType = updateType

                                    const call = [global.callRequest, messageId, action, data];
                                    console.log(JSON.stringify(call))
                                    console.log(`Message sent to ${client.id}, ${action}`)

                                    client.send(JSON.stringify(call), function (temp) {

                                        eventEmitter.on(messageId, function (result) {
                                            const sendLocalListVersion = result.status;
                                            if (sendLocalListVersion === process.env.statusAccepted) {
                                                updateAuthlist(updateType,{...data , hwId})
                                                Utils.saveLog(hwId, data , result , true , 'SendLocalList' , `SendLocalList command` , 0 , trigger)
                                                return res.status(200).send(result);
                                            } else if (sendLocalListVersion === process.env.statusFailed) {
                                                Utils.saveLog(hwId, data , result , false , 'SendLocalList' , 'Failed to update the Local Authorization List.' , 0 , trigger)
                                                return res.status(400).send({ auth: 'true', code: "", message: 'Failed to update the Local Authorization List.' });
                                            } else if (sendLocalListVersion === process.env.statusNotSupported) {
                                                Utils.saveLog(hwId, data , result , false , 'SendLocalList' , 'Update of Local Authorization List is not supported by Charge Point.' , 0 , trigger)
                                                return res.status(406).send({ auth: 'true', code: "", message: 'Update of Local Authorization List is not supported by Charge Point.' });
                                            } else if (sendLocalListVersion === process.env.statusVersionMismatch) {
                                                Utils.saveLog(hwId, data , result , false , 'SendLocalList' , 'Version number in the request for a differential update is less or equal then version number of current list.' , 0 , trigger)
                                                return res.status(409).send({ auth: 'true', code: "", message: 'Version number in the request for a differential update is less or equal then version number of current list.' });
                                            } else {
                                                Utils.saveLog(hwId, data, result, false, 'SendLocalList', 'An error occurred while processing the request. Please check your request and try again.', 0, trigger);
                                                return res.status(500).send({ auth: 'true', code: "error_processing_request", message: 'An error occurred while processing the request. Please check your request and try again.' });
                                            }
                                        });

                                    });
                                }
                            });

                        });
                    }
                    else {
                        return res.status(400).send({ auth: true, status: false, message: `Charger ${hwId} does not exists` });
                    }
                });

            }

        } else {
            const message = `${context} Communication not established between the CS and the charging station ${hwId}`;
            console.error(message);
            return res.status(500).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
        }
    }
}

async function updateAuthlist(updateType,data) {
    const context = "[Send Local List]";

    let query = {
        hwId : data.hwId
    }

    if (updateType === global.fullUpdate) {
        let values = {
            hwId : data.hwId,
            listVersion : data.localAuthorizationList.length > 0 ? data.listVersion : 0,
            localAuthorizationList : data.localAuthorizationList,
            lastUpdated : moment(new Date().toISOString()).utc(),
        }
        await LocalAuthorizationList.upsertLocalAuthorizationLists(query,values)
        .then(res => {
            console.log(`${context} Charger ${data.hwId} list updated with ${global.fullUpdate} mode `)
        })
        .catch(error => {
            console.error(`${context} Error: Charger ${data.hwId} failed to update on ${global.fullUpdate} mode `)
        })
    } else if (updateType === global.diffUpdate) {
        await LocalAuthorizationList.findList(query)
        .then( async (res) => {
            if (res) {
                let oldList = res.localAuthorizationList
                for (let item of data.localAuthorizationList) {
                    let oldItemIndex = oldList.findIndex(p => p.idTag === item.idTag) 
                    if (oldItemIndex == -1) {
                        oldList.push(item)
                    } else {
                        oldList[oldItemIndex] = item
                    }
                }

                let values = {
                    hwId : data.hwId,
                    listVersion : data.listVersion,
                    localAuthorizationList : oldList,
                    lastUpdated : moment(new Date().toISOString()).utc(),
                }
                await LocalAuthorizationList.upsertLocalAuthorizationLists(query,values)
                .then(res => {
                    console.log(`${context} Charger ${data.hwId} list updated with ${global.diffUpdate} mode `)
                })
                .catch(error => {
                    console.error(`${context} Error: Charger ${data.hwId} failed to update on ${global.diffUpdate} mode `)
                })
            } else {
                let values = {
                    hwId : data.hwId,
                    listVersion : data.listVersion,
                    localAuthorizationList : data.localAuthorizationList,
                    lastUpdated : moment(new Date().toISOString()).utc(),
                }
                await LocalAuthorizationList.upsertLocalAuthorizationLists(query,values)
                .then(res => {
                    console.log(`${context} Charger ${data.hwId} list updated with ${global.diffUpdate} mode `)
                })
                .catch(error => {
                    console.error(`${context} Error: Charger ${data.hwId} failed to update on ${global.diffUpdate} mode `)
                })
            }
        })
        .catch(error => {
            console.error(`${context} Error: Charger ${data.hwId} failed on find List`)
        })
    }
}

async function sendManyLocalLists(authorizationList , updateType , sendListMaxLengthValue ,hwId ,listVersion , client , eventEmitter , action , res) {
    const context = "Function sendManyLocalLists"
    try {
        let sendLocalArrayLists = Utils.sliceIntoChunks(authorizationList,sendListMaxLengthValue)

        let version = listVersion
        for (let authorizationListElement of sendLocalArrayLists ) {
            version = await sendList(authorizationListElement ,updateType , hwId ,version , client , eventEmitter , action)
        }
        
        return res.status(200).send("OK");
        
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(400).send({ auth: 'true', code: "server_error_connecting_charging_station", message: `Communication not established between the CS and the charging station ${hwId}`}); 
    }
}

function sendList(authorizationListElement ,updateType , hwId ,listVersion , client , eventEmitter , action) {
    const context = "Function sendList"
    return new Promise(async (resolve, reject) => {
        try {
            const messageId = uuidv4();
            const data = new Object;
            data.listVersion = listVersion
            data.localAuthorizationList = authorizationListElement
            data.updateType = updateType

            const call = [global.callRequest, messageId, action, data];
            console.log(JSON.stringify(call))
            console.log(`Message sent to ${client.id}, ${action}`)

            client.send(JSON.stringify(call), async function (temp) {

                eventEmitter.on(messageId, async function (result) {
                    if (result.status === process.env.statusAccepted) {
                        await updateAuthlist(updateType,{...data , hwId})
                        if (updateType === global.diffUpdate) {
                            listVersion++
                        }
                        Utils.saveLog(hwId, data , result , true , 'SendLocalList' , `SendLocalList command` , 0 , trigger)
                        resolve(listVersion)
                    } else if (result.status  === process.env.statusFailed) {
                        Utils.saveLog(hwId, data , result , false , 'SendLocalList' , 'Failed to update the Local Authorization List.' , 0 , trigger)
                        reject(false)
                    } else if (result.status  === process.env.statusNotSupported) {
                        Utils.saveLog(hwId, data , result , false , 'SendLocalList' , 'Update of Local Authorization List is not supported by Charge Point.' , 0 , trigger)
                        reject(false)
                    } else if (result.status  === process.env.statusVersionMismatch) {
                        Utils.saveLog(hwId, data , result , false , 'SendLocalList' , 'Version number in the request for a differential update is less or equal then version number of current list.' , 0 , trigger)
                        reject(false)
                    } else {
                        Utils.saveLog(hwId, data, result, false, 'SendLocalList', 'An error occurred while processing the request. Please check your request and try again.', 0, trigger);
                        reject(false)
                    }
                });

            });   
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(false)
        }
    });
}