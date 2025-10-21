const MobieEvent = require('../models/event');

const JsonFind = require('json-find');
const mappingMobie = require('../models/MappingMobie.json');
const jsonFile = JsonFind(mappingMobie);
const axios = require("axios");

var publicNetworkHost = 'http://public-network:3029';
const publicNetworkUpdateAsset = `${publicNetworkHost}/api/private/updateAsset`;

var Utils = {

    handleUsageStarted: function (request) {
        return new Promise((resolve, reject) => {

            if (request.data.attributes.status === "200") {

                var data = {
                    hwId: request.included[0].relationships.parentAsset.data.id,
                    uid: request.included[0].relationships.asset.data.id,
                    status: getMapping(request.included[0].relationships.service.data.id, 'plugStatus')
                }

                axios.post(publicNetworkUpdateAsset, { data })
                    .then((response) => {
                        resolve(response);
                    })
                    .catch((error) => {
                        console.log("Asset update failed");
                        reject(error);
                    });

            }

            createMobieEvent(request)
                .then(result => {
                    if (result) {
                        resolve(true);
                    }
                });

        })
    },
    handleUsageStopped: function (request) {
        return new Promise((resolve, reject) => {

            createMobieEvent(request)
                .then(result => {
                    if (result) {
                        resolve(true);
                    }
                })
        })
    },
    handleUsageProcessed: function (request) {
        return new Promise((resolve, reject) => {

            createMobieEvent(request)
                .then(result => {
                    if (result) {
                        resolve(true);
                    }
                })
        })
    },
    handleUsageValidated: function (request) {
        return new Promise((resolve, reject) => {

            createMobieEvent(request)
                .then(result => {
                    if (result) {
                        resolve(true);
                    }
                })
        })
    },
    handleAssetUpdated: function (request) {
        return new Promise((resolve, reject) => {

            if (request.included.length != 0) {

                if (checkChargerAsset(request.included[0].id)) {

                    if (request.data.attributes.status === "200") {

                        let data = {
                            hwId: request.included[0].id,
                            status: getMapping(request.included[0].attributes.status, 'plugStatusUpdated')
                        }

                        axios.post(publicNetworkUpdateAsset, { data })
                            .then((response) => {
                                resolve(response);
                            })
                            .catch((error) => {
                                console.log("Asset update failed");
                                reject(error);
                            });

                    }

                }
                else {

                    if (checkPlugAsset(request.included[0].id)) {

                        let regex = new RegExp("^" + `[A-Z]{1,5}[-][0-9]{1,8}`, "i");
                        let result = request.included[0].id.match(regex);
                        let hwId = null;

                        if (result != null) {
                            hwId = result[0];

                            if (request.data.attributes.status === "200") {

                                let data = {
                                    hwId: hwId,
                                    uid: request.included[0].id,
                                    status: getMapping(request.included[0].attributes.status, 'plugStatusUpdated')
                                }

                                axios.post(publicNetworkUpdateAsset, { data })
                                    .then((response) => {
                                        resolve(response);
                                    })
                                    .catch((error) => {
                                        console.log("Asset update failed");
                                        reject(error);
                                    });

                            }

                        }

                    }

                }

            }

            createMobieEvent(request)
                .then(result => {
                    if (result) {
                        resolve(true);
                    }
                });
        })
    },
    createFailedMobieEvent: function (request) {
        return new Promise((resolve, reject) => {

            var event = {
                event: request,
                eventType: "failed",
            }

            const mobieEvent = new MobieEvent(event);
            MobieEvent.createMobieEvent(mobieEvent, (err, result) => {
                if (result) {
                    resolve(true);
                }
            });

        })

    }

}

const createMobieEvent = (request) => {
    return new Promise((resolve, reject) => {

        var event = {
            event: request,
            eventType: request.data.attributes.event,
        }

        const mobieEvent = new MobieEvent(event);
        MobieEvent.createMobieEvent(mobieEvent, (err, result) => {
            if (result) {
                resolve(true);
            }
        })

    })
}

const getMapping = ((data, mapping_type) => {

    let mapping_list = jsonFile[mapping_type];

    var value = Object.keys(mapping_list).find(key => mapping_list[key] === data.toString());
    if (value === undefined) {
        value = Object.keys(mapping_list).find(key => mapping_list[key].includes(data.toString()));
        if (value === undefined)
            value = "unknown";
    };

    return value;

});

const checkPlugAsset = ((asset_id) => {

    let regex = new RegExp("^" + `[A-Z]{1,5}[-][0-9]{1,8}[-][0-9]{1,8}`, "i");
    let result = regex.test(asset_id);

    if (result) {
        return true;
    }
    return false;

});

const checkChargerAsset = ((asset_id) => {

    let regex = new RegExp("^" + `[A-Z]{1,5}[-][0-9]{1,8}$`, "i");
    let result = regex.test(asset_id);

    if (result) {
        return true;
    }
    return false;

});

module.exports = Utils;