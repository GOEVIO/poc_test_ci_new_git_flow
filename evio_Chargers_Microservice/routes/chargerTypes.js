const express = require('express');
const router = express.Router();
var ChargerType = require('../models/chargerTypes');
var queryToMongo = require('query-to-mongo');
require("dotenv-safe").load();

//========== POST ==========
//Create Charger type
router.post('/api/private/chargerTypes', (req, res, next) => {
    var context = "POST /api/private/chargerTypes";
    try {

        const chargerType = new ChargerType(req.body);
        var createUser = req.headers['userid'];
        chargerType.createUser = createUser;

        ChargerType.createChargerType(chargerType, (err, result) => {
            if (err) {
                console.error(`[${context}][createChargerType] Error `, err.message);
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
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== GET ==========
//Get all Chargers Types
router.get('/api/private/chargerTypes', (req, res, next) => {
    var context = "GET /api/private/chargerTypes";
    try {
        const filter = {};
        if (req.query) {
            filter.query = req.query;
        };

        ChargerType.find(req.query, (err, chargerTypes) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (typeof chargerTypes === 'undefined' || chargerTypes.length <= 0)
                    return res.status(400).send({ auth: true, code: 'server_charger_not_found', message: "Charger not found for given parameters" });
                else {
                    const newChargerTypes = chargerTypes.map(ct => ({
                        ...ct._doc,
                        host: ct.host.replace('evio_', '').replace('_microservice', '').replaceAll('_', '-')
                    }));
                    console.log({ chargerTypes : newChargerTypes });
                    return res.status(200).send({ chargerTypes : newChargerTypes });
                }
            };
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get hosts and paths for connection station
router.get('/api/private/chargerTypes/read', (req, res, next) => {
    var context = "GET /api/private/chargerTypes/read";
    try {
        var query = queryToMongo(req.body);
        var fields = {
            host: 1,
            path: 1
        };

        ChargerType.find(query.criteria, fields, (err, chargerTypes) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (typeof chargerTypes === 'undefined' || chargerTypes.length <= 0)
                    return res.status(200).send([]);
                else {
                    const newChargerTypes = chargerTypes.map(ct => ({
                        ...ct._doc,
                        host: ct.host.replace('evio_', '').replace('_microservice', '').replaceAll('_', '-')
                    }));
                    return res.status(200).send({ chargerTypes : newChargerTypes });
                };
            };
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get hosts and paths for chargers favorites
router.get('/api/private/chargerTypes/favorites', (req, res, next) => {
    var context = "GET /api/private/chargerTypes/favorites";
    try {
        var query = req.body;
        var fields = {
            host: 1,
            path: 1,
            chargerType: 1
        };
        ChargerType.find(query, fields, (err, chargerTypes) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (typeof chargerTypes === 'undefined' || chargerTypes.length <= 0)
                    return res.status(400).send({ auth: true, code: 'server_charger_not_found', message: "Charger not found for given parameters" });
                else {
                    const newChargerTypes = chargerTypes.map(ct => ({
                        ...ct._doc,
                        host: ct.host.replace('evio_', '').replace('_microservice', '').replaceAll('_', '-')
                    }));
                    return res.status(200).send({ chargerTypes : newChargerTypes });
                };
            };
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

module.exports = router;