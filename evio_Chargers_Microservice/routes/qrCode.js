const express = require('express');
const router = express.Router();
var Charger = require('../models/charger');
const axios = require("axios");
var QrCode = require('../models/qrCode');
var ChargersEvio = require('../models/chargersEvio');
const { SSL_OP_SSLEAY_080_CLIENT_DH_BUG } = require('constants');
require("dotenv-safe").load();

//========== POST ==========
//Create Qr code ID
router.post('/api/private/qrCode', (req, res, next) => {
    var context = "POST /api/private/qrCode";
    try {
        var qrCode = new QrCode(req.body);
        saveQrCode(qrCode)
            .then((result) => {
                if (result) {
                    return res.status(200).send(result);
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_qrCoder_not_created', message: "QrCode not created" });
                };
            })
            .catch((error) => {
                console.error(`[${context}][saveQrCode] Error `, error.message);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== GET ==========
//Get Qr code ID validate if is free
router.get('/api/private/qrCode', (req, res, next) => {
    var context = "GET /api/private/qrCode";
    try {

        var qrCode = req.query;
        var query = {
            qrCodeId: qrCode.qrCodeId
        };

        qrCodeFindOnde(query)
            .then((qrCodeFound) => {
                if (qrCodeFound) {
                    if (qrCodeFound.qrCode.hwId === "") {
                        return res.status(200).send({ auth: true, code: 'server_qrCoder_valid', message: "QrCode valid" });
                    }
                    else {
                        return res.status(400).send({ auth: false, code: 'server_qrCoder_use', message: "QrCode in use" });
                    };
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_qrCoder_not_valid', message: "QrCode not valid" });
                };
            })
            .catch((error) => {
                console.error(`[${context}][qrCodeFindOnde] Error `, error.message);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== FUNCTION ==========
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
                            result.qrCodeId = "0" + result.qrCodeNumber.toString();
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

function qrCodeFindOnde(query) {
    var context = "Function qrCodeFindOnde";
    return new Promise((resolve, reject) => {
        QrCode.findOne(query, (err, qrCodeFound) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err);
            }
            else {
                resolve(qrCodeFound);
            };
        });
    });
};

module.exports = router;