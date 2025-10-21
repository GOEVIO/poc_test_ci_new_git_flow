import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import dotenvSafe from 'dotenv-safe';
import Constants from './utils/constants';
import { v2Router } from './v2/index';
import SentryHandler from './controllers/sentryControllers';
import allRoutes from './routes';
import * as Sentry from '@sentry/node';

dotenvSafe.config();

const app = express();

if (['production', 'pre-production'].includes(Constants.environment)) {
    SentryHandler.sentryInit(app);
    app.use(Sentry.Handlers.requestHandler());
    app.use(Sentry.Handlers.tracingHandler());
}

app.use(cors());
app.use(helmet());
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: false, limit: '200mb' }));
app.use(cookieParser());

logger.token('req-body', req => JSON.stringify(req.body) || '{}');
logger.token('res-size', (req, res) => res.get('Content-Length') || '0');
logger.token('req-headers', req => JSON.stringify(req.headers));
app.use(
    logger((tokens, req, res) => {
        const status = tokens.status(req, res);
        const responseTime = tokens['response-time'](req, res);
        const log = {
            method: tokens.method(req, res),
            url: tokens.url(req, res),
            status: status ? parseInt(status) : 0,
            responseTime: responseTime ? parseFloat(responseTime) : 1,
            reqHeaders: JSON.parse(tokens['req-headers'](req)),
            reqBody: JSON.parse(tokens['req-body'](req)),
            resSize: `${tokens['res-size'](req, res)} bytes`,
            logType: 'httpRequest',
        };
        return JSON.stringify(log);
    })
);

app.use(allRoutes);
app.use('/api/private/chargers/V2', v2Router);

app.get('/api/private/healthCheck', (req, res) => {
    res.status(200).send('OK');
});

if (['production', 'pre-production'].includes(Constants.environment)) {
    app.use(Sentry.Handlers.errorHandler());
}

export default app;
