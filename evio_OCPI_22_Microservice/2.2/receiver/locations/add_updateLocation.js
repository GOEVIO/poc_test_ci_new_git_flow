
const Utils = require('../../../utils');
const global = require('../../../global');
const axios = require('axios');
const { bulkWriteChargers } = require('evio-library-chargers/dist').default;
const { upsertLocationsData, mapBulkForLocationUpdate } = require('../../../services/locations/locationsService');


module.exports = {
    put: function (req, res) {
        //Get Token, sent previously to partner
        const token = req.headers.authorization.split(' ')[1];

        //Validate if sent data is valid JSON to process
        const data = req.body;
        if (Utils.isEmptyObject(data))
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));

        const ocpiVersion = req.params.version

        try {
            Utils.getPlatformInfo(token , ocpiVersion).then(async (platform) => {
                const source = platform.source;
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
    },
    patch: function (req, res) {
        //Get Token, sent previously to partner
        const token = req.headers.authorization.split(' ')[1];

        const locationId = req.params.locationId;

        //Validate if sent data is valid JSON to process
        const data = req.body;
        if (Utils.isEmptyObject(data))
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));

            const ocpiVersion = req.params.version

        try {
            Utils.getPlatformInfo(token , ocpiVersion).then((platform) => {
                const source = platform.source;

                let evses = data.evses
                if (evses?.length > 0) {
                    Promise.all(
                        evses.map(evse => {
                            return new Promise((resolve, reject) => {
                                data.source = source
                                data.subStatus = evse.status;
                                data.status = Utils.getMapping(evse.status, 'plugStatus');
                                axios.patch(global.publicNetworkUpdatePlugStatusProxy + '/' + locationId + '/' + evse.uid, data, {})
                                .then(function (response) {

                                    if (typeof response.data !== 'undefined') {
                                        resolve(true)
                                    }
                                    else {
                                        resolve(true)
                                    }
                                }).catch(function (e) {
                                    if (e.response !== undefined && e.response !== null) {
                                        if (e.response.data !== undefined && e.response.data !== null) {
                                            console.log("[addUpdateLocation.patch.axios.patch] Generic client error " , e.response.data);
                                        }
                                    } else {
                                        console.log("[addUpdateLocation.patch.axios.patch] Generic client error " , e.message);
                                    }
                                    reject(e)
                                });
                            })
                        })
                    ).then((chargers) => {
                        return res.status(200).send(Utils.response(null, 1000, "Success"));
                    }).catch((error) => {
                        if (error.response !== undefined && error.response !== null) {
                            if (error.response.data !== undefined && error.response.data !== null) {
                                console.log("[addUpdateLocation.patch.promise.all] Generic client error " , error.response.data);
                            }
                        } else {
                            console.log("[addUpdateLocation.patch.promise.all] Generic client error " , error.message);
                        }
                        return res.status(200).send(Utils.response(null, 2000, "Generic client error "));
                    });
                } else {
                    console.log("[!!] No EVSES sent. We need to patch the location values")
                    return res.status(200).send(Utils.response(null, 1000, "Success"));
                }
            }).catch((e) => {
                if (e.response !== undefined && e.response !== null) {
                    if (e.response.data !== undefined && e.response.data !== null) {
                        console.log("[addUpdateLocation.patch.getPlatformInfo] Generic client error " , e.response.data);
                    }
                } else {
                    console.log("[addUpdateLocation.patch.getPlatformInfo] Generic client error " , e.message);
                }
                return res.status(200).send(Utils.response(null, 2000, "Generic client error "));
            });
        }
        catch (e) {
            if (e.response !== undefined && e.response !== null) {
                if (e.response.data !== undefined && e.response.data !== null) {
                    console.log("[addUpdateLocation.patch] Generic client error " , e.response.data);
                }
            } else {
                console.log("[addUpdateLocation.patch] Generic client error " , e.message);
            }
            return res.status(200).send(Utils.response(null, 2000, "Generic client error"));
        }
    }
}
