import Constants from './utils/constants';
import SentryHandler from './controllers/sentryControllers';
// Routes
import allRoutes from './routes';
import v2Router from './v2';
import * as Sentry from '@sentry/node';

const express = require('express');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const helmet = require('helmet');
const cors = require('cors');

const app = express();

// Sentry Init
if (['pre-production', 'production'].includes(Constants.environment)) {
    // Init Sentry
    SentryHandler.sentryInit(app);
    // The request handler must be the first middleware on the app
    app.use(Sentry.Handlers.requestHandler());
    // TracingHandler creates a trace for every incoming request
    app.use(Sentry.Handlers.tracingHandler());
}
app.use(cors());
logger.token('req-body', (req) => JSON.stringify(req.body) || '{}');
logger.token('res-size', (req, res) => res.get('Content-Length') || '0');
logger.token('req-headers', (req) => JSON.stringify(req.headers));
app.use(
  logger((tokens, req, res) => {
    const status = tokens.status(req, res);
    const responseTime =  tokens['response-time'](req, res);
    const log = {
      method: tokens.method(req, res),
      url: tokens.url(req, res),
      status: status? parseInt(status): 0,
      responseTime: responseTime? parseFloat(responseTime): 1,
      reqHeaders: JSON.parse(tokens['req-headers'](req)),
      reqBody: JSON.parse(tokens['req-body'](req)),
      resSize: `${tokens['res-size'](req, res)} bytes`,
      logType: 'httpRequest',
    };
    return JSON.stringify(log);
  })
);
app.use(helmet());
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: false, limit: '200mb' }));
app.use(cookieParser());
app.use(allRoutes);

app.use('/api/private/chargers/V2', v2Router);

app.get('/api/private/healthCheck', (req, res) => {
    return res.status(200).send('OK');
});

// The error handler must be registered before any other error middleware and after all controllers
if (['pre-production', 'production'].includes(Constants.environment)) app.use(Sentry.Handlers.errorHandler());

export default app;
