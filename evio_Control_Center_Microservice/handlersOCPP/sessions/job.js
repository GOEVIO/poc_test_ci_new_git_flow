
const Utils = require('../../utils');
const axios = require('axios');
const SessionsQueue = require('../../models/sessionsQueue');
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

module.exports = {
    toOcpi: (req,res) => forceJobProcess(req,res),
}

cron.schedule('*/6 * * * * *', () => {
    sendSessionsToOcpi()
});

async function forceJobProcess(req,res) {
    const context = "Function forceJobProcess";
    try {
        sendSessionsToOcpi()
        return res.status(200).send({ auth: true, code: '', message: 'Process running!' })
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send({ auth: true, code: '', message: error.message })
    }
}

async function sendSessionsToOcpi() {
    const context = "Function sendSessionsToOcpi"
    try {
        let query = {
            $or : [
                { "integrationStatus.status" : process.env.IntegrationStatusOpen },
                {
                    $and : [
                        { "integrationStatus.status" : process.env.IntegrationStatusFailed },
                        { "integrationStatus.failedCount" : { $lt : 3} },
                    ]
                }
            ]
        }
        let sessionsToSend = await SessionsQueue.find(query).lean()
        for (let session of sessionsToSend) {
            sendSession(session)
        }   
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

async function sendSession(session) {
    const context = "Function sendSession"
    try {
        let platform = await Utils.findOnePlatform({_id : session.platformId})
        let platformDetails = platform.platformDetails.find(details => details.version === platform.cpoActiveCredentialsToken[0].version)
        let sessionsEndpoint = Utils.getPlatformSenderEndpoint(session.network , platformDetails , process.env.moduleSessions , process.env.roleReceiver)
        sessionsEndpoint = sessionsEndpoint + `/${session.country_code}/${session.party_id}/${session.sessionId}`
        if (session.command === process.env.PutSessionCommand ) {
            await putSession(sessionsEndpoint , session , platform , session.session)
        } else if (session.command === process.env.PatchSessionCommand) {
            await patchSession(sessionsEndpoint , session , platform , session.session)
        } 
    } catch (error) {
        // Error handling
        console.error(`[${context}] Error `, error.message);
        let responseData = error
        let responseMessage = error.message
        if (error.response) {
            if (error.response.data) {
                responseData = error.response.data
                responseMessage = error.response.data.message
            }
        }
        let newValues = {
            'integrationStatus.failedCount' : ++session.integrationStatus.failedCount,
            'integrationStatus.status' : process.env.IntegrationStatusFailed,
            'integrationStatus.response' : JSON.stringify(responseData),
            'integrationStatus.errorDescription' : responseMessage,
        }
        await SessionsQueue.updateOne({_id : session._id} , {$set : newValues})
    }
}


async function putSession(sessionsEndpoint , session , platform , data) {
    const context = "Function putSession"
    try {
        let resp = await putRequest(sessionsEndpoint,data,{ 'Authorization': `Token ${platform.platformActiveCredentialsToken[0].token}` })
        if (resp.success) {
            let result = resp.data
            if (result.status_code) {
                if ((Math.round(result.status_code / 1000)) == 1) {
                    // Update integration Status and dependencies
                    let newValues = {
                        'integrationStatus.status' : process.env.IntegrationStatusClosed,
                        'integrationStatus.response' : JSON.stringify(result),
                        endpoint : sessionsEndpoint,
                        data : data,
                        token : platform.platformActiveCredentialsToken[0].token,
                        requestType :  "PUT",
                        httpStatus : resp.status
                    }
                    await SessionsQueue.updateOne({_id : session._id} , {$set : newValues})
                    Utils.saveLog(newValues.requestType , data , result , sessionsEndpoint , newValues.token , platform.platformCode , platform.platformName , newValues.httpStatus , process.env.triggerCPO , process.env.moduleSessions , platform.cpo)

                } else {
                    console.log('Unable to use the client’s API Details', result);
                    // Error handling
                    let message = 'Unable to use the client’s API Details'
                    if (result.data) {
                        if (result.data.message) {
                            if (result.data.message.length > 0) {
                                if (result.data.message[0].text) {
                                    message = result.data.message[0].text
                                }
                            }   
                        }
                    }
                    let newValues = {
                        'integrationStatus.failedCount' : ++session.integrationStatus.failedCount,
                        'integrationStatus.status' : process.env.IntegrationStatusFailed,
                        'integrationStatus.response' : JSON.stringify(result),
                        'integrationStatus.errorDescription' : message,
                        endpoint : sessionsEndpoint,
                        data : data,
                        token : platform.platformActiveCredentialsToken[0].token,
                        requestType : "PUT",
                        httpStatus : resp.status
                    }
                    await SessionsQueue.updateOne({_id : session._id} , {$set : newValues})
                    Utils.saveLog(newValues.requestType , data , result , sessionsEndpoint , newValues.token , platform.platformCode , platform.platformName , newValues.httpStatus , process.env.triggerCPO , process.env.moduleSessions , platform.cpo)
                }
            } else {
                // Error handling
                console.log('Unable to use the client’s API Details. Unable to retrieve status_code', result);
                let message = "Unable to use the client’s API Details. Unable to retrieve status_code"
                if (result.data) {
                    if (result.data.message) {
                        if (result.data.message.length > 0) {
                            if (result.data.message[0].text) {
                                message = result.data.message[0].text
                            }
                        }   
                    }
                }
                let newValues = {
                    'integrationStatus.failedCount' : ++session.integrationStatus.failedCount,
                    'integrationStatus.status' : process.env.IntegrationStatusFailed,
                    'integrationStatus.response' : JSON.stringify(result),
                    'integrationStatus.errorDescription' : message,
                    endpoint : sessionsEndpoint,
                    data : data,
                    token : platform.platformActiveCredentialsToken[0].token,
                    requestType : "PUT",
                    httpStatus : resp.status
                }
                await SessionsQueue.updateOne({_id : session._id} , {$set : newValues})
                Utils.saveLog(newValues.requestType , data , result , sessionsEndpoint , newValues.token , platform.platformCode , platform.platformName , newValues.httpStatus , process.env.triggerCPO , process.env.moduleSessions , platform.cpo)
            }
        } else {
            // Error handling
            console.log('Unable to use the client’s API Details.', resp.error);
            let newValues = {
                'integrationStatus.failedCount' : ++session.integrationStatus.failedCount,
                'integrationStatus.status' : process.env.IntegrationStatusFailed,
                'integrationStatus.response' : JSON.stringify(resp.error),
                'integrationStatus.errorDescription' : 'Unable to use the client’s API Details.',
                endpoint : sessionsEndpoint,
                data : data,
                token : platform.platformActiveCredentialsToken[0].token,
                requestType : "PUT",
                httpStatus : resp.status
            }
            await SessionsQueue.updateOne({_id : session._id} , {$set : newValues})
            let responseData = resp.data 
            if (typeof resp.data === 'string' || resp.data instanceof String) {
                responseData = {message : resp.data}
            }
            Utils.saveLog(newValues.requestType , data , responseData , sessionsEndpoint , newValues.token , platform.platformCode , platform.platformName , newValues.httpStatus , process.env.triggerCPO , process.env.moduleSessions , platform.cpo)
        }
        
    } catch (error) {
        // Error handling
        console.error(`[${context}] Error `, error.message);
        let responseData = error
        let responseMessage = error.message
        if (error.response) {
            if (error.response.data) {
                responseData = error.response.data
                responseMessage = error.response.data.message
            }
        }
        let newValues = {
            'integrationStatus.failedCount' : ++session.integrationStatus.failedCount,
            'integrationStatus.status' : process.env.IntegrationStatusFailed,
            'integrationStatus.response' : JSON.stringify(responseData),
            'integrationStatus.errorDescription' : responseMessage,
            endpoint : sessionsEndpoint,
            data : data,
            token : platform.platformActiveCredentialsToken[0].token,
            requestType : "PUT",
        }
        await SessionsQueue.updateOne({_id : session._id} , {$set : newValues})
        
    }
}

async function patchSession(sessionsEndpoint , session , platform , data) {
    const context = "Function patchSession"
    try {
        let resp = await patchRequest(sessionsEndpoint,data,{ 'Authorization': `Token ${platform.platformActiveCredentialsToken[0].token}` })
        if (resp.success) {
            let result = resp.data
            if (result.status_code) {
                if ((Math.round(result.status_code / 1000)) == 1) {
                    // Update integration Status and dependencies
                    let newValues = {
                        'integrationStatus.status' : process.env.IntegrationStatusClosed,
                        'integrationStatus.response' : JSON.stringify(result),
                        endpoint : sessionsEndpoint,
                        data : data,
                        token : platform.platformActiveCredentialsToken[0].token,
                        requestType : "PATCH",
                        httpStatus : resp.status
                    }
                    await SessionsQueue.updateOne({_id : session._id} , {$set : newValues})
                    Utils.saveLog(newValues.requestType , data , result , sessionsEndpoint , newValues.token , platform.platformCode , platform.platformName , newValues.httpStatus , process.env.triggerCPO , process.env.moduleSessions , platform.cpo)

                } else {
                    console.log('Unable to use the client’s API Details', result);
                    // Error handling
                    let message = 'Unable to use the client’s API Details'
                    if (result.data) {
                        if (result.data.message) {
                            if (result.data.message.length > 0) {
                                if (result.data.message[0].text) {
                                    message = result.data.message[0].text
                                }
                            }   
                        }
                    }
                    let newValues = {
                        'integrationStatus.failedCount' : ++session.integrationStatus.failedCount,
                        'integrationStatus.status' : process.env.IntegrationStatusFailed,
                        'integrationStatus.response' : JSON.stringify(result),
                        'integrationStatus.errorDescription' : message,
                        endpoint : sessionsEndpoint,
                        data : data,
                        token : platform.platformActiveCredentialsToken[0].token,
                        requestType : "PATCH",
                        httpStatus : resp.status
                    }
                    await SessionsQueue.updateOne({_id : session._id} , {$set : newValues})
                    Utils.saveLog(newValues.requestType , data , result , sessionsEndpoint , newValues.token , platform.platformCode , platform.platformName , newValues.httpStatus , process.env.triggerCPO , process.env.moduleSessions , platform.cpo)
                }
            } else {
                // Error handling
                console.log('Unable to use the client’s API Details. Unable to retrieve status_code', result);
                let message = "Unable to use the client’s API Details. Unable to retrieve status_code"
                if (result.data) {
                    if (result.data.message) {
                        if (result.data.message.length > 0) {
                            if (result.data.message[0].text) {
                                message = result.data.message[0].text
                            }
                        }   
                    }
                }
                let newValues = {
                    'integrationStatus.failedCount' : ++session.integrationStatus.failedCount,
                    'integrationStatus.status' : process.env.IntegrationStatusFailed,
                    'integrationStatus.response' : JSON.stringify(result),
                    'integrationStatus.errorDescription' : message,
                    endpoint : sessionsEndpoint,
                    data : data,
                    token : platform.platformActiveCredentialsToken[0].token,
                    requestType : "PATCH",
                    httpStatus : resp.status
                }
                await SessionsQueue.updateOne({_id : session._id} , {$set : newValues})
                Utils.saveLog(newValues.requestType , data , result , sessionsEndpoint , newValues.token , platform.platformCode , platform.platformName , newValues.httpStatus , process.env.triggerCPO , process.env.moduleSessions , platform.cpo)
            }
        } else {
            // Error handling
            console.log('Unable to use the client’s API Details.', resp.error);
            let newValues = {
                'integrationStatus.failedCount' : ++session.integrationStatus.failedCount,
                'integrationStatus.status' : process.env.IntegrationStatusFailed,
                'integrationStatus.response' : JSON.stringify(resp.error),
                'integrationStatus.errorDescription' : 'Unable to use the client’s API Details.',
                endpoint : sessionsEndpoint,
                data : data,
                token : platform.platformActiveCredentialsToken[0].token,
                requestType : "PATCH",
                httpStatus : resp.status
            }
            await SessionsQueue.updateOne({_id : session._id} , {$set : newValues})
            let responseData = resp.data 
            if (typeof resp.data === 'string' || resp.data instanceof String) {
                responseData = {message : resp.data}
            }
            Utils.saveLog(newValues.requestType , data , responseData , sessionsEndpoint , newValues.token , platform.platformCode , platform.platformName , newValues.httpStatus , process.env.triggerCPO , process.env.moduleSessions , platform.cpo)
        }
        
    } catch (error) {
        // Error handling
        console.error(`[${context}] Error `, error.message);
        let responseData = error
        let responseMessage = error.message
        if (error.response) {
            if (error.response.data) {
                responseData = error.response.data
                responseMessage = error.response.data.message
            }
        }
        let newValues = {
            'integrationStatus.failedCount' : ++session.integrationStatus.failedCount,
            'integrationStatus.status' : process.env.IntegrationStatusFailed,
            'integrationStatus.response' : JSON.stringify(responseData),
            'integrationStatus.errorDescription' : responseMessage,
            endpoint : sessionsEndpoint,
            data : data,
            token : platform.platformActiveCredentialsToken[0].token,
            requestType : "PATCH",
        }
        await SessionsQueue.updateOne({_id : session._id} , {$set : newValues})
        
    }
}

async function patchRequest(host,data,headers) {
    const context = "Function patchRequest";
    let response = {success : true , data : {} , error : "" , code : ""}
    try {
        let resp = await axios.patch(host, data , {headers})
        if (resp.data) {
            return {...response , data : resp.data , status : Utils.getHttpStatus(resp)}
        } else {
            return { ...response , success : false, error: 'Not updated' , status : Utils.getHttpStatus(resp) }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        if (error.response) {
            if (error.response.data) {
                return { ...response , success : false, error: error.response.data.message , code : error.response.data.code , status : Utils.getHttpStatus(error.response) , data : error.response.data }
            }
            return { ...response , success : false, error: error.message , status : Utils.getHttpStatus(error.response)}
        }
        return { ...response , success : false, error: error.message , status : Utils.getHttpStatus(error.response)}
    }
}

async function putRequest(host,data,headers) {
    const context = "Function putRequest";
    let response = {success : true , data : {} , error : "" , code : ""}
    try {
        let resp = await axios.put(host, data , {headers})
        if (resp.data) {
            return {...response , data : resp.data , status : Utils.getHttpStatus(resp)}
        } else {
            return { ...response , success : false, error: 'Not updated' , status : Utils.getHttpStatus(resp) }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        if (error.response) {
            if (error.response.data) {
                return { ...response , success : false, error: error.response.data.message , code : error.response.data.code , status : Utils.getHttpStatus(error.response) , data : error.response.data}
            }
            return { ...response , success : false, error: error.message , status : Utils.getHttpStatus(error.response)}
        }
        return { ...response , success : false, error: error.message , status : Utils.getHttpStatus(error.response)}
    }
}