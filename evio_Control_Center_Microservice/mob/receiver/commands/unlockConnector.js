
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

        let location_id = data.location_id;
        if (!location_id) {
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing id parameters"));
        }

        let evse_uid = data.evse_uid;
        if (!evse_uid) {
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing id parameters"));
        }

        let connector_id = data.connector_id;
        if (!connector_id) {
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing id parameters"));
        }
        

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
                    if (foundCharger.status == process.env.chargePointStatusEVIOFaulted || foundCharger.status == process.env.chargePointStatusEVIOUnavailable) {
                        let response = {
                            result : 'REJECTED',
                            timeout : Number(process.env.defaultChargerTimeout),
                            message : [{"language": "en","text": 'Impossible to perform the requested command as the charging station is offline.'}]
                        }
                        return res.status(200).send(Utils.response(response, 1000, "Success"));
                    } else {
                        // Send Unlock Connector
                        let plugId = evse_uid.split("-").pop()
                        let hwId = foundCharger.hwId
                        unlockConnector(hwId , plugId , response_url , platform.cpo , platform.platformCode , foundCharger.operatorId)

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
        } catch (e) {
            console.log("Generic client error. ", e);
            return res.status(200).send(Utils.response(null, 3000, "Generic server error"));
        }
    }
}


async function unlockConnector(hwId , plugId , response_url , party_id , network , operatorId) {
    const context = "Function unlockConnector"
    try {
        let host = process.env.HostOCPP16 + process.env.PathSendUnlockConnectorOCPI
        let data = {
            hwId,
            plugId,
            response_url,
            party_id,
            network,
            operatorId,
        }
        let response = await Utils.postRequest(host , data)
        if (response.success) {
            console.log("Success sending UNLOCK_CONNECTOR command")
        } else {
            console.log(`[${context}] Error - Failed sending UNLOCK_CONNECTOR command`)
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}