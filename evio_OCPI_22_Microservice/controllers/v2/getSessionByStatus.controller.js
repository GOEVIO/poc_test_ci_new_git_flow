const { StatusCodes } = require('http-status-codes');
const { z } = require('zod');
const { captureException } = require('@sentry/node');
const { getSessionByStatusService } = require('../../services/v2/getSessionByStatus.service');
const validationInput = require('../../validations/getSessionByStatus/validation');


const getSessionByStatus = async (req, res) => {
    const context = `Function getSessionByStatus`;
    try {
        const requestData = validationInput(req);
        const response = await getSessionByStatusService(requestData);
        res.status(StatusCodes.OK).send(response);
    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error(`[${context}] Validation Error`, error.errors.map(error => error.message).join(', '));
            return res.status(StatusCodes.BAD_REQUEST).send({ error: error.errors.map(error => error.message).join(', ')});
        }
        console.error(`[${context}] Error`, error.message)
        captureException(error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).send({ error: `${context} - An error occurred while processing ${error}` });
    }
};

module.exports = {
    getSessionByStatus,
};