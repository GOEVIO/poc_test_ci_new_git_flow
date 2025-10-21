require('dotenv-safe').load();

const express = require('express');

const app = express();

const cookieParser = require('cookie-parser'); // Parse of coockies on the requests
const helmet = require('helmet'); // Package that offers some security to api gateway
const cors = require('cors');
const mongoose = require('mongoose');
const Process = require('process');
const Sentry = require('@sentry/node');
const morgan = require('morgan');
const routes = require('./routes');
const Constants = require('./utils/constants');


if (Constants.environment !== 'development') {
  // eslint-disable-next-line global-require
  require('./middlewares/sentry')(app);
}

const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  keepAlive: true
};
connectionDB();
async function connectionDB() {
  const connString = String(process.env.DB_URI).replace('{database}', 'billingDB');
  console.log(connString)
  await mongoose.connect(connString, options)
    .then((connection) => {
      console.log(`Connected to ${connection.connections[0].name}`);
    })
    .catch((err) => {
      console.log(`[${connString}] Error`, err);
      Process.exit(0);
    });
}


morgan.token('req-body', req => JSON.stringify(req.body) || '{}');
morgan.token('res-size', (req, res) => res.get('Content-Length') || '0');
morgan.token('req-headers', req => JSON.stringify(req.headers));
app.use(
  morgan((tokens, req, res) => {
    const status = tokens.status(req, res);
    const responseTime = tokens['response-time'](req, res);
    const log = {
      method: tokens.method(req, res),
      url: tokens.url(req, res),
      status: status ? parseInt(status, 10) : 0,
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
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: false, limit: '200mb' }));
app.use(cookieParser());
app.use(cors());

app.use(require('./routes/Invoice'));
app.use(require('./routes/TopUp'));
app.use(require('./routes/Monitoring'));
app.use(require('./routes/Template'));

routes(app);

// The error handler must be registered before any other error middleware and after all controllers
app.use(Sentry.Handlers.errorHandler());

module.exports = app;
