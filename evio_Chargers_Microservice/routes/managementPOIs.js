const express = require('express');
const router = express.Router();
var ManagementPOIs = require('../models/managementPOIs');
var Charger = require('../models/charger');
const fs = require('fs')
const request = require('request')
const axios = require('axios');
require("dotenv-safe").load();

//========== POST ==========
//
router.post('/api/private/managementPOIs', (req, res, next) => {
    var context = "POST /api/private/managementPOIs";
    try {

        const managementPOIs = new ManagementPOIs(req.body);

        managementPOIsCreate(managementPOIs)
            .then((result) => {
                if (result) {
                    return res.status(200).send(result);
                }
                else {
                    return res.status(200).send({ auth: false, code: 'server_POIs_not_created', message: "POIs not created" });
                };
            })
            .catch((error) => {
                console.error(`[${context}][managementPOIsCreate] Error `, error.message);
                return res.status(500).send(error.message);
            });


    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== GET ==========
router.get('/api/private/managementPOIs', (req, res, next) => {
    var context = "GET /api/private/managementPOIs";
    try {
        var query = req.query;
        managementPOIsFind(query)
            .then((poisFound) => {
                return res.status(200).send(poisFound);
            })
            .catch((error) => {
                console.error(`[${context}][managementPOIsFind] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== PATCH ==========
router.patch('/api/private/managementPOIs', (req, res, next) => {
    var context = "PATCH /api/private/managementPOIs";
    try {

        var received = req.body;

        var query = {
            _id: received._id
        };

        var newValues = { $set: received };

        managementPOIsUpdate(query, newValues)
            .then((result) => {
                if (result) {
                    return res.status(200).send({ auth: true, code: 'server_update_successfully', message: "Update successfully" });
                }
                else {
                    return res.status(200).send({ auth: true, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                };
            })
            .catch((error) => {
                console.error(`[${context}][managementPOIsUpdate] Error `, error.message);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== PUT ==========
//Call first one time to change chargerId to hwId
router.put('/api/private/managementPOIs', (req, res, next) => {
    var context = "PUT /api/private/managementPOIs";
    try {

        managementPOIsFind({})
            .then(async (poisFound) => {

                let configManagementPOIs = await getConfigManagementPOIs();

                if (poisFound.length > 0) {

                    Promise.all(
                        poisFound.map(pois => {
                            return new Promise((resolve, reject) => {

                                var query = {
                                    _id: pois.chargerId
                                };

                                var fields = {
                                    hwId: 1
                                };

                                var newPOIs;

                                if (pois.POIs == null) {

                                    pois.POIs = [];
                                    newPOIs = [];

                                };

                                if (pois.POIs.length > 0) {

                                    newPOIs = pois.POIs.splice(0, configManagementPOIs.numberOfPois);

                                };

                                Charger.findOne(query, fields, (err, chargerFound) => {

                                    if (err) {

                                        console.error(`[${context}][Charger.findOne] Error `, err.message);
                                        reject(err);

                                    }
                                    else {

                                        if (chargerFound) {

                                            var newValues = { $set: { hwId: chargerFound.hwId, POIs: newPOIs } };
                                            var query = { _id: pois._id };

                                            managementPOIsUpdate(query, newValues)
                                                .then((result) => {

                                                    resolve(true);

                                                })
                                                .catch((error) => {

                                                    console.error(`[${context}][managementPOIsUpdate] Error `, error.message);
                                                    reject(error);

                                                });
                                        }
                                        else {

                                            var query = { _id: pois._id };

                                            ManagementPOIs.removeManagementPOIs(query, (err, result) => {

                                                if (err) {

                                                    console.error(`[${context}][removeManagementPOIs] Error `, err.message);
                                                    reject(err);

                                                }
                                                else {

                                                    resolve(false);

                                                };

                                            });

                                        };
                                    };

                                });
                            });
                        })
                    ).then((result) => {

                        return res.status(200).send("Updated");


                    }).catch((error) => {

                        console.error(`[${context}] Error `, error.message);
                        return res.status(500).send(error.message);

                    });

                }
                else {

                    return res.status(400).send("Don't have POI's");

                };

            })
            .catch((error) => {

                console.error(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);

            });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };
});

//========== FUNCTION ==========
function managementPOIsCreate(managementPOIs) {
    var context = "Function managementPOIsCreate";
    return new Promise((resolve, reject) => {
        ManagementPOIs.createManagementPOIs(managementPOIs, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err.message);
            }
            else {
                resolve(result);
            };
        });
    });
};

function managementPOIsUpdate(query, values) {
    var context = "Function managementPOIsUpdate";
    return new Promise((resolve, reject) => {
        ManagementPOIs.updateManagementPOIs(query, values, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function managementPOIsFindOne(query) {
    var context = "Function managementPOIsFindOne";
    return new Promise((resolve, reject) => {
        ManagementPOIs.findOne(query, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function managementPOIsFind(query) {
    var context = "Function managementPOIsFind";
    return new Promise((resolve, reject) => {
        ManagementPOIs.find(query, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function getPOIsGoogle(host) {
    var context = "Function getPOIsGoogle";
    return new Promise((resolve, reject) => {
        axios.get(host)
            .then((result) => {
                if (result.data.results.length === 0) {
                    resolve([]);
                }
                else {
                    savePhotosPOIs(result.data.results)
                        .then((result) => {
                            resolve(result);
                        })
                        .catch((error) => {
                            console.error(`[${context}][savePhotosPOIs][.catch] Error `, error.message);
                            reject(error);
                        })
                };
            })
            .catch((error) => {
                console.error(`[${context}][axios.get][.catch] Error `, error.message);
                reject(error);
            });
    });
};

function savePhotosPOIs(POIs) {
    var context = "Function savePhotosPOIs";
    return new Promise((resolve, reject) => {
        Promise.all(
            POIs.map(POI => {
                return new Promise(async (resolve, reject) => {

                    if (POI.photos != undefined) {

                        if (POI.photos.length !== 0) {
                            var photo = POI.photos[0];
                            if (process.env.NODE_ENV === 'production') {
                                var url = process.env.HostGooglePhotos + '?maxwidth=' + photo.width + '&photoreference=' + photo.photo_reference + '&key=' + process.env.GoogleKeyProd;
                            }
                            else {
                                var url = process.env.HostGooglePhotos + '?maxwidth=' + photo.width + '&photoreference=' + photo.photo_reference + '&key=' + process.env.GoogleKeyQA;
                            };
                            if (POI.id != undefined) {
                                var path = '/usr/src/app/img/google/' + POI.id + '.jpg';
                            }
                            else {
                                var path = '/usr/src/app/img/google/' + POI.place_id + '.jpg';
                            };


                            var pathImage = "";
                            if (process.env.NODE_ENV === 'production') {
                                if (POI.id != undefined) {
                                    pathImage = process.env.HostProd + 'google/' + POI.id + '.jpg'; // For PROD server
                                }
                                else {
                                    pathImage = process.env.HostProd + 'google/' + POI.place_id + '.jpg'; // For PROD server
                                };
                            }
                            else if (process.env.NODE_ENV === 'pre-production') {
                                if (POI.id != undefined) {
                                    pathImage = process.env.HostPreProd + 'google/' + POI.id + '.jpg'; // For PROD server
                                }
                                else {
                                    pathImage = process.env.HostPreProd + 'google/' + POI.place_id + '.jpg'; // For PROD server
                                };
                            }
                            else {
                                if (POI.id != undefined) {
                                    //pathImage = process.env.HostLocal  + 'goole/' + POI.id + '.jpg';
                                    pathImage = process.env.HostQA + 'google/' + POI.id + '.jpg'; // For QA server
                                }
                                else {
                                    //pathImage = process.env.HostLocal  + 'goole/' + POI.id + '.jpg';
                                    pathImage = process.env.HostQA + 'google/' + POI.place_id + '.jpg'; // For QA server
                                };
                            };

                            download(url, path, () => {
                                POI.photos = pathImage;
                                resolve(true);
                            });

                        }
                        else {
                            POI.photos = '';
                            resolve(true);
                        };

                    }
                    else {
                        POI.photos = '';
                        resolve(true);
                    };

                });
            })
        ).then(() => {
            resolve(POIs);
        }).catch((error) => {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        });
    });
};

//Function to save image in file
const download = (url, path, callback) => {
    if (fs.existsSync(path)) { return callback(); }
    request.head(url, (err, res, body) => {
        request(url)
            .pipe(fs.createWriteStream(path))
            .on('close', callback);
    });
};

function getConfigManagementPOIs() {
    var context = "Function getConfigManagementPOIs";
    return new Promise((resolve, reject) => {

        var host = process.env.HostConfigs + process.env.PathConfigManagementPOIs;
        axios.get(host)
            .then((result) => {

                if (result.data.length > 0) {

                    resolve(result.data[0]);

                }
                else {

                    var configManagementPOIs = {
                        daysToUpdate: 365,
                        numberOfPois: 7
                    };

                    resolve(configManagementPOIs);

                };

            })
            .catch((error) => {

                console.error(`[${context}] Error `, error.message);
                reject(error);

            });

    });
};


module.exports = router;
