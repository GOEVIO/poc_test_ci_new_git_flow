const Sentry = require("@sentry/node");
const { RemoteStartSession } = require('../services/remote-start.service');
const SendRejectResponse = require('../error/send-reject-response');

const remoteStart = async (req, res, wss, eventEmitter) => {
    try {
        const remoteStartSession = new RemoteStartSession(req, res, wss, eventEmitter);
        const result = await remoteStartSession.remoteStartSession();
        remoteStartSession.attemptToCommands();
        return res.status(200).send(result);
    } catch (error) {
        console.error('Error in /v2/ocpi/start:', error);
        if (error instanceof SendRejectResponse) {
            return res.status(error.status).send(error);
        }
        Sentry.captureException(error);
        return res.status(400).send(error);
    }
};

module.exports = {
    remoteStart
};