const express = require('express');
const router = express.Router({mergeParams:true});
const handlerSession = require('./handlerCommandResult');
const {handleRemoteFunctionStart} = require('../../../v2/middlewares/remote-start.middleware');
const { CommandResultSession } = require('../../../v2/services/command-result.service')

router.post('/START_SESSION/:authorization_reference', handleRemoteFunctionStart, (req, res) => {
    console.log("CommandResult START_SESSION received " );
    req?.useNewApproachStartSession ? new CommandResultSession(req, res).handleCommandResult() : handlerSession.commandResultStartSession(req, res);
});

router.post('/STOP_SESSION/:authorization_reference', (req, res) => {
    handlerSession.commandResultStopSession(req, res);
});

router.post('/UNLOCK_CONNECTOR/:authorization_reference', (req, res) => {
    handlerSession.commandResultUnlockConnector(req, res);
});

module.exports = router;