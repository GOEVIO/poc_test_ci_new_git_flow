import * as Sentry from '@sentry/node';
import * as SentryProfIntegration from '@sentry/profiling-node';
import Constants from '../utils/constants';
import * as appData from '../package.json';

export default (app) => {
    Sentry.init({
        dsn: Constants.providers.sentry.dsn,
        _experiments: {
            metricsAggregator: true,
        },
        release: `${appData.name}@${appData.version}`,
        environment: Constants.environment,
        integrations: [
            // enable HTTP calls tracing
            new Sentry.Integrations.Http({ tracing: true }),
            // enable Express.js middleware tracing
            new Sentry.Integrations.Express({ app }),
            new SentryProfIntegration.ProfilingIntegration(),
        ],
        // Performance Monitoring
        tracesSampleRate: Constants.providers.sentry.traceSampleRate,
        // Set sampling rate for profiling - this is relative to tracesSampleRate
        profilesSampleRate: Constants.providers.sentry.profilesSampleRate,
        ignoreTransactions: Constants.providers.sentry.ignoredTransactions,
    });

    // The request handler must be the first middleware on the app
    app.use(Sentry.Handlers.requestHandler());

    // TracingHandler creates a trace for every incoming request
    app.use(Sentry.Handlers.tracingHandler());
};
