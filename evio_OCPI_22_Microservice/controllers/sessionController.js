const { StatusCodes } = require('http-status-codes');
const sessionService = require('../services/sessionService');
const { captureException } = require("@sentry/node");

const getSessionByUserId = async (req, res) => {
    const context = `Function getSessionByUserId`;
    try {
        const { userId } = req.query;
        const sessionCdrData = await sessionService.getSessionByUserId(userId);

        res.status(StatusCodes.OK).json(sessionCdrData);
    } catch (error) {
        console.error(`[${context}] Error`, error)
        captureException(error.message);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).send({ error: `${context} - An error occurred while processing` });
    }
};

const getSessionByTransactionId = async (req, res) => {
    const context = `Function getSessionByTransactionId`;
    try {
        const { transactionId } = req.query;
        const sessionData = await sessionService.getSessionByTransactionId(transactionId);

        res.status(StatusCodes.OK).json(sessionData);
    } catch (error) {
        console.error(`[${context}] Error`, error)
        captureException(error.message);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).send({ error: `${context} - An error occurred while processing` });
    }
};

const getSessionById = async (req, res) => {
    const context = `Function getSessionById`;
    try {
        const { id } = req.query;
        const sessionData = await sessionService.getSessionById(id);

        res.status(StatusCodes.OK).json(sessionData);
    } catch (error) {
        console.error(`[${context}] Error`, error)
        captureException(error.message);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).send({ error: `${context} - An error occurred while processing` });
    }
};

module.exports = {
    getSessionByUserId,
    getSessionByTransactionId,
    getSessionById
};