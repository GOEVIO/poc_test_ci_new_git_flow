var VersionsDetails = require('../../../models/evio_versions_details');
const Utils = require('../../../utils');
module.exports = {
    handle: function (req, res) {

        let ocpiVersion = req.params.version
        VersionsDetails.find({"version" : ocpiVersion}, { _id: 0 }, (err, details) => {
            
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
