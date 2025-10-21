
const Utils = require('../../../utils');

module.exports = {
    post: async function (req, res) {

        // Get platform 
        let platform = req.headers.platform 

        //Validate if sent data is valid JSON to process
        let data = req.body;

        if (Utils.isEmptyObject(data)) {
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));
        }

        let cdrId = data.id;
        if (!cdrId) {
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing id parameters"));
        }

        try {
            let createdCdr = await Utils.processCDR(data , platform , false); 
            if (createdCdr) {
                let origin = req.protocol + '://' + req.get('host') + req.originalUrl;
                let response = { Location: origin + `/${cdrId}` };
                return res.status(200).send(Utils.response(response, 1000, "Created CDR " + cdrId + ""));
            } else {
                return res.status(200).send(Utils.response(null, 2000, "Generic client error "));
            }
        }
        catch (e) {
            console.log("Generic client error. ", e);
            return res.status(200).send(Utils.response(null, 2000, "Generic client error"));
        }


    }
}


