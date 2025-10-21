const { StatusCodes } = require('http-status-codes');
const userFinancialDataService = require('../services/userFinancialDataService');
const { captureException } = require("@sentry/node");

const getUserFinancialData = async (req, res) => {
    const context = `Function getUserFinancialData`;
    try {
        const { userId } = req.query;
        const userFinancialData = await userFinancialDataService.getUserFinancialData(userId);

        res.status(StatusCodes.OK).json(userFinancialData);
    } catch (error) {
        console.error(`[${context}] Error`, error)
        captureException(error.message);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).send({ error: `${context} - An error occurred while processing` });
    }
};

module.exports = {
    getUserFinancialData,
};