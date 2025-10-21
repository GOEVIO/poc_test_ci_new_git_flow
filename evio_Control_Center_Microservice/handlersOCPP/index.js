const express = require('express');
const router = express.Router({ mergeParams: true });
const commandResult = require('./commandResult');
const authorize = require('./authorize');
const sessions = require('./sessions');
const locations = require('./locations');


//////////////////////////////////////////////////////////// 
////////////////////   COMMAND RESULT  /////////////////////
////////////////////////////////////////////////////////////

router.post('/commands/START_SESSION', (req, res) => {
    commandResult.start.post(req, res);
});

router.post('/commands/STOP_SESSION', (req, res) => {
    commandResult.stop.post(req, res);
});

router.post('/commands/UNLOCK_CONNECTOR', (req, res) => {
    commandResult.unlock.post(req, res);
});

router.post('/commands/forceJobProcess', (req, res) => {
    commandResult.job.toOcpi(req, res);
});

//////////////////////////////////////////////////////////// 
///////////////////////   AUTHORIZE  ///////////////////////
////////////////////////////////////////////////////////////

router.post('/authorize', (req, res) => {
    authorize.token.post(req, res);
});


//////////////////////////////////////////////////////////// 
///////////////////////   SESSIONS  ////////////////////////
////////////////////////////////////////////////////////////

router.put('/session', (req, res) => {
    sessions.put.send(req, res);
});

router.patch('/session', (req, res) => {
    sessions.patch.send(req, res);
});

router.post('/session', (req, res) => {
    sessions.job.toOcpi(req, res);
});

//////////////////////////////////////////////////////////// 
//////////////////////   LOCATIONS  ////////////////////////
////////////////////////////////////////////////////////////


router.patch('/location', (req, res) => {
    locations.patch.send(req, res);
});



module.exports = router;

