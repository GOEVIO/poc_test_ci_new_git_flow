const Sentry = require('@sentry/node');

const Constants = require('../utils/constants');

const registerMetric = (metricName, value, unit) => {
  const context = 'Function registerMetric';
  try {
    Sentry.metrics.distribution(metricName, value, {
      unit,
      tags: { environment: Constants.environment }
    });
  } catch (error) {
    Sentry.captureException(error);
    console.log(`[${context}] Error `, error.message);
  }
};

module.exports = {
  registerMetric
};
