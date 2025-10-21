const Sentry = require("@sentry/node");
const { RemoteStartSession } = require('../services/remote-start.service');
const SendRejectResponse = require('../error/send-reject-response');
const Utils = require('../../utils');

const remoteStart = async (req, res) => {
    try {
        const version = Utils.ocpiVersionByChargerType(req.body);
        const remoteStartSession = new RemoteStartSession(req, res, version);
        const result = await remoteStartSession.remoteStartSession();
        remoteStartSession.attemptToCommands();
        return res.status(200).send(result);
    } catch (error) {
        console.error('Error in /v2/ocpi/start:', error);
        Sentry.captureException(error);
        if (error instanceof SendRejectResponse) {
            return res.status(error.status).send(error);
        }
        return res.status(400).send(error);
    }
};

module.exports = {
    remoteStart
};