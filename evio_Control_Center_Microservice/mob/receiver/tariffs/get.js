const Utils = require('../../../utils');
const Tariff = require('../../../models/tariff');

module.exports = {
    get: function (req, res) {
        context = "Receiver Tariffs - GET Tariffs list"

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
                let query = {
                    source: platform.platformCode,
                    country_code : cpoCountryCode,
                    party_id : platform.cpo,
                    status : process.env.tariffStatusSent,
                }

                if (date_from != "" && date_to != "") {
                    query = { 
                        ...query,
                        $and: [
                            { updatedAt: { $gte: date_from} },
                            { updatedAt: { $lte: date_to } }
                        ]
                    };
                } else if (date_from != "") {
                    query = { 
                        ...query,
                        updatedAt: { $gte: date_from }
                    };
                } else if (date_to != "") {
                    query = { 
                        ...query,
                        updatedAt: { $lte: date_to }
                    };
                }

                let foundTariffs = await Tariff.find(query).lean()

                // console.log("req.baseUrl")
                // console.log(JSON.stringify(req.baseUrl))
                // console.log("req.originalUrl")
                // console.log(JSON.stringify(req.originalUrl))
                // console.log("req.path")
                // console.log(JSON.stringify(req.path))
                // console.log("req.url")
                // console.log(JSON.stringify(req.url))
                
                res.set("X-Total-Count" , foundTariffs.length)
                if (offset + limit < foundTariffs.length) {
                    let responseUrl = req.baseUrl + req.path
                    if (offset + limit + limit > foundTariffs.length) {
                        let link = `<https://${req.get('host')}${responseUrl}?offset=${offset+limit}&limit=${foundTariffs.length-(offset+limit)}${date_from != "" ? "&date_from=" + date_from : ""}${date_to != "" ? "&date_to=" + date_to : ""}>; rel="next"`
                        res.set("Link" , link)
                    } else {
                        let link = `<https://${req.get('host')}${responseUrl}?offset=${offset+limit}&limit=${limit}${date_from != "" ? "&date_from=" + date_from : ""}${date_to != "" ? "&date_to=" + date_to : ""}>; rel="next"`
                        res.set("Link" , link)
                    }
                    res.set("X-Limit" , limit)
                } else {
                    limit = foundTariffs.length - offset >= 0 ?  foundTariffs.length - offset : 0
                    res.set("X-Limit" , limit)
                }
                let response = foundTariffs.slice(offset , offset + limit).map( tariff =>  Utils.transformTariffObject(platform.platformCode , tariff))
                return res.status(200).send(Utils.response(response, 1000, "Success"));
            }).catch((e) => {
                console.log("Generic server error ", e);
                return res.status(200).send(Utils.response(null, 3000, "Generic server error "));
            });
        }
        catch (e) {
            console.log("Generic server error. ", e);
            return res.status(200).send(Utils.response(null, 3000, "Generic server error"));
        }
    },
    getTariff: function (req, res) {
        context = "Receiver Tariffs - GET Specific Tariff"

        //Get Token
        let token = req.headers.authorization.split(' ')[1];
        let date_from =  req.query.date_from !== undefined && req.query.date_from !== null ? req.query.date_from : ""
        let date_to =  req.query.date_to !== undefined && req.query.date_to !== null ? req.query.date_to : ""
        let tariffId = req.params.tariff_id
        try {
            Utils.getPlatformInfo(token)
            .then(async (platform) => {
                let cpoCountryCode = platform.cpoRoles.find( roleObj => roleObj.role === process.env.cpoRole).country_code
                let query = {
                    source: platform.platformCode,
                    country_code : cpoCountryCode,
                    party_id : platform.cpo,
                    status : process.env.tariffStatusSent,
                    id : tariffId
                }

                if (date_from != "" && date_to != "") {
                    query = { 
                        ...query,
                        $and: [
                            { updatedAt: { $gte: date_from} },
                            { updatedAt: { $lte: date_to } }
                        ]
                    };
                } else if (date_from != "") {
                    query = { 
                        ...query,
                        updatedAt: { $gte: date_from }
                    };
                } else if (date_to != "") {
                    query = { 
                        ...query,
                        updatedAt: { $lte: date_to }
                    };
                }

                let foundTariff = await Tariff.findOne(query).lean()
                let response = foundTariff ? Utils.transformTariffObject(platform.platformCode , foundTariff) : foundTariff
                return res.status(200).send(Utils.response(response, 1000, foundTariff ? "Success" : "No Tariff was found for the given parameters"));
            }).catch((e) => {
                console.log("Generic server error ", e);
                return res.status(200).send(Utils.response(null, 3000, "Generic server error "));
            });
        }
        catch (e) {
            console.log("Generic server error. ", e);
            return res.status(200).send(Utils.response(null, 3000, "Generic server error"));
        }
    }
};
