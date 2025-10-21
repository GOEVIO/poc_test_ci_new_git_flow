var http = require('http');
const Sentry = require("@sentry/node");
const express = require('express')
const app = express()
var cookieParser = require('cookie-parser'); //Parse of coockies on the requests
var logger = require('morgan'); //Logger package to know what is happennig with api gateway
const helmet = require('helmet'); //Package that offers some security to api gateway
var cors = require('cors');
require("dotenv-safe").load();
const mongoose = require('mongoose');
var bodyParser = require('body-parser');
const SentryHandler = require('./controllers/sentryHandler')
const { cacheTariffs } = require('./caching/cache');

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


//mongoose.connect('mongodb://localhost:27017/publicTariffsDB')
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  keepAlive: true
};

connectionDB()
async function connectionDB() {
  const connString = String(process.env.DB_URI).replace('{database}', 'publicTariffsDB');
  await mongoose.connect(connString, options)
    .then(connection => {
      console.log(`Connected to ${connection.connections[0].name}`);
    })
    .catch(err => {
      console.log(`[${connString}] Error`, err);
      Process.exit(0);
    });
};

// Sentry Init 
SentryHandler.sentryInit(app)

// The request handler must be the first middleware on the app
app.use(Sentry.Handlers.requestHandler());

// TracingHandler creates a trace for every incoming request
app.use(Sentry.Handlers.tracingHandler());


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

app.use(require('./routes/listCEME'));
app.use(require('./routes/tariffCEME'));
app.use(require('./routes/schedulesCEME'));
app.use(require('./routes/tariffsOPC'));
app.use(require('./routes/tariffTar'));
app.use(require('./routes/roamingPlan'));

app.get('/api/private/healthCheck', (req, res) => {
  return res.status(200).send('OK');
});

// post to create cache: this is a POC of redis, ideally we will load this data
// as part of the iniatilization of this service. TBD with Michel&Ricardo.
app.post('/api/private/tariffsOPC/cache', async (req, res) => {
  try {
    await cacheTariffs();
    return res.status(200).send('Added successfully');
  } catch (error) {
    console.error(error);
    return res.status(500).send(`Something went wrong ${error}`);
  }
});

// The error handler must be registered before any other error middleware and after all controllers
app.use(Sentry.Handlers.errorHandler());

// Optional fallthrough error handler
// app.use(function onError(err, req, res, next) {
//   // The error id is attached to `res.sentry` to be returned
//   // and optionally displayed to the user for support.
//   res.statusCode = 500;
//   res.end(res.sentry + "\n");
// });


const server = http.createServer(app);
server.listen(port, async () => {
  await cacheTariffs();
  console.log(`Running on port:  ${port}`);
});