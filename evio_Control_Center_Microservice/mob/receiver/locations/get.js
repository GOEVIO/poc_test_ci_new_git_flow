const Utils = require('../../../utils');
var User = require('../../../models/user');
module.exports = {
    get: function (req, res) {
        context = "Receiver Locations - GET Locations list"

        //Get Token
        let token = req.headers.authorization.split(' ')[1];
        let limit =  req.query.limit !== undefined && req.query.limit !== null ? ( Number(req.query.limit) < 0 || Number(req.query.limit) > 10 ? 10 : Number(req.query.limit) ) : 10
        let offset =  req.query.offset !== undefined && req.query.offset !== null ? (Number(req.query.offset) >= 0 ? Number(req.query.offset) : 0) : 0
        let date_from =  req.query.date_from !== undefined && req.query.date_from !== null ? req.query.date_from : ""
        let date_to =  req.query.date_to !== undefined && req.query.date_to !== null ? req.query.date_to : ""
        try {
            Utils.getPlatformInfo(token)
            .then(async (platform) => {
                let cpoCountryCode = platform.cpoRoles.find( roleObj => roleObj.role === process.env.cpoRole).country_code
                let queryCharger = {
                    network: platform.platformCode,
                    country_code : cpoCountryCode,
                    date_from,
                    date_to,
                    party_id : platform.cpo,
                }

                let foundChargers = await getChargers(queryCharger)
                if (foundChargers) {
                    res.set("X-Total-Count" , foundChargers.length)
                    if (offset + limit < foundChargers.length) {
                        let responseUrl = req.baseUrl + req.path
                        if (offset + limit + limit > foundChargers.length) {
                            let link = `<https://${req.get('host')}${responseUrl}?offset=${offset+limit}&limit=${foundChargers.length-(offset+limit)}${date_from != "" ? "&date_from=" + date_from : ""}${date_to != "" ? "&date_to=" + date_to : ""}>; rel="next"`
                            res.set("Link" , link)
                        } else {
                            let link = `<https://${req.get('host')}${responseUrl}?offset=${offset+limit}&limit=${limit}${date_from != "" ? "&date_from=" + date_from : ""}${date_to != "" ? "&date_to=" + date_to : ""}>; rel="next"`
                            res.set("Link" , link)
                        }
                        res.set("X-Limit" , limit)
                    } else {
                        limit = foundChargers.length - offset >= 0 ?  foundChargers.length - offset : 0
                        res.set("X-Limit" , limit)
                    }
                    let response = await Promise.all(foundChargers.slice(offset , offset + limit).map(async (foundCharger) => await Utils.transformLocationObject(platform.platformCode , foundCharger , cpoCountryCode , platform.cpo , platform , true)))
                    return res.status(200).send(Utils.response(response, 1000, "Success"));

                } else {
                    return res.status(200).send(Utils.response(null, 2000, "Generic client error "));
                }
            }).catch((e) => {
                console.log("Generic server error ", e);
                return res.status(200).send(Utils.response(null, 3000, "Generic server error"));
            });
        }
        catch (e) {
            console.log("Generic server error. ", e);
            return res.status(200).send(Utils.response(null, 3000, "Generic server error"));
        }
    },
    getLocation: function (req, res) {
        context = "Receiver Locations - GET Specific Locations"

        //Get Token
        let token = req.headers.authorization.split(' ')[1];
        let locationId = req.params.location_id
        let date_from =  req.query.date_from !== undefined && req.query.date_from !== null ? req.query.date_from : ""
        let date_to =  req.query.date_to !== undefined && req.query.date_to !== null ? req.query.date_to : ""
        try {
            Utils.getPlatformInfo(token)
            .then(async (platform) => {
                let cpoCountryCode = platform.cpoRoles.find( roleObj => roleObj.role === process.env.cpoRole).country_code
                let query = {
                    network: platform.platformCode,
                    party_id : platform.cpo,
                    country_code : cpoCountryCode,
                    locationId,
                    date_from,
                    date_to,
                }

                let foundCharger = await getSpecificCharger(query)
                if (foundCharger) {
                    if (Object.keys(foundCharger).length === 0) {
                        return res.status(200).send(Utils.response(null, 1000, "No Location was found for the given parameters"));
                    } else {
                        return res.status(200).send(Utils.response(await Utils.transformLocationObject(platform.platformCode , foundCharger , cpoCountryCode , platform.cpo , platform , true), 1000, "Success"));
                    }
                } else {
                    return res.status(200).send(Utils.response(null, 2000, "Generic client error "));
                }
            }).catch((e) => {
                console.log("Generic server error", e);
                return res.status(200).send(Utils.response(null, 3000, "Generic server error"));
            });
        }
        catch (e) {
            console.log("Generic server error. ", e);
            return res.status(200).send(Utils.response(null, 3000, "Generic server error"));
        }
    }
};

async function getChargers(query) {
    const context = "Function getChargers"
    try {
        let host = process.env.HostChargers + process.env.PathGetChargersToOcpi
        let resp = await Utils.getRequest(host , query)
        if (resp.success) {
            return resp.data
        } else {
            return null
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    }
}

async function getSpecificCharger(query) {
    const context = "Function getSpecificCharger"
    try {
        let host = process.env.HostChargers + process.env.PathGetChargersToOcpiSpecific
        let resp = await Utils.getRequest(host , query)
        if (resp.success) {
            return resp.data
        } else {
            return null
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    }
}