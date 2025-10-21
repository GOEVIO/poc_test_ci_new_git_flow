
const Utils = require('../../../utils');
const global = require('../../../global');
const axios = require('axios');
const { bulkWriteChargers } = require('evio-library-chargers/dist').default;
const { upsertLocationsData, mapBulkForLocationUpdate } = require('../../../services/locations/locationsService');

module.exports = {
    put: function (req, res) {

        //Get Token, sent previously to partner
        var token = req.headers.authorization.split(' ')[1];

        //Validate if sent data is valid JSON to process
        var data = req.body;
        console.log(data)
        if (Utils.isEmptyObject(data))
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));

        let ocpiVersion = req.params.version
        let country_code = req.params.country_code
        let party_id = req.params.party_id

        try {
            Utils.getPlatformInfo(token , ocpiVersion).then(async (platform) => {

                var source = platform.source;
                data.country_code = country_code
                data.party_id = party_id
                data.source = source
                const input = {
                    source,
                    mapping : await mapBulkForLocationUpdate([data], {source})
                }
                const updateOperation = await upsertLocationsData(data, input)
                await bulkWriteChargers([updateOperation]);
                return res.status(200).send(Utils.response(null, 1000, "Success"));

            }).catch((e) => {
                    console.log("[addUpdateLocation.put.getPlatformInfo] Generic client error " , e);
                    return res.status(200).send(Utils.response(null, 2000, "Generic client error "));
            });

        }
        catch (e) {
            console.log("[addUpdateLocation.put] Generic client error. ", e);
            return res.status(200).send(Utils.response(null, 2000, "Generic client error"));
        }


    }
}