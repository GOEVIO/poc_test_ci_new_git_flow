
const Utils = require('../../../utils');
const global = require('../../../global');
const axios = require('axios');
const CDR = require('../../../models/cdrs')
const Session = require('../../../models/sessions')


module.exports = {
    post: function (req, res) {
        //Get Token, sent previously to partner
        const token = req.headers.authorization.split(' ')[1];

        //Validate if sent data is valid JSON to process
        const data = req.body;

        if (Utils.isEmptyObject(data))
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));

        const cdrId = data.id;
        if (!cdrId)
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing id parameters"));

        const sessionId = data.session_id;

        try {
            let query = {
                "$or": [
                    { id: cdrId },
                    {session_id : sessionId}
                ]
            };

            CDR.find(query, { _id: 0 }, async (err, cdr) => {

                if (Utils.isEmptyObject(cdr)) {

                    let query = {
                        id : sessionId
                    }

                    let sessionExists = false
                    let cdrSession = sessionId ? await Utils.chargingSessionFindOne(query) : null
                    if (cdrSession) {
                        data.source = cdrSession.source !== undefined ? cdrSession.source : "MobiE"
                        sessionExists = cdrSession.id !== undefined && cdrSession.id !== null ? true : false
                    } else {
                        data.source = "MobiE"
                    }
                    console.log(`Add CDR with SessionId ${sessionId} from source ${data.source}`)

                    if (sessionExists) {
                        const new_cdr = new CDR(data);
                        CDR.create(new_cdr, (err, result) => {

                            if (result) {
                                const origin = req.protocol + '://' + req.get('host') + req.originalUrl;
                                const response = { Location: origin + cdrId };

                                Utils.processBillingAndPayment(sessionId, data);

                                return res.status(200).send(Utils.response(response, 1000, "Created CDR " + cdrId + ""));
                            } else {
                                console.log("CDR not created ", err);
                                return res.status(200).send(Utils.response(null, 2000, "Generic client error "));
                            }
                        })
                    } else {
                        console.log("CDR " + cdrId + ` not created - session with sessionId ${sessionId} does not exist yet`);
                        return res.status(200).send(Utils.response(null, 1000, "Corresponding session doesn't exist yet "));

                    }
                }
                else {
                    console.log("CDR not created - CDR already exists");
                    Utils.saveDifferentCdr(cdr, data)
                    return res.status(200).send(Utils.response(null, 2000, "Generic client error - CDR already exists"));
                }
            });
        }
        catch (e) {
            console.log("[addCDR.post] Generic client error. ", e);
            return res.status(200).send(Utils.response(null, 2000, "Generic client error"));
        }
    }
}
