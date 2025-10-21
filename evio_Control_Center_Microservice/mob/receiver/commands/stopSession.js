
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
        let session_id = data.session_id;
        if (!session_id) {
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing id parameters"));
        }
        

        try {
            let cpoCountryCode = platform.cpoRoles.find( roleObj => roleObj.role === process.env.cpoRole).country_code

            let query = {
                network: platform.platformCode,
                party_id : platform.cpo,
                country_code : cpoCountryCode,
                ocpiId : session_id,
                date_from : "",
                date_to : "",
            }

            let foundSession = await Utils.getSpecificSession(query)

            if (foundSession) {
                if (Object.keys(foundSession).length === 0) {
                    let response = {
                        result : 'UNKNOWN_SESSION',
                        timeout : Number(process.env.defaultChargerTimeout),
                        message : []
                    }
                    return res.status(200).send(Utils.response(response, 1000, "Success"));
                } else {
                    if (
                        foundSession.status === process.env.SessionStatusRunning 
                        || foundSession.status === process.env.SessionStatusToStop 
                        || foundSession.status === process.env.SessionStatusInPause 
                    ) {
                        let foundCharger = await Utils.getChargerByHwId(foundSession.hwId)
                        if (foundCharger) {
                            if (Object.keys(foundCharger).length === 0) {
                                let response = {
                                    result : 'REJECTED',
                                    timeout : Number(process.env.defaultChargerTimeout),
                                    message : [{"language": "en","text": 'The requested session location does not exist.'}]
                                }
                                return res.status(200).send(Utils.response(response, 1000, "Success"));
                            } else {
                                if (foundCharger.status == process.env.chargePointStatusEVIOFaulted || foundCharger.status == process.env.chargePointStatusEVIOUnavailable) {
                                    let response = {
                                        result : 'REJECTED',
                                        timeout : Number(process.env.defaultChargerTimeout),
                                        message : [{"language": "en","text": 'The requested session is currently offline.'}]
                                    }
                                    return res.status(200).send(Utils.response(response, 1000, "Success"));
                                } else {
                                    //TODO Send Remote Stop Transaction
                                    remoteStop(foundSession.sessionId , foundSession.idTag , foundSession.hwId , foundSession.plugId , response_url , platform.cpo  , platform.platformCode , foundCharger.operatorId)
                                    let response = {
                                        result : 'ACCEPTED',
                                        timeout : Number(process.env.defaultChargerTimeout),
                                        message : []
                                    }
                                    return res.status(200).send(Utils.response(response, 1000, "Success"));
                                }
                            }
                        } else {
                            return res.status(200).send(Utils.response(null, 3000, "Generic server error"));
                        } 
                    } else {
                        let response = {
                            result : 'REJECTED',
                            timeout : Number(process.env.defaultChargerTimeout),
                            message : [{"language": "en","text": 'The requested session is no longer active.'}]
                        }
                        return res.status(200).send(Utils.response(response, 1000, "Success"));
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

async function remoteStop(sessionId , idTag , hwId , plugId , response_url , party_id  , network , operatorId) {
    const context = "Function remoteStop"
    try {
        let host = process.env.HostOCPP16 + process.env.PathSendRemoteStopOCPI
        let data = {
            sessionId,
            idTag,
            hwId,
            plugId,
            response_url,
            party_id,
            network,
            operatorId,
        }

        let response = await Utils.postRequest(host , data)
        if (response.success) {
            console.log("Success sending STOP_SESSION command")
        } else {
            console.log(`[${context}] Error - Failed sending STOP_SESSION command`)
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}