var VersionsDetails = require('../../../models/evio_versions_details');
const Utils = require('../../../utils');
const Tokens = require('../../../models/tokens');

module.exports = {
    getTokensList: function (req, res) {
        context = "Receiver Tokens - GET tokens list"
        //TODO Return tokens list for specific code platform
        //Get Token, sent previously to partner
        var token = req.headers.authorization.split(' ')[1];
        let ocpiVersion = req.params.version
        let limit = typeof req.query.limit !== "undefined" ? ( Number(req.query.limit) < 0 || Number(req.query.limit) > 100 ? 100 : Number(req.query.limit) ) : 100
        let offset = typeof req.query.offset !== "undefined" ? (Number(req.query.offset) >= 0 ? Number(req.query.offset) : 0) : 0
        let date_from = typeof req.query.date_from !== "undefined" ? req.query.date_from : ""
        let date_to = typeof req.query.date_to !== "undefined" ? req.query.date_to : ""

        try {
            Utils.getPlatformInfo(token , ocpiVersion).then((platform) => {
                let query= {
                    source: platform.platformCode,
                }
                if (date_from != "" && date_to != "") {
                    query = { 
                        source: platform.platformCode,
                        $and: [
                            { updatedAt: { $gte: date_from} },
                            { updatedAt: { $lte: date_to } }
                        ]
                    };
                } else if (date_from != "") {
                    query = { 
                        source: platform.platformCode,
                        updatedAt: { $gte: date_from }
                    };
                } else if (date_to != "") {
                    query = { 
                        source: platform.platformCode,
                        updatedAt: { $lte: date_to }
                    };
                }

                Tokens.find(query, { _id: 0, source: 0, evId : 0 , userId: 0 ,createdAt: 0, updatedAt: 0, __v: 0 }, {sort : {updatedAt : 1}}, (err, tokensList) => {
                    if (err) {
                        console.error(`[${context}][find] Error `, err);
                        return res.status(200).send(Utils.response(null, 2001, "Generic client error"));
                    }
                    else {
                        res.set("X-Total-Count" , tokensList.length)
                        if (offset + limit < tokensList.length) {
                            if (offset + limit + limit > tokensList.length) {
                                let link = `<https://${req.get('host')}${req.baseUrl}?offset=${offset+limit}&limit=${tokensList.length-(offset+limit)}${date_from != "" ? "&date_from=" + date_from : ""}${date_to != "" ? "&date_to=" + date_to : ""}>; rel="next"`
                                res.set("Link" , link)
                            } else {
                                let link = `<https://${req.get('host')}${req.baseUrl}?offset=${offset+limit}&limit=${limit}${date_from != "" ? "&date_from=" + date_from : ""}${date_to != "" ? "&date_to=" + date_to : ""}>; rel="next"`
                                res.set("Link" , link)
                            }
                            res.set("X-Limit" , limit)
                        } else {
                            limit = tokensList.length - offset >= 0 ?  tokensList.length - offset : 0
                            res.set("X-Limit" , limit)
                        }

                        let response = tokensList.slice(offset , offset + limit).map(token => Utils.getTokenModelObj(token))
                        return res.status(200).send(Utils.response(response, 1000, "Success"));
                    };

                });


            }).catch((e) => {
                console.log("[managementTokens.getTokensList.getPlatformInfo] Generic client error " + e.response.status + "- " + e.response.statusText);
                return res.status(200).send(Utils.response(null, 2000, "Generic client error " + e.response.status + " - " + e.response.statusText));
            });

        }
        catch (e) {
            console.log("[managementTokens.getTokensList] Generic client error. ", e);
            return res.status(200).send(Utils.response(null, 2000, "Generic client error"));
        }
    },
    realTimeAuthorization : function (req, res) {
        context = "Receiver realTimeAuthorization - POST Tokens"
       
        var token = req.headers.authorization.split(' ')[1];
        let ocpiVersion = req.params.version
        let token_uid = req.params.token_uid
        
        try {
            Utils.getPlatformInfo(token , ocpiVersion).then((platform) => {
                let query= {
                    source: platform.platformCode,
                    uid: token_uid, 
                    // valid: true 
                }
              

                Tokens.findOne(query, (err, token) => {
                    if (err) {
                        console.error(`[${context}][find] Error `, err);
                        return res.status(200).send(Utils.response(null, 2001, "Generic client error"));
                    }
                    else {
                        //TODO: Is this enough authorization? A valid and existing token?
                        if (token) {
                            if (token.valid) {
                                let authorization_reference = Utils.generateToken(24);
                                let response = {
                                    allowed : "ALLOWED",
                                    authorization_id : authorization_reference
                                }
                                return res.status(200).send(Utils.response(response, 1000, "Success"));
                            } else {
                                let response = {
                                    allowed : "BLOCKED"
                                }
                                return res.status(200).send(Utils.response(response, 1000, "Success"));
                            }
        
                        } else {
                            return res.status(404).send(Utils.response(null, 2000, "Token uid not found"));
                        }
                    };

                });


            }).catch((e) => {
                console.log("[managementTokens.realTimeAuthorization.getPlatformInfo] Generic client error " + e.response.status + "- " + e.response.statusText);
                return res.status(200).send(Utils.response(null, 2000, "Generic client error " + e.response.status + " - " + e.response.statusText));
            });

        }
        catch (e) {
            console.log("[managementTokens.realTimeAuthorization] Generic client error. ", e);
            return res.status(200).send(Utils.response(null, 2000, "Generic client error"));
        }
    }
}
