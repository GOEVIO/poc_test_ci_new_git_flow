const express = require('express');
const router = express.Router();
require("dotenv-safe").load();
const axios = require("axios");
const connectorType = require('../models/connectorType.json');
const TariffsOPC = require('../models/tariffsOPC');
const JsonFind = require('json-find');
const jsonFile = JsonFind(connectorType);
var https = require('https');

var publicNetworkHost = 'http://public-network:3029';
const publicNetworkOpenChargeMap = `${publicNetworkHost}/api/private/openChargeMap`;
const publicNetworkFavorites = `${publicNetworkHost}/api/private/favorites`;
const publicNetworkSearchByName = `${publicNetworkHost}/api/private/searchByName`;

//========== POST ==========
router.post('/api/private/openChargeMap', (req, res, next) => {
    var context = "POST /api/private/openChargeMap";
    try {
        const tariffsOPC = new TariffsOPC(req.body);
        TariffsOPC.createTariffsOPC(tariffsOPC, (err, result) => {
            if (err) {
                console.log(`[${context}][createTariffsOPC] Error `, err.message);
                return res.status(500).send(err);
            }
            else {
                if (result) {
                    return res.status(200).send(result);
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_tariffsOPC_not_created', message: "Tariff OPC not created" });
                };
            };
        });
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});


router.get('/api/private/openChargeMap', (req, res, next) => {
    var context = "GET /api/private/openChargeMap";
    try {

        axios.get(publicNetworkOpenChargeMap, { params: req.query })
            .then((chargersFound) => {
                return res.status(200).send(chargersFound.data);
            })
            .catch((error) => {
                console.error(`[${context}][.then][find] Error `, error.message);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };

});


router.get('/api/private/favorites', (req, res, next) => {
    var context = "GET /api/private/favorites";
    try {

        var data = req.body;

        axios.get(publicNetworkFavorites, { data })
            .then((chargersFound) => {
                return res.status(200).send(chargersFound.data);
            })
            .catch((error) => {
                console.error(`[${context}][.then][find] Error `, error.message);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});


router.get('/api/private/searchByName', (req, res, next) => {
    var context = "GET /api/private/searchByName";
    try {

        axios.get(publicNetworkSearchByName, { params: req.query })
            .then((chargersFound) => {
                return res.status(200).send(chargersFound.data);
            })
            .catch((error) => {
                console.error(`[${context}][.then][find] Error `, error.message);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});


//Get chargers from open charge map - when not login
router.get('/api/public/openChargeMap', (req, res, next) => {
    var context = "GET /api/public/openChargeMap";
    try {
        //TODO
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

module.exports = router;