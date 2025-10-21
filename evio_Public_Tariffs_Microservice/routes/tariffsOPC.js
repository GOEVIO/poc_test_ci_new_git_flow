const express = require('express');
const router = express.Router();
const axios = require("axios");
var TariffsOPC = require('../models/tariffsOPC');
require("dotenv-safe").load();

//========== POST ==========
router.post('/api/private/tariffsOPC', (req, res, next) => {
    var context = "POST /api/private/tariffsOPC";
    try {

        var tariffsOPC = new TariffsOPC(req.body);

        TariffsOPC.createTariffsOPC(tariffsOPC, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                return res.status(200).send(result);
            };
        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== GET ==========
router.get('/api/private/tariffsOPC', (req, res, next) => {
    var context = "GET /api/private/tariffsOPC";
    try {

        var query = req.query;
        tariffsOPCFindOne(query)
            .then((result) => {
                return res.status(200).send(result);
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
function tariffsOPCFindOne(query) {
    var context = "Function tariffsOPCFindOne";
    return new Promise((resolve, reject) => {
        TariffsOPC.findOne(query, (err, result) => {
            if (err) {
                console.error(`[${context}][TariffsOPC.findOne] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function createOrUpdateTarrifs() {

    tarrifs.forEach(tarrif => {
        TariffsOPC.updateTariffsOPC({ station: tarrif.station }, { $set: tarrif }, (err, doc) => {
            if (doc != null) {
                console.log("Updated: " + tarrif.station);
            }
            else {
                const new_tarrif = new TariffsOPC(tarrif);
                TariffsOPC.createTariffsOPC(new_tarrif, (err, result) => {
                    if (result) {
                        console.log("Created: " + tarrif.station);
                    } else {
                        console.log("Not created");
                    }
                });
            }
        });
    });

}

module.exports = router;