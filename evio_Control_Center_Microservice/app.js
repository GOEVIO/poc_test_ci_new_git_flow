require('dotenv-safe').load();

const http = require('http');
const global = require('./global');
const mongoose = require('mongoose');
const port = process.env.NODE_ENV === 'production' ? 3040 : 3040;
const express = require('express')
const app = express()
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const helmet = require('helmet');
var cors = require('cors');
var bodyParser = require('body-parser');
const Utils = require('./utils');
var OcpiLog = require('./models/ocpiLog');
const jwt = require('jsonwebtoken');
let url  = require('url');
const Constants = require('./utils/constants');
const Sentry = require('@sentry/node');

if (Constants.env.environment !== 'development') {
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

const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true
};

mongoose.connect(global.mongo_connection, options)
  .catch(err => {
    console.log(err)
  })

app.use(express.json({ limit: '200mb' }))
app.use(express.urlencoded({ extended: true , limit: '200mb'}));

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
// app.use(express.json());

app.use(cookieParser());
app.use(cors());

app.get('/', (req, res) => {
  return res.send('Control Center Microservice Initialized!');
});

// ========================================== OCPI  ======================================= //

function cpoAuthorization(req, res, next) {
  console.log(req.originalUrl)
  var origin = req.originalUrl.includes('http') ? req.originalUrl : 'https://' + req.get('host') + req.originalUrl;
  
  var token = "";
  if (req.headers.authorization) {
    token = req.headers.authorization.split(' ')[1];
  }

  Utils.getPlatformInfo(token).then((platform) => {


    var log = new OcpiLog();
    log.type = req.method;
    log.requestBody = req.body;

    var path = req.originalUrl;
    log.path = path;
    log.trigger = process.env.triggerHUB;
    log.token = token;
    log.module = Utils.getOcpiModule(path)
    
    if (platform) {
      if (path.includes(`/versions`) && !path.includes(`sender`)) {
        if (url.parse(origin).pathname.toLowerCase() !== url.parse(platform.cpoURL).pathname.toLowerCase()) {
          return res.sendStatus(404);
        }
      }
    }

    if (platform) {
      log.platformCode = platform.platformCode;
      log.platformName = platform.platformName;
      log.cpo = platform.cpo
    }

    var send = res.send;
    res.send = function (body) {

      log.httpCode = res.statusCode;
      if (typeof body === 'object' && body !== null) {
        log.responseBody = body;
        log.success = Utils.getLogSuccess(log.httpCode , log.responseBody.status_code),
        OcpiLog.create(log);
      }
      else if (typeof body === 'string' && res.statusCode == 405 && body !== null) {
        log.success = Utils.getLogSuccess(log.httpCode , null),
        OcpiLog.create(log);
      }

      send.call(this, body);
    };
    
    req.headers['platform'] = platform

    if (!req.headers.authorization)
      return res.status(401).send(Utils.response(null, 2004, "Unknown Token"));

    if (!platform)
      return res.status(401).send(Utils.response(null, 2004, "Invalid Token"));

    next();

  });
}

function hasValidApiToken(req, res, next) {


  var apikey = req.headers['apikey'];

  if (apikey) {
    jwt.verify(apikey, process.env.TOKEN_SECRET, function (err, decoded) {
      if (err) {
        console.log(err.message);
        return res.status(400).send({ auth: false, message: 'Failed to authenticate api key token: ' + err });
      }
      else {
        next();
      };
    });
  }
  else {
    console.log("No api key provided");
    return res.status(400).send({ auth: false, message: 'No api key provided' });
  }
}

// OCPI requests from HUB
app.use('/ocpi/cpo/', cpoAuthorization);

app.use('/ocpi/cpo/:platformId', (req, res) => {
  require(`./${req.params.platformId.toLowerCase()}/`)(req, res)
});

// Requests from OCPP
app.use('/api/ocpp/', hasValidApiToken)
app.use('/api/ocpp/', require('./handlersOCPP'))

//Requests from Control Center
app.use('/api/private/', hasValidApiToken)
app.use('/api/private/', Utils.isAuthenticated);
app.use('/api/private/controlcenter/evioApi/users', require('./evioApi/users'));
app.use('/api/private/controlcenter/evioApi/chargers', require('./evioApi/chargers'));
app.use('/api/private/controlcenter/evioApi/tariffs', require('./evioApi/tariffs'));
app.use('/api/private/controlcenter', require('./ControlCenter'));

app.use(require('./routes/fileHandler'));
app.use(require('./routes/cemeManagement'));
app.use(require('./routes/physicalCards'));
 
// ============================================================================================ //

// The error handler must be registered before any other error middleware and after all controllers
app.use(Sentry.Handlers.errorHandler());
var http_server = http.createServer(app);

http_server.listen(port, () => {
  console.log(`EVIO Control Center Server Running on port ${port}`);
});

