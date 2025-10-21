const Promise = require('promise');
const moment = require('moment');
const global = require('../global');
const Utils = require('../utils');
const axios = require("axios");
const crypto = require('crypto');

const host = global.charger_microservice_host;
const host_identity = global.identity_microservice_host;
const idTagProxy = `${host_identity}/api/private/contracts/idTag`;
const RFIDidTagProxy = `${host_identity}/api/private/contracts/checkIdTag`;
const chargingSessionProxy = `${host}/api/private/chargingSession`;
const chargerServiceProxy = `${host}/api/private/chargers/status`;
const chargingSessionStartServiceProxy = `${host}/api/private/chargingSession/start`;
const { SessionStatusesNumberTypes } = require('../v2/configs/constants')

const context = "[Authorize] ";
module.exports = {
    handle: function (data, payload) {
        return new Promise(function (resolve, reject) {

            const hwId = data.chargeBoxIdentity;
            const message = `Trying authentication on station ${data.chargeBoxIdentity} with IdTag ${payload.idTag}`

            try {
                const idTag = payload.idTag;

                /////////////////////////////////////////////////////////////////////////////
                //Check if charger exists on EVIO Network and get data of charger
                let params = {
                    hwId: hwId
                };

                Utils.chekIfChargerExists(chargerServiceProxy, params).then((charger) => {

                    if (charger) {

                        params = {
                            idTag: idTag,
                            status: {$in: [SessionStatusesNumberTypes.PENDING, SessionStatusesNumberTypes.PENDING_DELAY, SessionStatusesNumberTypes.PENDING_START]},
                            hwId: hwId
                        };

                        Utils.getSession(chargingSessionProxy, params).then(async (session) => {

                            //if allowRemoteAuthorize key is enabled
                            if (session) {
                                const userId = session.userId;


                                params = {
                                    userId: userId,
                                    idTag: idTag,
                                    hwId: hwId
                                };

                                /////////////////////////////////////////////////////////////////////////////
                                //Check if tagId is valid
                                Utils.checkIdTagValidity(RFIDidTagProxy, params).then((contract) => {
                                    if (contract) {

                                        /////////////////////////////////////////////////////////////////////////////
                                        //Accept authorize
                                        sendResponse(data, payload , global.idTagStatusAccepted, resolve , 'Accepted idTag' , true);
                                    }
                                    else {
                                        console.error(`${context} Invalid id tag: `, params);
                                        /////////////////////////////////////////////////////////////////////////////
                                        //Refuse authorize
                                        sendResponse(data, payload , global.idTagStatusInvalid, resolve , 'Invalid idTag' , false);
                                    }

                                });

                            } else {

                                console.log(`${context} RFID card read!. A Charging session will be created with idTag: `, idTag);
                                console.log("RFID Usage", charger.allowRFID);
                                if (charger.allowRFID == true) {

                                    let chargerType = charger.chargerType ? charger.chargerType : global.OCPPJ_16_DeviceType
                                    params = {
                                        idTag: idTag,
                                        hwId: hwId,
                                        chargerType
                                    };

                                    let fees
                                    //var fees = { IEC: 0.001, IVA: 0.23 }
                                    /////////////////////////////////////////////////////////////////////////////
                                    //Check if RFID tagId is valid
                                    //Check only if user has permissions
                                    Utils.checkIdTagValidity(RFIDidTagProxy, params).then(async (contract) => {


                                        if (contract) {

                                            const userId = contract.userId;
                                            fees = await Utils.getFeesWithUser(charger, contract?.userIdToBilling)
                                            let evId = "-1";
                                            if (contract.contractType === "fleet") {
                                                evId = contract.evId;
                                            }

                                            let fleetId = "-1";
                                            if (contract.contractType === "fleet") {
                                                fleetId = contract.fleetId;
                                            }
                                            ////////////////////////////////////////////////////////////////////////////
                                            //TODO Create session with given idTag
                                            const dateNow = moment(new Date().toISOString()).utc();
                                            const body = {
                                                'hwId': hwId,
                                                'fleetId':fleetId,
                                                'evId': evId,
                                                'idTag': idTag,
                                                'sessionPrice': -1,
                                                'command': process.env.StartCommand,
                                                'chargerType': chargerType,
                                                'status': process.env.SessionStatusToStart,
                                                'userId': userId,
                                                'plugId': -1,
                                                'startDate': dateNow,
                                                'authType': 'RFID',
                                                'tariffId': -1,
                                                'fees': fees,
                                                'address': charger.address,
                                                'freeOfCharge': charger.accessType === process.env.ChargerAccessFreeCharge,
                                                'operatorId' :  charger.operatorId,
                                                'cardNumber': contract.cardNumber
                                            }


                                            axios.post(chargingSessionStartServiceProxy, body)
                                                .then(function (chargingSession) {
                                                    if (chargingSession) {
                                                        sendResponse(data, payload , global.idTagStatusAccepted, resolve , 'Accepted idTag' , true);
                                                    }
                                                    else {
                                                        sendResponse(data, payload , global.idTagStatusInvalid, resolve , 'Failed to create session' , false);
                                                    }

                                                })
                                                .catch(function (error, err) {
                                                    if (!error)
                                                        console.error(`${context} error - Check error 5554896124`);
                                                    else
                                                        console.error(`${context} error: , ${JSON.stringify(error)}`);
                                                    
                                                    if (error) {
                                                        if (error.response) {
                                                            sendResponse(data, payload , global.idTagStatusInvalid, resolve , error.response.data.message , false);
                                                        } else {
                                                            sendResponse(data, payload , global.idTagStatusInvalid, resolve , error.message , false);
                                                        }
                                                    } else {
                                                        sendResponse(data, payload , global.idTagStatusInvalid, resolve , `Communication not established between the CS and the charging station ${hwId}` , false);
                                                    }

                                                });

                                        } else {
                                            fees = await Utils.getFees(charger)
                                            if (charger.accessType === process.env.ChargerAccessPublic) {
                                                console.log(`Public Charger on unknown idTag ${idTag}`)

                                                //Check which networks are active on the charger
                                                let networkMobiE = charger.networks.find(obj => obj.network === process.env.MobiePlatformCode && obj.activationRequest && obj.status === process.env.ChargerNetworkStatusActive)
                                                let networkGireve = charger.networks.find(obj => obj.network === process.env.GirevePlatformCode && obj.activationRequest && obj.status === process.env.ChargerNetworkStatusActive)  
                                                let networkHubject = charger.networks.find(obj => obj.network === process.env.HubjectPlatformCode && obj.activationRequest && obj.status === process.env.ChargerNetworkStatusActive)
                                                
                                                if (networkMobiE) {
                                                    console.log(`Network MobiE`)
                                                    //Check if token exists on MobiE 
                                                    const { location_id, evse_uids } = Utils.getChargerLocationEvses(charger, networkMobiE)
                                                    let authorizedMobiE = await Utils.authorizeToken(networkMobiE.network, networkMobiE.party_id, idTag, process.env.tokenRFID, location_id, evse_uids)
                                                    
                                                    if (authorizedMobiE) {
                                                        console.log(`authorizedMobiE` , JSON.stringify(authorizedMobiE))

                                                        const body = bodyChargingSession(process.env.MobiePlatformCode, networkMobiE, idTag, charger, hwId, chargerType, fees, authorizedMobiE)

                                                        axios.post(chargingSessionStartServiceProxy, body)
                                                        .then(function (chargingSession) {
                                                            if (chargingSession) {
                                                                sendResponse(data, payload , global.idTagStatusAccepted, resolve , 'Accepted idTag' , true);
                                                            }
                                                            else {
                                                                sendResponse(data, payload , global.idTagStatusInvalid, resolve , 'Failed to create session' , false);
                                                            }

                                                        })
                                                        .catch(function (error, err) {
                                                            if (!error)
                                                                console.error(`${context} error - Check error 5554896124`);
                                                            else
                                                                console.error(`${context} error: , ${JSON.stringify(error)}`);
                                                            
                                                            if (error) {
                                                                if (error.response) {
                                                                    sendResponse(data, payload , global.idTagStatusInvalid, resolve , error.response.data.message , false);
                                                                } else {
                                                                    sendResponse(data, payload , global.idTagStatusInvalid, resolve , error.message , false);
                                                                }
                                                            } else {
                                                                sendResponse(data, payload , global.idTagStatusInvalid, resolve , `Communication not established between the CS and the charging station ${hwId}` , false);
                                                            }

                                                        });

                                                    } else {
                                                        if (networkGireve) {
                                                            console.log(`networkGireve` , JSON.stringify(networkGireve))
                                                            //Check if token exists on Gireve 
                                                            const { location_id, evse_uids } = Utils.getChargerLocationEvses(charger, networkGireve)
                                                            let authorizedGireve = await Utils.authorizeToken(networkGireve.network, networkGireve.party_id, idTag, process.env.tokenRFID, location_id, evse_uids)
                                                            
                                                            if (!authorizedGireve){
                                                                console.error(`${context} Gireve not implemented: `, params);
                                                                return sendResponse(data, payload , global.idTagStatusInvalid, resolve , 'Invalid idTag' , false);
                                                            }
        
                                                            const body = bodyChargingSession(process.env.GirevePlatformCode, networkGireve, idTag, charger, hwId, chargerType, fees, authorizedGireve)

                                                            axios.post(chargingSessionStartServiceProxy, body)
                                                                .then(function (chargingSession) {
                                                                    if (chargingSession) {
                                                                        sendResponse(data, payload , global.idTagStatusAccepted, resolve , 'Accepted idTag' , true);
                                                                    }
                                                                    else {
                                                                        sendResponse(data, payload , global.idTagStatusInvalid, resolve , 'Failed to create session' , false);
                                                                    }

                                                                })
                                                                .catch(function (error, err) {
                                                                    if (!error)
                                                                        console.error(`${context} error - Check error 5554896124`);
                                                                    else
                                                                        console.error(`${context} error: , ${JSON.stringify(error)}`);
                                                                    
                                                                    if (error) {
                                                                        if (error.response) {
                                                                            sendResponse(data, payload , global.idTagStatusInvalid, resolve , error.response.data.message , false);
                                                                        } else {
                                                                            sendResponse(data, payload , global.idTagStatusInvalid, resolve , error.message , false);
                                                                        }
                                                                    } else {
                                                                        sendResponse(data, payload , global.idTagStatusInvalid, resolve , `Communication not established between the CS and the charging station ${hwId}` , false);
                                                                    }

                                                                });
                                                        } else {
                                                            console.error(`${context} Invalid id tag: `, params);
                                                            sendResponse(data, payload , global.idTagStatusInvalid, resolve , 'Invalid idTag' , false);
                                                        }
                                                    }
                                                } else if (networkGireve) {
                                                    console.log(`Network Gireve`)
                                                    //Check if token exists on Gireve 
                                                    const { location_id, evse_uids } = Utils.getChargerLocationEvses(charger, networkGireve)
                                                    let authorizedGireve = await Utils.authorizeToken(networkGireve.network, networkGireve.party_id, idTag, process.env.tokenRFID, location_id, evse_uids)
                                                    
                                                    if (!authorizedGireve){
                                                        console.error(`${context} Gireve not implemented: `, params);
                                                        return sendResponse(data, payload , global.idTagStatusInvalid, resolve , 'Invalid idTag' , false);
                                                    }

                                                    const body = bodyChargingSession(process.env.GirevePlatformCode, networkGireve, idTag, charger, hwId, chargerType, fees, authorizedGireve)
                                                        
                                                    axios.post(chargingSessionStartServiceProxy, body)
                                                        .then(function (chargingSession) {
                                                            if (chargingSession) {
                                                                sendResponse(data, payload , global.idTagStatusAccepted, resolve , 'Accepted idTag' , true);
                                                            }
                                                            else {
                                                                sendResponse(data, payload , global.idTagStatusInvalid, resolve , 'Failed to create session' , false);
                                                            }

                                                        })
                                                        .catch(function (error, err) {
                                                            if (!error)
                                                                console.error(`${context} error - Check error 5554896124`);
                                                            else
                                                                console.error(`${context} error: , ${JSON.stringify(error)}`);
                                                            
                                                            if (error) {
                                                                if (error.response) {
                                                                    sendResponse(data, payload , global.idTagStatusInvalid, resolve , error.response.data.message , false);
                                                                } else {
                                                                    sendResponse(data, payload , global.idTagStatusInvalid, resolve , error.message , false);
                                                                }
                                                            } else {
                                                                sendResponse(data, payload , global.idTagStatusInvalid, resolve , `Communication not established between the CS and the charging station ${hwId}` , false);
                                                            }

                                                        }); 

                                                } else if (networkHubject) {
                                                    console.log(`Network Hubject`)
                                                    //Check if token exists on Hubject 
                                                    let authorizedHubject = await Utils.authorizeToken(networkHubject.network, networkHubject.party_id, idTag, process.env.tokenRFID)
                                                    
                                                    if (!authorizedHubject){
                                                        console.error(`${context} Hubject not implemented: `, params);
                                                        return sendResponse(data, payload , global.idTagStatusInvalid, resolve , 'Invalid idTag' , false);

                                                    }

                                                    const body = bodyChargingSession(process.env.HubjectPlatformCode, networkHubject, idTag, charger, hwId, chargerType, fees, authorizedHubject)

                                                    const activeSessionExists = await checkActiveSession(idTag);

                                                    if(!activeSessionExists){

                                                        axios.post(chargingSessionStartServiceProxy, body)
                                                            .then(function (chargingSession) {
                                                                if (chargingSession) {

                                                                    //let host = "http://oicp:3034/api/private/oicp23/AuthorizeStart";
                                                                    let oicpHostStart  = process.env.HostOICP + process.env.AuthorizeStart;
                                                                    console.log(`Attempting to send OICP request to: ${oicpHostStart}`);

                                                                    axios.post(oicpHostStart, {
                                                                            token: body.cdr_token,
                                                                            hwID: body.hwId,
                                                                            connectorID: body.connector_id,
                                                                            userId: body.userId,
                                                                            tariffID: body.tariffId,
                                                                            sessionID: chargingSession.sessionId
                                                                        })
                                                                        .then(() => {
                                            
                                                                            sendResponse(data, payload, global.idTagStatusAccepted, resolve, 'Accepted idTag', true);
                                                                        })
                                                                        .catch(() => {
                                                                            
                                                                            sendResponse(data, payload, global.idTagStatusInvalid, resolve, 'Failed to create session with OICP', false);
                                                                        });
                                                                }
                                                                else {

                                                                    sendResponse(data, payload , global.idTagStatusInvalid, resolve , 'Failed to create session' , false);
                                                                }
                                                            })
                                                            .catch(function (error) {
                                                                if (error?.response) {
                                                                    console.error(`${context} error: , ${error.message}`);
                                                                    sendResponse(data, payload , global.idTagStatusInvalid, resolve , error.response.data.message , false);
                                                                } else if(error){
                                                                        console.error(`${context} error: , ${error.message}`);
                                                                        sendResponse(data, payload , global.idTagStatusInvalid, resolve , error.message , false);
                                                                } else {
                                                                    sendResponse(data, payload , global.idTagStatusInvalid, resolve , `Communication not established between the CS and the charging station ${hwId}` , false);
                                                                }
                                                            });

                                                    } else {
                                                        axios.post(chargingSessionProxy, body)
                                                            .then(function (chargingSession) {
                                                                if (chargingSession) {

                                                                    //let host = "http://oicp:3034/api/private/oicp23/AuthorizeStop";
                                                                    let oicpHostStop  = process.env.HostOICP + process.env.AuthorizeStop;
                                                                    console.log(`Attempting to send OICP request to: ${oicpHostStop}`);

                                                                    axios.post(oicpHostStop, {
                                                                            token: body.cdr_token,
                                                                            hwID: body.hwId,
                                                                            connectorID: body.connector_id,
                                                                            userId: body.userId,
                                                                            tariffID: body.tariffId,
                                                                            sessionID: chargingSession.sessionId
                                                                        })
                                                                        .then(() => {
                                            
                                                                            sendResponse(data, payload, global.idTagStatusAccepted, resolve, 'Accepted idTag', true);
                                                                        })
                                                                        .catch(() => {
                                                                            
                                                                            sendResponse(data, payload, global.idTagStatusInvalid, resolve, 'Failed to create session with OICP', false);
                                                                        });
                                                                }
                                                                else {

                                                                    sendResponse(data, payload , global.idTagStatusInvalid, resolve , 'Failed to create session' , false);
                                                                }
                                                            })
                                                            .catch(function (error) {
                                                                if (error?.response) {
                                                                    console.error(`${context} error: , ${error.message}`);
                                                                    sendResponse(data, payload , global.idTagStatusInvalid, resolve , error.response.data.message , false);
                                                                } else if(error){
                                                                        console.error(`${context} error: , ${error.message}`);
                                                                        sendResponse(data, payload , global.idTagStatusInvalid, resolve , error.message , false);
                                                                } else {
                                                                    sendResponse(data, payload , global.idTagStatusInvalid, resolve , `Communication not established between the CS and the charging station ${hwId}` , false);
                                                                }
                                                            });
                                                    }
                                                    
                                                } else {
                                                    console.error(`${context} Invalid id tag: `, params);
                                                    sendResponse(data, payload , global.idTagStatusInvalid, resolve , 'Invalid idTag' , false);
                                                }
                                                 
                                            } else if (charger.accessType === process.env.ChargerAccessFreeCharge) {
                                                console.error(`${context} Invalid id tag but charger accessType is ${charger.accessType}. Session will be created with idTag `, idTag);

                                                let userId = "UNKNOWN"
                                                let evId = "-1";
                                                let fleetId = "-1";
                                                const dateNow = moment(new Date().toISOString()).utc();
                                                const body = {
                                                    'hwId': hwId,
                                                    'fleetId':fleetId,
                                                    'evId': evId,
                                                    'idTag': idTag,
                                                    'sessionPrice': -1,
                                                    'command': process.env.StartCommand,
                                                    'chargerType': chargerType,
                                                    'status': process.env.SessionStatusToStart,
                                                    'userId': userId,
                                                    'plugId': -1,
                                                    'startDate': dateNow,
                                                    'authType': 'RFID',
                                                    'tariffId': -1,
                                                    'fees': fees,
                                                    'address': charger.address,
                                                    'userIdWillPay' :  charger.createUser,
                                                    'operatorId' :  charger.operatorId,
                                                    'paymentMethod': process.env.PaymentMethodNotPay,
                                                    'freeOfCharge': true,
                                                }
    
                                                axios.post(chargingSessionStartServiceProxy, body)
                                                    .then(function (chargingSession) {
                                                        if (chargingSession) {
                                                            sendResponse(data, payload , global.idTagStatusAccepted, resolve , 'Accepted idTag' , true);
                                                        }
                                                        else {
                                                            sendResponse(data, payload , global.idTagStatusInvalid, resolve , 'Failed to create session' , false);
                                                        }
    
                                                    })
                                                    .catch(function (error, err) {
                                                        if (!error)
                                                            console.error(`${context} error - Check error 5554896124`);
                                                        else
                                                            console.error(`${context} error: , ${JSON.stringify(error)}`);
                                                        
                                                        if (error) {
                                                            if (error.response) {
                                                                sendResponse(data, payload , global.idTagStatusInvalid, resolve , error.response.data.message , false);
                                                            } else {
                                                                sendResponse(data, payload , global.idTagStatusInvalid, resolve , error.message , false);
                                                            }
                                                        } else {
                                                            sendResponse(data, payload , global.idTagStatusInvalid, resolve , `Communication not established between the CS and the charging station ${hwId}` , false);
                                                        }
    
                                                    });
                                            } else {
                                                console.error(`${context} Invalid id tag: `, params);
                                                sendResponse(data, payload , global.idTagStatusInvalid, resolve , 'Invalid idTag' , false);
                                            }
                                        }

                                    });

                                } else {
                                    console.error(`${context} Charger ${hwId} does not allow RFID usage.`);
                                    sendResponse(data, payload , global.idTagStatusInvalid, resolve , `Charger ${hwId} does not allow RFID usage.` , false);
                                }
                            }
                        });

                    }
                    else {
                        console.error(`${context} Charger ${hwId} does not exists`)
                        sendResponse(data, payload , global.idTagStatusInvalid, resolve , `Charger ${hwId} does not exists` , false);
                    }
                });
            } catch (error) {
                sendResponse(data, payload , global.idTagStatusInvalid, resolve , `${error.message}` , false);
                console.error('[Authorize] error :' + error);
            }
        });
    }
}


const sendResponse = (data, payload , status, resolve , text , success) => {

    let AuthorizeResponse = [global.callResult, data.messageId, {
        idTagInfo: {
            status: status
        }
    }];

    Utils.saveLog(data.chargeBoxIdentity , payload , AuthorizeResponse[2] , success , 'Authorize' , text , 0 , global.triggeredByCP)
    resolve(AuthorizeResponse);

};

function bodyChargingSession(networkCode, networkType, idTag, charger, hwId, chargerType, fees, authorizedToken) {
    try {
        
        let evId = "-1";
        let fleetId = "-1";
        const dateNow = moment(new Date().toISOString()).utc();

        return {
            'hwId': hwId,
            'fleetId': fleetId,
            'evId': evId,
            'idTag': idTag,
            'sessionPrice': -1,
            'command': process.env.StartCommand,
            'chargerType': chargerType,
            'status': process.env.SessionStatusToStart,
            'userId': "UNKNOWN",
            'plugId': -1,
            'startDate': dateNow,
            'authType': 'RFID',
            'tariffId': "-1",
            'fees': fees,
            'address': charger.address,
            'userIdWillPay': charger.operatorId,
            'operatorId': charger.operatorId,
            'freeOfCharge': charger.accessType === process.env.ChargerAccessFreeCharge,
            'paymentMethod': process.env.PaymentMethodNotPay,
            'createdWay': process.env.createdWayOcpiRfid,
            'network': networkCode, 
            'country_code': networkType.country_code, 
            'party_id': networkType.party_id, 
            'cdr_token': Utils.buildCdrToken(networkCode, authorizedToken.token, idTag), 
            // 'response_url': response_url,
            // 'authorization_reference': authorization_reference,
            'location_id': networkType.id, 
            // 'evse_uid' : evse_uid,
            // 'connector_id' : connector_id,
            'ocpiId': crypto.randomUUID(),
            'auth_method': process.env.authMethodRequest,
            'cpoTariffIds': Utils.getCpoTariffIds(charger.plugs, networkCode)
        };

    } catch (error) {
        console.error(`${context} error: ${JSON.stringify(error)}`);
        throw error;
    }
}

async function checkActiveSession(idTag) {
    try {
        const allActiveSessionsServiceProxy = `${host}/api/private/chargingSession/allActiveSessions`;

        const activeSessionsResponse = await axios.get(allActiveSessionsServiceProxy);
   
        const activeSessions = activeSessionsResponse.data;

        // Check if there is an active session for the specified ID.
        const sessionExists = activeSessions.some(session => session.idTag === idTag);
        console.log(`Checking active session for ID ${idTag}: ${sessionExists ? 'Active session found' : 'No active session'}`);

        return sessionExists;

    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Error communicating with the charging session service:', error.message);
        } else {
            console.error('Unexpected error while checking active sessions:', error.message);
        }
        return false;
    }
}
