
const Utils = require('../../utils');
const axios = require('axios');

module.exports = {
    post: async function (req, res) {
        try {
            const {party_id, network, idTag, tokenType, location_id, evse_uids} = req.body
            if (!party_id) {
                return res.status(400).send({ auth: 'true', code: "server_party_id_required", message: 'party_id required' });
            }

            if (!network) {
                return res.status(400).send({ auth: 'true', code: "server_network_required", message: 'network required' });
            }

            if (!idTag) {
                return res.status(400).send({ auth: 'true', code: "server_idTag_required", message: 'idTag required' });
            }

            if (!tokenType) {
                return res.status(400).send({ auth: 'true', code: "server_tokenType_required", message: 'tokenType required' });
            }


            const platform = await Utils.findOnePlatform({cpo : party_id, platformCode : network})
            if (platform) {
                if (network === process.env.MobiePlatformCode) {
                    const body = {
                        location_id,
                        evse_uids,
                    }
                    const platformDetails = platform.platformDetails.find(details => details.version === platform.cpoActiveCredentialsToken[0].version)
                    const tokensEndpoint = Utils.getPlatformSenderEndpoint(network, platformDetails , process.env.moduleTokens , process.env.roleSender)
                    const host = Utils.getAuthorizeTokenHost(tokensEndpoint , idTag , tokenType)
                    const authToken = platform.platformActiveCredentialsToken[0].token
                    const resp = await postRequest(host,body,{ 'Authorization': `Token ${authToken}` })
                    if (resp.success) {
                        const result = resp.data
                        if (result.status_code) {
                            if ((Math.round(result.status_code / 1000)) == 1) {
                                Utils.saveLog('POST' , body , result , host , authToken , platform.platformCode , platform.platformName , resp.status , process.env.triggerCPO , process.env.moduleTokens , platform.cpo)
                                return res.status(200).send(result.data);
                            } else {
                                Utils.saveLog('POST' , body , result , host , authToken , platform.platformCode , platform.platformName , resp.status , process.env.triggerCPO , process.env.moduleTokens , platform.cpo)
                                return res.status(400).send(null);
                            }   
                        } else {
                            Utils.saveLog('POST' , body , result , host , authToken , platform.platformCode , platform.platformName , resp.status , process.env.triggerCPO , process.env.moduleTokens , platform.cpo)
                            return res.status(400).send(null);    
                        }  
                    } else {
                        let responseData = resp.data 
                        if (typeof resp.data === 'string' || resp.data instanceof String) {
                            responseData = {message : resp.data}
                        }
                        Utils.saveLog('POST' , body , responseData , host , authToken , platform.platformCode , platform.platformName , resp.status , process.env.triggerCPO , process.env.moduleTokens , platform.cpo)
                        return res.status(400).send(null);    
                    }
                } else if (network === process.env.GirevePlatformCode) {
                    //TODO Implement Gireve call to token
                    return res.status(200).send(null);    
    
                } else {
                    return res.status(200).send(null);    
                }
            } else {
                console.log("No platform was found for given parameters " , data);
                return res.status(200).send(null);    
            }
        } catch (e) {
            console.log("Generic client error. ", e);
            return res.status(400).send(e.message);
        }
    }
}


async function postRequest(host,data,headers) {
    const context = "Function postRequest";
    const response = {success : true , data : {} , error : "" , code : ""}
    try {
        const resp = await axios.post(host, data , {headers})
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