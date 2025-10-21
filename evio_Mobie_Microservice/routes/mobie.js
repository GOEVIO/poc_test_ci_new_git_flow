const express = require('express');
const router = express.Router();
require("dotenv-safe").load();
const bodyParser = require('body-parser');
const Utils = require("../entities/Utils");
const basicAuth = require('express-basic-auth');
const axios = require("axios");

router.use(bodyParser.json());

function getUnauthorizedResponse(req) {
    return req.auth
        ? ('Credentials ' + req.auth.user + ':' + req.auth.password + ' rejected')
        : 'No credentials provided'
}

var publicNetworkHost = 'http://public-network:3029';
const publicNetworkMobie = `${publicNetworkHost}/api/private/mobie`;
const publicNetworkFavorites = `${publicNetworkHost}/api/private/favorites`;
const publicNetworkSearchByName = `${publicNetworkHost}/api/private/searchByName`;


//Obsoleto
router.get('/api/private/mobie', (req, res, next) => {
    var context = "GET /api/private/mobie";
    try {

        axios.get(publicNetworkMobie, { params: req.query })
            .then((chargersFound) => {
                return res.status(200).send(chargersFound.data);
            })
            .catch((error) => {
                console.error(`[${context}][.then][find] Error`, error);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.log(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };

});

//Obsoleto
router.get('/api/private/favorites', (req, res, next) => {
    var context = "GET /api/private/favorites";
    try {

        var data = req.body;

        axios.get(publicNetworkFavorites, { data })
            .then((chargersFound) => {
                return res.status(200).send(chargersFound.data);
            })
            .catch((error) => {
                console.error(`[${context}][.then][find] Error`, error);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.log(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
});

//Obsoleto
router.get('/api/private/searchByName', (req, res, next) => {
    var context = "GET /api/private/searchByName";
    try {

        axios.get(publicNetworkSearchByName, { params: req.query })
            .then((chargersFound) => {
                return res.status(200).send(chargersFound.data);
            })
            .catch((error) => {
                console.error(`[${context}][.then][find] Error`, error);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
});

//Usado para mobie invocar qualquer evento sobre os EVSEs/Connectors
router.post('/api/public/mobie',
    basicAuth({
        users: { 'mobie': process.env.BASIC_AUTH_PASSWORD },
        unauthorizedResponse: getUnauthorizedResponse
    }),
    (req, res, next) => {

        var usage = req.body;

        if (usage.data) {

            switch (usage.data.attributes.event) {

                case 'usage.started':
                    console.log("Usage started");
                    Utils.handleUsageStarted(usage);
                    res.status(200).send('OK');
                    break;

                case 'usage.stopped':
                    console.log("Usage stopped");
                    Utils.handleUsageStopped(usage);
                    res.status(200).send('OK');
                    break;

                case 'usage.processed':
                    console.log("Usage processed");
                    Utils.handleUsageProcessed(usage);
                    res.status(200).send('OK');
                    break;

                case 'usage.validated':
                    console.log("Usage validated");
                    Utils.handleUsageValidated(usage);
                    res.status(200).send('OK');
                    break;

                case 'asset.updated':
                    console.log("Asset updated");
                    Utils.handleAssetUpdated(usage);
                    res.status(200).send('OK');
                    break;

                default:
                    console.log("Failed");
                    Utils.createFailedMobieEvent(usage);
                    res.status(401).send('Not Modified');
            }

        } else {
            console.log("Failed");
            Utils.createFailedMobieEvent(usage);
            res.status(401).send('Not Modified');
        }

    });


module.exports = router;