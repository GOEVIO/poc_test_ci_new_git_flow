const express = require('express');
const router = express.Router({mergeParams:true});
var remoteStartSession = require('./remoteStartSession');
var remoteStopSession = require('./remoteStopSession');
var unlockConnector = require('./unlockConnector');
const { RemoteStartSession } = require('../../../v2/services/remote-start.service');
const { handleRemoteFunctionStart } = require('../../../v2/middlewares/remote-start.middleware');
const SendRejectResponse = require('../../../v2/error/send-reject-response');
const Sentry = require("@sentry/node");

router.post('/ocpi/start', handleRemoteFunctionStart, async (req, res) => {
    try {
        let result;
        if(req?.useNewApproachStartSession){
            const remoteStartSessionV2 = new RemoteStartSession(req, res, '2.1.1');
            result = await remoteStartSessionV2.remoteStartSession();
            remoteStartSessionV2.attemptToCommands();
        }else{
            result = await remoteStartSession.post(req);
        }
        return res.status(200).send(result);
    } catch (error) {
        console.error('Error in /ocpi/start:', error);
        Sentry.captureException(error);
        if (error instanceof SendRejectResponse) {
            return res.status(error.status).send(error);
        }
        return res.status(400).send(error);
    }
});

router.post('/ocpi/stop', (req, res) => {
    remoteStopSession.post(req).then(result => {

        return res.status(200).send(result);

    }).catch((e) => {
        return res.status(400).send(e);
    });
});

router.post('/ocpi/unlock', (req, res) => {
    unlockConnector.post(req).then(result => {

        return res.status(200).send(result);

    }).catch((e) => {
        return res.status(400).send(e);
    });
});

module.exports = router;