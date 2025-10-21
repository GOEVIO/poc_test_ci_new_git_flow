const Utils = require('../../../utils');
module.exports = {
    get: async function (req, res) {
        context = "Receiver Sessions - GET Sessions list"

        //Get Token
        let platform = req.headers.platform

        let limit =  req.query.limit !== undefined && req.query.limit !== null ? ( Number(req.query.limit) < 0 || Number(req.query.limit) > 10 ? 10 : Number(req.query.limit) ) : 10
        let offset =  req.query.offset !== undefined && req.query.offset !== null ? (Number(req.query.offset) >= 0 ? Number(req.query.offset) : 0) : 0
        let date_from =  req.query.date_from !== undefined && req.query.date_from !== null ? req.query.date_from : ""
        let date_to =  req.query.date_to !== undefined && req.query.date_to !== null ? req.query.date_to : ""
        try {
            
            let cpoCountryCode = platform.cpoRoles.find( roleObj => roleObj.role === process.env.cpoRole).country_code
            let querySession = {
                network: platform.platformCode,
                country_code : cpoCountryCode,
                date_from,
                date_to,
                party_id : platform.cpo,
            }

            let foundSessions = await Utils.getSessionsOcpi(querySession)
            if (foundSessions) {
                res.set("X-Total-Count" , foundSessions.length)
                if (offset + limit < foundSessions.length) {
                    let responseUrl = req.baseUrl + req.path
                    if (offset + limit + limit > foundSessions.length) {
                        let link = `<https://${req.get('host')}${responseUrl}?offset=${offset+limit}&limit=${foundSessions.length-(offset+limit)}${date_from != "" ? "&date_from=" + date_from : ""}${date_to != "" ? "&date_to=" + date_to : ""}>; rel="next"`
                        res.set("Link" , link)
                    } else {
                        let link = `<https://${req.get('host')}${responseUrl}?offset=${offset+limit}&limit=${limit}${date_from != "" ? "&date_from=" + date_from : ""}${date_to != "" ? "&date_to=" + date_to : ""}>; rel="next"`
                        res.set("Link" , link)
                    }
                    res.set("X-Limit" , limit)
                } else {
                    limit = foundSessions.length - offset >= 0 ?  foundSessions.length - offset : 0
                    res.set("X-Limit" , limit)
                }
                let response = foundSessions.slice(offset , offset + limit).map((foundSession) => Utils.transformSessionObject(platform.platformCode , foundSession))
                return res.status(200).send(Utils.response(response, 1000, "Success"));

            } else {
                return res.status(200).send(Utils.response(null, 2000, "Generic client error "));
            }
            
        } catch (e) {
            console.log("Generic server error. ", e);
            return res.status(200).send(Utils.response(null, 3000, "Generic server error"));
        }
    }
};
