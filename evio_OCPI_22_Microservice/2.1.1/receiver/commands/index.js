const express = require('express');
const router = express.Router({mergeParams:true});
var handlerSession = require('./handlerCommandResult');

// router.post('/', (req, res) => {
//     handlerSession.startSession(req, res);
// });

// router.post('/:sessionId', (req, res) => {
//     handlerSession.startSession(req, res);
// });

// router.post('/:country_code/:party_id/:sessionId', (req, res) => {
//     handlerSession.startSession(req, res);
// });

router.post('/START_SESSION/:authorization_reference', handleRemoteFunctionStart, (req, res) => {
    req?.useNewApproachStartSession ? new CommandResultSession(req, res).handleCommandResult() : handlerSession.commandResultStartSession(req, res);
});

router.post('/STOP_SESSION/:authorization_reference', (req, res) => {
    handlerSession.commandResultStopSession(req, res);
});

router.post('/UNLOCK_CONNECTOR/:authorization_reference', (req, res) => {
    handlerSession.commandResultUnlockConnector(req, res);
});

module.exports = router;