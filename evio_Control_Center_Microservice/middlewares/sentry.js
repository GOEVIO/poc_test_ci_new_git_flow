const Sentry = require('@sentry/node');
const SentryProfIntegration = require('@sentry/profiling-node');
const Constants = require('../utils/constants.js');
const appData = require('../package.json');

module.exports = (app) => {
  Sentry.init({
    dsn: Constants.env.providers.sentry.dsn,
    release: `${appData.name}@${appData.version}`,
    environment: Constants.env.environment,
    integrations: [
      // enable HTTP calls tracing
      new Sentry.Integrations.Http({ tracing: true }),
      // enable Express.js middleware tracing
      new Sentry.Integrations.Express({ app }),
      new SentryProfIntegration.ProfilingIntegration(),
    ],
    // Performance Monitoring
    tracesSampleRate: Constants.env.providers.sentry.traceSampleRate,
    // Set sampling rate for profiling - this is relative to tracesSampleRate
    profilesSampleRate: Constants.env.providers.sentry.profilesSampleRate,
  });

  // The request handler must be the first middleware on the app
  app.use(Sentry.Handlers.requestHandler());

  // TracingHandler creates a trace for every incoming request
  app.use(Sentry.Handlers.tracingHandler());
};
