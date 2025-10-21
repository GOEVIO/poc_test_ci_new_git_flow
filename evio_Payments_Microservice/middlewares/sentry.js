const Sentry = require('@sentry/node');
const Constants = require('../utils/constants');
const appData = require('../package.json');

Sentry.init({
    dsn: Constants.providers.sentry.dsn,
    release: `${appData.name}@${appData.version}`,
    environment: Constants.environment,
    tracesSampleRate: Constants.providers.sentry.traceSampleRate,
    profilesSampleRate: Constants.providers.sentry.profilesSampleRate,
    enabled: Constants.environment !== 'development',
});

module.exports = (app) => {
    Sentry.setupExpressErrorHandler(app);
};
