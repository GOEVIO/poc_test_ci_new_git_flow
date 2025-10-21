const express = require('express');
const router = express.Router({ mergeParams: true });
const versions = require('./receiver/versions/get');
const details = require('./receiver/details/get');
const exchangeTokens = require('./receiver/credentials/exchangeTokens');
const newOCPIVersion = require('./receiver/credentials/updateCredentials');
const deteleCredentials = require('./receiver/credentials/deteleCredentials');
const locations = require('./receiver/locations/get');
const tariffs = require('./receiver/tariffs/get');
const cdrs = require('./receiver/cdrs/post');
const commandStart = require('./receiver/commands/startSession');
const commandStop = require('./receiver/commands/stopSession');
const commandUnlock = require('./receiver/commands/unlockConnector');
const sessions = require('./receiver/sessions/get');



//////////////////////////////////////////////////////////// 
///////////////////////   RECEIVER  ////////////////////////
////////////////////////////////////////////////////////////

router.get('/:cpo/versions', (req, res) => {
    versions.get(req, res);
});

router.get('/:cpo/versionsV2', (req, res) => {
    versions.get(req, res);
});

router.get('/:cpo/details', (req, res) => {
    details.get(req, res);
});

//////////////////////// CREDENTIALS //////////////////////////


router.post('/:cpo/credentials', (req, res) => {
    exchangeTokens.post(req, res);
});

router.put('/:cpo/credentials', (req, res) => {
    newOCPIVersion.put(req, res);
});

router.delete('/:cpo/credentials', (req, res) => {
    deteleCredentials.delete(req, res);
});

////////////////////////// LOCATIONS //////////////////////////

router.get('/:cpo/locations', (req, res) => {
    locations.get(req, res);
});

router.get('/:cpo/locations/:location_id', (req, res) => {
    locations.getLocation(req, res);
});


/////////////////////////// TARIFFS ///////////////////////////
router.get('/:cpo/tariffs', (req, res) => {
    tariffs.get(req, res);
});

router.get('/:cpo/tariffs/:tariff_id', (req, res) => {
    tariffs.getTariff(req, res);
});

//////////////////////////// CDRS /////////////////////////////

router.post('/:cpo/cdrs', (req, res) => {
    cdrs.post(req, res);
});


////////////////////////// COMMANDS ///////////////////////////

router.post('/:cpo/commands/START_SESSION', (req, res) => {
    commandStart.post(req, res);
});

router.post('/:cpo/commands/STOP_SESSION', (req, res) => {
    commandStop.post(req, res);
});

router.post('/:cpo/commands/UNLOCK_CONNECTOR', (req, res) => {
    commandUnlock.post(req, res);
});


////////////////////////// SESSIONS ///////////////////////////

router.get('/:cpo/sessions', (req, res) => {
    sessions.get(req, res);
});


module.exports = router;

