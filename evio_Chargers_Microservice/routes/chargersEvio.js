const express = require('express');
const router = express.Router();
var ChargersEvio = require('../models/chargersEvio');
var QrCode = require('../models/qrCode');
require("dotenv-safe").load();

//========== POST ==========
//Post to create a new charger of EVIO
router.post('/api/private/chargersEvio', (req, res, next) => {
    var context = "POST /api/private/chargersEvio";
    try {
        const chargersEvio = new ChargersEvio(req.body);
        var createUser = req.headers['userid'];
        chargersEvio.createUser = createUser;
        chargersEvio.stationIdentifier = chargersEvio.hwId;
        validateFields(chargersEvio, res);
        var query = {
            hwId: chargersEvio.hwId
        };

        chargersEvioFindOne(query)
            .then((chargersEvioFound) => {
                if (chargersEvioFound) {
                    return res.status(400).send({ auth: false, code: 'server_charger_already_registered', message: "Charger is already registered" });
                }
                else {
                    addQrCodeId(chargersEvio)
                        .then((chargersEvio) => {
                            ChargersEvio.createChargersEvio(chargersEvio, (err, result) => {
                                if (err) {
                                    console.error(`[${context}][createChargersEvio] Error `, err.message);
                                    return res.status(500).send(err.message);
                                }
                                else {
                                    if (result) {
                                        return res.status(200).send(result);
                                    }
                                    else {
                                        return res.status(400).send({ auth: false, code: 'server_charger_not_created', message: "Charger not created" });
                                    };
                                };
                            });
                        })
                        .catch((error) => {
                            console.error(`[${context}][addQrCodeId] Error `, error.message);
                            return res.status(500).send(error.message);
                        });
                };
            })
            .catch((error) => {
                console.error(`[${context}][chargersEvioFindOne] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== GET ==========
//Get charger EVIO by HW_ID
router.get('/api/private/chargersEvio', (req, res, next) => {
    var context = "GET /api/private/chargersEvio";
    try {
        const filter = {};
        if (req.query) {
            filter.query = req.query;
        };

        ChargersEvio.find(filter.query, (err, result) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (result.length > 0) {
                    return res.status(200).send(result);
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_charger_not_found', message: "Charger not found for given parameters" });
                };
            };
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== PATCH ==========
router.patch('/api/private/chargersEvio/wifiPairingName', (req, res, next) => {
    var context = "PATCH /api/private/chargersEvio/wifiPairingName";
    try {
        var received = req.body;

        var query = {
            hwId: received.hwId
        };

        chargersEvioFindOne(query)
            .then((chargerEvioFound) => {
                if (chargerEvioFound) {
                    chargerEvioFound.wifiPairingName = received.wifiPairingName;
                    var newValues = { $set: chargerEvioFound };
                    chargerEvioUpdate(query, newValues)
                        .then((result) => {
                            if (result) {
                                return res.status(200).send({ auth: true, code: 'server_update_successfully', message: "Update successfully" });
                            }
                            else {
                                return res.status(400).send({ auth: false, code: "server_update_unsuccessfully", message: "Update unsuccessfully" });
                            };
                        })
                        .catch((error) => {
                            console.error(`[${context}] Error `, error.message);
                            return res.status(500).send(error.message);
                        });
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_charger_not_found', message: "Charger not found for given parameters" });
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

//========== FUNCTIONS ==========
//Function to validate fields received 
function validateFields(chargersEvio, res) {
    if (!chargersEvio)
        return res.status(400).send({ auth: false, code: 'server_chargersEvio_data_required', message: 'Charger evio data required' });
    //throw new Error('server_chargersEvio_data_required');

    if (!chargersEvio.hwId)
        return res.status(400).send({ auth: false, code: 'server_hwid_required', message: 'Charger Hardware Id is required' });
    //throw new Error('server_code_required');
};

function addQrCodeId(charger) {
    var context = "Function addQrCodeId";
    return new Promise(async (resolve, reject) => {
        try {
            Promise.all(
                charger.plugs.map(plug => {
                    return new Promise((resolve, reject) => {
                        var qrCode = new QrCode(
                            {
                                qrCode: {
                                    hwId: charger.hwId,
                                    plugId: plug.plugId,
                                    chargerType: charger.chargerType,
                                    chargingDistance: charger.chargingDistance,
                                    geometry: charger.geometry
                                }
                            }
                        );
                        saveQrCode(qrCode)
                            .then((result) => {
                                plug.qrCodeId = result.qrCodeId;
                                resolve(true)
                            })
                            .catch((error) => {
                                console.error(`[${context}] Error `, error.message);
                                reject(error);
                            })
                    });
                })
            ).then(() => {
                resolve(charger);
            });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function saveQrCode(qrCode) {
    var context = "Function saveQrCode";
    return new Promise(async (resolve, reject) => {
        try {
            QrCode.createQrCode(qrCode, (err, result) => {
                if (err) {
                    console.error(`[${context}] Error `, err.message);
                    reject(err);
                }
                else {
                    switch (result.qrCodeNumber.toString().length) {
                        case 1:
                            result.qrCodeId = "00000" + result.qrCodeNumber.toString();
                            break;
                        case 2:
                            result.qrCodeId = "0000" + result.qrCodeNumber.toString();
                            break;
                        case 3:
                            result.qrCodeId = "000" + result.qrCodeNumber.toString();
                            break;
                        case 4:
                            result.qrCodeId = "00" + result.qrCodeNumber.toString();
                            break;
                        case 5:
                            result.qrCodeId = "000" + result.qrCodeNumber.toString();
                            break;
                        default:
                            result.qrCodeId = result.qrCodeNumber.toString();
                            break;
                    };
                    var query = {
                        _id: result._id
                    };
                    var newValue = { $set: result };
                    QrCode.updateQrCode(query, newValue, (err, newUpdate) => {
                        if (err) {
                            console.error(`[${context}] Error `, err.message);
                            reject(err);
                        }
                        else {
                            resolve(result);
                        };
                    });
                };
            });

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function chargersEvioFindOne(query) {
    var context = "Function chargersEvioFindOne";
    return new Promise(async (resolve, reject) => {
        try {
            ChargersEvio.findOne(query, (err, result) => {
                if (err) {
                    console.error(`[${context}] Error `, err.message);
                    reject(err);
                }
                else {
                    resolve(result);
                };
            });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function chargerEvioUpdate(query, newValues) {
    var context = "Function chargerEvioUpdate";
    return new Promise(async (resolve, reject) => {
        try {
            ChargersEvio.updateChargersEvio(query, newValues, (err, result) => {
                if (err) {
                    console.error(`[${context}] Error `, err.message);
                    reject(err);
                }
                else {
                    resolve(result);
                };
            });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

module.exports = router;
