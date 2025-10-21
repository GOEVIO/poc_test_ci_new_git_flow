require('dotenv-safe').load();
require('newrelic');

const http = require('http');
const express = require('express');
const app = express();
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const cors = require('cors');
const mongoose = require('mongoose');
const Process = require('process');
const compression = require('compression');
const morgan = require('morgan');
const Sentry = require('@sentry/node');
const Constants = require('./utils/constants');


if (Constants.environment !== 'development') {
    // eslint-disable-next-line global-require
    require('./middlewares/sentry')(app);
}

const customOutput = (err=false)=>(...args) => {
  const formattedArgs = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg) : arg
  ).join(' ');
  if (err){
      process.stderr.write(`${formattedArgs}\n`);
      return;
  }
  process.stdout.write(`${formattedArgs}\n`);
};
console.log=customOutput();
console.info=customOutput();
console.warn=customOutput();
console.error=customOutput(true);

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

//mongoose.connect('mongodb://192.168.1.211:27017/publicNetworkDB')
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  keepAlive: true
};


connectionDB()
async function connectionDB() {
  const connString = String(process.env.DB_URI).replace('{database}', 'publicNetworkDB');
  await mongoose.connect(connString, options)
    .then(connection => {
      console.log(`Connected to ${connection.connections[0].name}`);
    })
    .catch(err => {
      Sentry.captureException(err);
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
app.use(compression());

app.use(require('./routes/OCMCharger'));
app.use(require('./routes/MobieCharger'));
app.use(require('./routes/PublicNetwork'));
app.use(require('./routes/Operators'));
app.use(require('./routes/ImagesDependencies'));
app.use(require('./routes/OICPChargers'))
app.use(require('./routes/locations'))

app.get('/api/private/healthCheck', (req, res) => {
  return res.status(200).send('OK');
});


if (process.env.NODE_ENV !== 'development') {
  app.use(Sentry.Handlers.errorHandler());
}
const server = http.createServer(app);
server.listen(port, () => {
  console.log(`Running on port:  ${port}`);
});
