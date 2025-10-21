
const Utils = require('../../utils');
const CommandsQueue = require('../../models/commandsQueue');
const axios = require('axios');
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

cron.schedule('*/3 * * * * *', () => {
    sendCommandsToOcpi()
});

async function forceJobProcess(req,res) {
    const context = "Function forceJobProcess";
    try {
        sendCommandsToOcpi()
        return res.status(200).send({ auth: true, code: '', message: 'Process running!' })
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send({ auth: true, code: '', message: error.message })
    }
}

async function sendCommandsToOcpi() {
    const context = "Function sendCommandsToOcpi"
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
        let commandsToSend = await CommandsQueue.find(query).lean()
        for (let command of commandsToSend) {
            sendCommand(command)
        }   
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

async function sendCommand(command) {
    const context = "Function sendCommand"
    try {
        let platform = await Utils.findOnePlatform({_id : command.platformId})
        await postCommand(command.response_url , command , platform , {result : command.result , message : command.message ?  [{"language": "en","text": command.message}] : [] })
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
            'integrationStatus.failedCount' : ++command.integrationStatus.failedCount,
            'integrationStatus.status' : process.env.IntegrationStatusFailed,
            'integrationStatus.response' : JSON.stringify(responseData),
            'integrationStatus.errorDescription' : responseMessage,
        }
        await CommandsQueue.updateOne({_id : command._id} , {$set : newValues})
    }
}

async function postCommand(commandsEndpoint , command , platform , data) {
    const context = "Function postCommand"
    try {
        let resp = await postRequest(commandsEndpoint,data,{ 'Authorization': `Token ${platform.platformActiveCredentialsToken[0].token}` })
        if (resp.success) {
            let result = resp.data
            if (result.status_code) {
                if ((Math.round(result.status_code / 1000)) == 1) {
                    // Update integration Status and dependencies
                    let newValues = {
                        'integrationStatus.status' : process.env.IntegrationStatusClosed,
                        'integrationStatus.response' : JSON.stringify(result),
                        endpoint : commandsEndpoint,
                        data : data,
                        token : platform.platformActiveCredentialsToken[0].token,
                        requestType : "POST",
                        httpStatus : resp.status
                    }
                    await CommandsQueue.updateOne({_id : command._id} , {$set : newValues})
                    Utils.saveLog(newValues.requestType , data , result , commandsEndpoint , newValues.token , platform.platformCode , platform.platformName , newValues.httpStatus , process.env.triggerCPO , process.env.moduleCommands , platform.cpo)

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
                        'integrationStatus.failedCount' : ++command.integrationStatus.failedCount,
                        'integrationStatus.status' : process.env.IntegrationStatusFailed,
                        'integrationStatus.response' : JSON.stringify(result),
                        'integrationStatus.errorDescription' : message,
                        endpoint : commandsEndpoint,
                        data : data,
                        token : platform.platformActiveCredentialsToken[0].token,
                        requestType : "POST",
                        httpStatus : resp.status
                    }
                    await CommandsQueue.updateOne({_id : command._id} , {$set : newValues})
                    Utils.saveLog(newValues.requestType , data , result , commandsEndpoint , newValues.token , platform.platformCode , platform.platformName , newValues.httpStatus , process.env.triggerCPO , process.env.moduleCommands , platform.cpo)
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
                    'integrationStatus.failedCount' : ++command.integrationStatus.failedCount,
                    'integrationStatus.status' : process.env.IntegrationStatusFailed,
                    'integrationStatus.response' : JSON.stringify(result),
                    'integrationStatus.errorDescription' : message,
                    endpoint : commandsEndpoint,
                    data : data,
                    token : platform.platformActiveCredentialsToken[0].token,
                    requestType : "POST",
                    httpStatus : resp.status
                }
                await CommandsQueue.updateOne({_id : command._id} , {$set : newValues})
                Utils.saveLog(newValues.requestType , data , result , commandsEndpoint , newValues.token , platform.platformCode , platform.platformName , newValues.httpStatus , process.env.triggerCPO , process.env.moduleCommands , platform.cpo)
            }
        } else {
            // Error handling
            console.log('Unable to use the client’s API Details.', resp.error);
            let newValues = {
                'integrationStatus.failedCount' : ++command.integrationStatus.failedCount,
                'integrationStatus.status' : process.env.IntegrationStatusFailed,
                'integrationStatus.response' : JSON.stringify(resp.error),
                'integrationStatus.errorDescription' : 'Unable to use the client’s API Details.',
                endpoint : commandsEndpoint,
                data : data,
                token : platform.platformActiveCredentialsToken[0].token,
                requestType : "POST",
                httpStatus : resp.status
            }
            await CommandsQueue.updateOne({_id : command._id} , {$set : newValues})
            let responseData = resp.data 
            if (typeof resp.data === 'string' || resp.data instanceof String) {
                responseData = {message : resp.data}
            }
            Utils.saveLog(newValues.requestType , data , responseData , commandsEndpoint , newValues.token , platform.platformCode , platform.platformName , newValues.httpStatus , process.env.triggerCPO , process.env.moduleCommands , platform.cpo)
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
            'integrationStatus.failedCount' : ++command.integrationStatus.failedCount,
            'integrationStatus.status' : process.env.IntegrationStatusFailed,
            'integrationStatus.response' : JSON.stringify(responseData),
            'integrationStatus.errorDescription' : responseMessage,
            endpoint : commandsEndpoint,
            data : data,
            token : platform.platformActiveCredentialsToken[0].token,
            requestType : "POST",
        }
        await CommandsQueue.updateOne({_id : command._id} , {$set : newValues})
        
    }
}

async function postRequest(host,data,headers) {
    const context = "Function postRequest";
    let response = {success : true , data : {} , error : "" , code : ""}
    try {
        let resp = await axios.post(host, data , {headers})
        if (resp.data) {
            return {...response , data : resp.data , status : Utils.getHttpStatus(resp)}
        } else {
            return { ...response , success : false, error: 'Not sent' , status : Utils.getHttpStatus(resp) }
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