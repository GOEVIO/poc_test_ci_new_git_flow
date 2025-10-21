const express = require('express');
const router = express.Router();
require("dotenv-safe").load();
const axios = require("axios");
const JsonFind = require('json-find');
const timeZone = require("../controllers/timeZoneHandler")

const connectorType = require('../models/MappingOCM.json');
const TariffsOPC = require('../models/tariffsOPC');
const jsonFile = JsonFind(connectorType);

const Charger = require('../models/charger');

//========== POST ==========
router.post('/api/private/updateOCMChargers', (req, res, next) => {
    var context = "POST /api/public/updateOCMChargers";
    console.log(`Call ${context} deprecated`);
    return res.status(308).send({ message: `End point ${context} deprecated` });
});

router.get('/api/private/openChargeMap', (req, res, next) => {
    var context = "GET /api/private/openChargeMap";
    try {

        var query = {
            source: 'OCM'
        };

        //var query = {};
        if (req.body) {
            Object.assign(query, req.body);
            Charger.find({
                'geometry': {
                    $near: {
                        $maxDistance: req.query.distance,
                        $geometry: {
                            type: "Point",
                            coordinates: [parseFloat(req.query.lng), parseFloat(req.query.lat)]
                        }
                    }
                }
            }).find(query, (error, chargersFound) => {
                if (error) {
                    console.error(`[${context}][.then][find] Error `, error.message);
                    return res.status(500).send(error.message);
                } else {
                    return res.status(200).send(chargersFound);
                }
            });

        } else {

            Charger.find({
                'geometry': {
                    $near: {
                        $maxDistance: req.query.distance,
                        $geometry: {
                            type: "Point",
                            coordinates: [parseFloat(req.query.lng), parseFloat(req.query.lat)]
                        }
                    }
                }
            }, (error, chargersFound) => {
                if (error) {
                    console.error(`[${context}][.then][find] Error `, error.message);
                    return res.status(500).send(error.message);
                } else {
                    return res.status(200).send(chargersFound);
                }
            });

        }

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };

});


const checkChargerId = ((charger) => {
    if (charger.DataProvidersReference != undefined) {
        return charger.DataProvidersReference;
    }
    else {
        let regex = new RegExp("^" + `[A-Z]{1,5}[-][0-9]{1,8}`, "i");
        let result = charger.AddressInfo.Title.match(regex);
        if (result != null) {
            return result[0];
        }
        else {
            return charger.UUID;
        }
    }
});

module.exports = router;