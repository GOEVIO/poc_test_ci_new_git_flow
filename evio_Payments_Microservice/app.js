require('dotenv-safe').load();
const Sentry = require('@sentry/node');
require('./middlewares/sentry'); 
const express = require('express');

const app = express();
const cookieParser = require('cookie-parser'); // Parse of coockies on the requests
const helmet = require('helmet'); // Package that offers some security to api gateway
const cors = require('cors');
const routes = require('./routes');
const morgan = require('morgan');
const { startConsumer } = require('./events/consumer');

console.log("Environment", process.env.NODE_ENV);
const port = process.env.NODE_ENV === 'production' ? process.env.PORT : process.env.PORT_DEV;
switch (process.env.NODE_ENV) {
    case 'production':
        console.log("Initing production environment")
        break;
    case 'development':
        console.log("Initing dev environment")
        break;
    case 'pre-production':
        console.log("Initing pre environment")
        break;
    default:
        console.log("Unknown environment")
        break;
}

const mongoose = require('mongoose');


//mongoose.connect('mongodb://localhost:27017/paymentsDB')
const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    keepAlive: true
};

connectionDB()
async function connectionDB() {
    const connString = String(process.env.DB_URI).replace('{database}', 'paymentsDB');
    await mongoose.connect(connString, options)
        .then(connection => {
            console.log(`Connected to ${connection.connections[0].name}`);
        })
        .catch(err => {
            console.log(`[${connString}] Error`, err);
            Process.exit(0);
        });
};


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

app.use(cors());
app.use(helmet());
app.use(express.json({ limit: '1000kb' }));
app.use(express.urlencoded({ extended: false, limit: '1000kb' }));
app.use(cookieParser());

app.use(require('./routes/payments'));
app.use(require('./routes/paymentsAdyen'));
app.use(require('./routes/paymentsLusoPay'));
app.use(require('./routes/wallet'));
app.use(require('./routes/transactions'));
app.use(require('./routes/paymentMethod'));
app.use(require('./routes/plafond'));
app.use(require('./routes/paymentPeriods'));
app.use(require('./routes/preAuthorize'));
app.use(require('./routes/userFinancialData'));

routes(app);

Sentry.setupExpressErrorHandler(app);


startConsumer();

module.exports = app;
