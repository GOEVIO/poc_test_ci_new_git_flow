
const Utils = require('../../../utils');

module.exports = {
    post: async function (req, res) {

        let platform = req.headers.platform

        //Validate if sent data is valid JSON to process
        let data = req.body;

        if (Utils.isEmptyObject(data)) {
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));
        }

        let response_url = data.response_url;
        if (!response_url) {
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing id parameters"));
        }
        let token = data.token;
        if (!token) {
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing id parameters"));
        }
        let location_id = data.location_id;
        if (!location_id) {
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing id parameters"));
        }
        let evse_uid = data.evse_uid;
        if (!evse_uid) {
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing id parameters"));
        }
        let authorization_reference = data.authorization_reference;
        // if (!authorization_reference) {
        //     return res.status(200).send(Utils.response(null, 2001, "Invalid or missing id parameters"));
        // }

        try {
            let cpoCountryCode = platform.cpoRoles.find( roleObj => roleObj.role === process.env.cpoRole).country_code

            let query = {
                network: platform.platformCode,
                party_id : platform.cpo,
                country_code : cpoCountryCode,
                locationId : location_id,
                date_from : "",
                date_to : "",
            }

            let foundCharger = await Utils.getSpecificCharger(query)

            if (foundCharger) {
                if (Object.keys(foundCharger).length === 0) {
                    return res.status(200).send(Utils.response(null, 2000, "Generic client error "));
                } else {
                    
                    if (evse_uid) {
                        let plugId = evse_uid.split("-").pop()
                        let connector_id = `${evse_uid}-${plugId}`
                        let foundPlug = foundCharger.plugs.find(plug => plug.plugId === plugId)
                        if (foundPlug) {
                            if (foundCharger.status == process.env.chargePointStatusEVIOFaulted || foundCharger.status == process.env.chargePointStatusEVIOUnavailable) {
                                let response = {
                                    result : 'REJECTED',
                                    timeout : Number(process.env.defaultChargerTimeout),
                                    message : [{"language": "en","text": 'The requested charging station is currently offline.'}]
                                }
                                return res.status(200).send(Utils.response(response, 1000, "Success"));
                            } else {
                                //TODO Send Remote Start Transaction
                                remoteStart(foundCharger.hwId , plugId , response_url , platform.cpo , cpoCountryCode , platform.platformCode , token, authorization_reference , location_id , evse_uid , connector_id , foundCharger.operatorId)
                                let response = {
                                    result : 'ACCEPTED',
                                    timeout : Number(process.env.defaultChargerTimeout),
                                    message : []
                                }
                                return res.status(200).send(Utils.response(response, 1000, "Success"));
                            }
                        } else {
                            let response = {
                                result : 'REJECTED',
                                timeout : Number(process.env.defaultChargerTimeout),
                                message : [{"language": "en","text": 'The requested EVSE UID does not exist in the location.'}]
                            }
                            return res.status(200).send(Utils.response(response, 1000, "Success"));
                        }
                    } else {
                        let plugId = foundCharger.plugs[0].plugId
                        let evse_uid = `${location_id}-${plugId}`
                        let connector_id = `${evse_uid}-${plugId}`

                        if (foundCharger.status == process.env.chargePointStatusEVIOFaulted || foundCharger.status == process.env.chargePointStatusEVIOUnavailable) {
                            let response = {
                                result : 'REJECTED',
                                timeout : Number(process.env.defaultChargerTimeout),
                                message : [{"language": "en","text": 'The requested charging station is currently offline.'}]
                            }
                            return res.status(200).send(Utils.response(response, 1000, "Success"));
                        } else {
                            //TODO Send Remote Start Transaction
                            remoteStart(foundCharger.hwId , plugId , response_url , platform.cpo , cpoCountryCode , platform.platformCode , token, authorization_reference , location_id , evse_uid , connector_id , foundCharger.operatorId)
                            let response = {
                                result : 'ACCEPTED',
                                timeout : Number(process.env.defaultChargerTimeout),
                                message : []
                            }
                            return res.status(200).send(Utils.response(response, 1000, "Success"));
                        }
                    }
                }
            } else {
                return res.status(200).send(Utils.response(null, 3000, "Generic server error"));
            }
        } catch (e) {
            console.log("Generic client error. ", e);
            return res.status(200).send(Utils.response(null, 3000, "Generic server error"));
        }
    }
}

async function remoteStart(hwId , plugId , response_url , party_id , country_code , network , token, authorization_reference , location_id , evse_uid , connector_id , operatorId) {
    const context = "Function remoteStart"
    try {
        let host = process.env.HostOCPP16 + process.env.PathSendRemoteStartOCPI
        let data = {
            hwId,
            plugId,
            response_url,
            party_id,
            country_code,
            network,
            token,
            authorization_reference,
            location_id,
            evse_uid,
            connector_id,
            operatorId,
        }
        let response = await Utils.postRequest(host , data)
        if (response.success) {
            console.log("Success sending START_SESSION command")
        } else {
            console.log(`[${context}] Error - Failed sending START_SESSION command`)
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}
