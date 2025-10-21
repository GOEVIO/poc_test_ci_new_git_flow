var Versions = require('../../../models/evio_versions');
const Utils = require('../../../utils');
module.exports = {
    handle: function (req, res) {
        Versions.find({}, { _id: 0 }, (err, versions) => {
            if (err) {
                console.error(`[${context}][find] Error `, err);
                return res.status(200).send(Utils.response(null, 2001, "Generic server error"));
            }
            else {
                return res.status(200).send(Utils.response(versions, 1000, "Success"));
            };
        });
    }
}
