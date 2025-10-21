var VersionsDetails = require('../../../models/ocpiCredentialsDetails');
const Utils = require('../../../utils');
module.exports = {
    get: function (req, res) {

        let cpo = req.params.cpo
        let platformId = req.params.platformId
        let query = { cpo: cpo, platformId: platformId };
        console.log(query);
        VersionsDetails.find(query, { _id: 0, cpo: 0, platformId: 0 , __v : 0  ,"endpoints._id" : 0}, (err, details) => {
            console.log(details)
            if (err) {
                console.error(`[${context}][find] Error `, err);
                return res.status(200).send(Utils.response(null, 2001, "Generic server error"));
            }
            else {
                return res.status(200).send(Utils.response(details[0], 1000, "Success"));
            };

        });
    }
}
