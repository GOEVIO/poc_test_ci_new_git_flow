require('dotenv-safe').load();

const express = require('express');

const app = express();

const cookieParser = require('cookie-parser'); // Parse of coockies on the requests
const logger = require('morgan'); // Logger package to know what is happennig with api gateway
const helmet = require('helmet'); // Package that offers some security to api gateway
const cors = require('cors');
const Sentry = require('@sentry/node');
const Process = require('process');
const bodyParser = require('body-parser');
const routes = require('./routes');
const Constants = require('./utils/constants');

if (Constants.environment !== 'development') {
  // eslint-disable-next-line global-require
  require('./middlewares/sentry')(app);
}

app.use(bodyParser.json({ limit: '5000mb' }));
app.use(bodyParser.urlencoded({ limit: '5000mb', extended: true, parameterLimit: 50000 }));
logger.token('req-body', (req) => JSON.stringify(req.body) || '{}');
logger.token('res-size', (req, res) => res.get('Content-Length') || '0');
logger.token('req-headers', (req) => JSON.stringify(req.headers));
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
app.use(helmet());
app.use(express.json({ limit: '5000mb' }));
app.use(express.urlencoded({ limit: '5000mb', extended: true, parameterLimit: 50000 }));
app.use(cookieParser());
app.use(cors());

app.use(require('./routes/appConfigurations'));
app.use(require('./routes/appVersions'));
app.use(require('./routes/mailNotifications'));
app.use(require('./routes/openChargeMap'));
app.use(require('./routes/siemensSession'));
app.use(require('./routes/versionCompatibility'));
app.use(require('./routes/notificationsSettings'));
app.use(require('./routes/fees'));
app.use(require('./routes/support'));
app.use(require('./routes/portugalDistricts'));
app.use(require('./routes/managementPOIs'));
app.use(require('./routes/messages'));
app.use(require('./routes/timeToValidatePayment'));
app.use(require('./routes/cpModelsWithNoAvailableStatusNotification'));
app.use(require('./routes/apiKey'));
app.use(require('./routes/customization'));
app.use(require('./routes/sibs'));
app.use(require('./routes/rabbitMQConfig'));
app.use(require('./routes/validationCDRConfig'));
app.use(require('./routes/countries'));
app.use(require('./routes/coordinatesSessionsConfig'));
app.use(require('./routes/charger-preauthorization-values'));

const logsOut = async (req, res, next) => {
  const { send } = res;
  res.send = function (body) {
    if (res.statusCode === '500' && String(body).includes('pool destryed')) {
      // console.log("res.statusCode", res.statusCode);
      Process.exit(0);
    }
    send.call(this, body);
  };
  next();
};

app.use('/api/private/', logsOut);

routes(app);

// The error handler must be registered before any other error middleware and after all controllers
app.use(Sentry.Handlers.errorHandler());

module.exports = app;
