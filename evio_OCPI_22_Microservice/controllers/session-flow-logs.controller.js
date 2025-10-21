const { StatusCodes } = require('http-status-codes');
const { captureException } = require('@sentry/node');
const service = require('../services/session-flow-logs.service');

const getLogsByUserId = async (req, res) => {
  const context = 'Session Flow Logs: [Controller: getLogsByUserId]';
  try {
    const { userId } = req.query;
    const sessionLogData = await service.getLogsByUserId(userId);

    res.status(StatusCodes.OK).json(sessionLogData);
  } catch (error) {
    console.error(`[${context}] Error`, error);
    captureException(error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).send({ error: `${context} - An error occurred while processing` });
  }
};

module.exports = {
  getLogsByUserId
};
