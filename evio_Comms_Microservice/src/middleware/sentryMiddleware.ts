import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';
import appData from '../../package.json';
import ENV from '../configuration/index';
import { Express } from 'express';

const sentryMiddleware = (app: Express) => {
    Sentry.init({
        dsn: ENV.SENTRY.DSN,
        release: `${appData.name}@${appData.version}`,
        environment: ENV.MICROSERVICE.NODE_ENV,
        integrations: [
            // enable HTTP calls tracing
            new Sentry.Integrations.Http({ tracing: true }),
            // enable Express.js middleware tracing
            new Sentry.Integrations.Express({ app }),
            new ProfilingIntegration(),
        ],
        // Performance Monitoring
        tracesSampleRate: Number(ENV.SENTRY.TRACE_SAMPLE_RATE || 0.01),
        // Set sampling rate for profiling - this is relative to tracesSampleRate
        profilesSampleRate: Number(ENV.SENTRY.PROFILES_SAMPLE_RATE || 0.01),
    });

    // The request handler must be the first middleware on the app
    app.use(Sentry.Handlers.requestHandler());

    // TracingHandler creates a trace for every incoming request
    app.use(Sentry.Handlers.tracingHandler());
};

export default sentryMiddleware;
