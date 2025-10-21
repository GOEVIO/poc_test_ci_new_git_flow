import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';
import appData from '../package.json';
import { sentry, microservice } from '../configuration';
import { Express } from 'express';

const sentryMiddleware = (app: Express) => {
    Sentry.init({
        dsn: sentry.dsn,
        release: `${appData.name}@${appData.version}`,
        environment: microservice.nodeEnv,
        integrations: [
            // enable HTTP calls tracing
            new Sentry.Integrations.Http({ tracing: true }),
            // enable Express.js middleware tracing
            new Sentry.Integrations.Express({ app }),
            new ProfilingIntegration(),
        ],
        // Performance Monitoring
        tracesSampleRate: sentry.traceSampleRate,
        // Set sampling rate for profiling - this is relative to tracesSampleRate
        profilesSampleRate: sentry.profilesSampleRate,
    });

    // The request handler must be the first middleware on the app
    app.use(Sentry.Handlers.requestHandler());

    // TracingHandler creates a trace for every incoming request
    app.use(Sentry.Handlers.tracingHandler());
};

export default sentryMiddleware;
