const Sentry = require('@sentry/node');
const SessionFlowLog = require('../models/session-flow-logs.module');


async function getLogsByUserId(userId) {
  const context = 'Session Flow Logs: [Service: getLogsByUserId]';
  try {
    const query = { userId };
    const logsData = await SessionFlowLog.find(query).lean();
    return logsData || [];
  } catch (error) {
    console.error(`[${context}] Error`, error);
    Sentry.captureException(error);
    throw error;
  }
}

module.exports = {
  getLogsByUserId
};
