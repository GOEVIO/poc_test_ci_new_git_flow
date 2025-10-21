var Versions = require('../../../models/ocpiCredentialsVersions');
const Utils = require('../../../utils');
module.exports = {
    get: function (req, res) {

        var cpo = req.params.cpo;
        var platformId = req.params.platformId;
        let query = { cpo: cpo, platformId: platformId };

        Versions.find(query, { _id: 0, cpo: 0, platformId: 0 , __v : 0 }, (err, versions) => {
            if (err) {
                console.error(`[find] Error `, err);
                return res.status(200).send(Utils.response(null, 2001, "Generic server error"));
            }
            else {
                return res.status(200).send(Utils.response(versions, 1000, "Success"));
            };

        });
    }
};
