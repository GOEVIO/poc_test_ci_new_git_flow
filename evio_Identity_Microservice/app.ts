import routes from './routes';
import SentryMiddleware from './middlewares/sentry';
import Constants from './utils/constants';
import { v2Router } from './v2';

const express = require('express');

const app = express();
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const bodyParser = require('body-parser');
const { router } = require('./routes/users');
const Sentry = require('@sentry/node');

if (!['test'].includes(Constants.environment)) {
    SentryMiddleware(app);
}

app.use(bodyParser.json({limit: '5000mb'}))
app.use(bodyParser.urlencoded({limit: "5000mb", extended: true, parameterLimit:50000}));
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
app.use(express.json({limit: '5000mb'}));
app.use(express.urlencoded({limit: "5000mb", extended: true, parameterLimit:50000}));
app.use(cookieParser());
app.use(cors());
app.use(require('./routes/authentication'));
app.use(router);
app.use(require('./routes/recover_password'));
app.use(require('./routes/activation'));
app.use(require('./routes/drivers'));
app.use(require('./routes/groupDrivers'));
app.use(require('./routes/contracts'));
app.use(require('./routes/countryKeyboard'));
app.use(require('./routes/groupCSUsers'));
app.use(require('./routes/billingProfile'));
app.use(require('./routes/cemeTariff'));
app.use(require('./routes/usersPackages'));
app.use(require('./routes/guestUsers'));
app.use(require('./routes/controlCenter'));
app.use(require('./routes/scSibsCards'));
app.use(require('./routes/scCetelemCards'));
app.use(require('./routes/hySibsCards'));
app.use(require('./routes/cards'));
app.use(require('./routes/toProcessCards'));
app.use(routes);
app.use('/api/private/chargers/V2', v2Router);
app.use(Sentry.Handlers.errorHandler());

export default app;
