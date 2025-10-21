require("dotenv-safe").load();
const http = require('http');
const url = require('url');
const global = require('./global');
const mongoose = require('mongoose');
const port = process.env.NODE_ENV === 'production' ? 3019 : process.env.PORT_DEV || 3019;
const express = require('express')
const app = express()
var cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');
var cors = require('cors');
var bodyParser = require('body-parser');
var Versions = require('./models/evio_versions');
var Details = require('./models/evio_versions_details');
const Utils = require('./utils');
// TODO: handle error saving without send to the database
var Logs = require('./models/logs');
var LogsOut = require('./models/logsout');
var jwt = require('jsonwebtoken');
const { cachePlatforms, cacheDefaultOPCTariff } = require('./caching/cache');
const Constants = require('./utils/constants');
const Sentry = require('@sentry/node');


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

connectionDB()
async function connectionDB() {
  await mongoose.connect(Constants.mongo.URI, Constants.mongo.options)
    .then(connection => {
      console.log(`Connected to ${connection.connections[0].name}`);
    })
    .catch(err => {
      console.log(err)
    })
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

app.use(bodyParser.json({ limit: '200mb' }))
app.use(bodyParser.urlencoded({ extended: true, limit: '200mb' }));



app.use(helmet());
app.use(express.json());

app.use(cookieParser());
app.use(cors());

//Reports
app.use(require('./routes/reports'));

app.get('/', (req, res) => {
  return res.send('OCPI 2.2 microservice initialized!');
});

app.post('/api/private/ocpiCache', async (req, res) => {
	try {
		await cachePlatforms();
    await cacheDefaultOPCTariff();
		return res.status(200).send('OK');
	} catch (error) {
		console.log(error);
		return res.status(500).send(error);
	}
});
function authorization22(req, res, next) {
  var origin = 'https://' + req.get('host') + req.originalUrl;
  //console.log("origin", origin);
  //console.log(req.protocol + '://' + req.get('host') + req.originalUrl);
  var token = "";
  if (req.headers.authorization) {
    token = req.headers.authorization.split(' ')[1];
  }

  Utils.getPlatformInfo(token).then((platform) => {



    // TODO: handle error saving without send to the database

    var log = new Logs();
    log.type = req.method;
    log.requestBody = req.body;
    var path = req.originalUrl;
    log.path = path;


    //Mobie phase 1 test - update endpoint. if endpoint is not the same of saved url given error
    // if (platform) {
    //   if (path.includes(`/ocpi/emsp/versions`)) {
    //     if (origin !== platform.evioURL)
    //       return res.sendStatus(404);

    //   }
    // }

    log.token = token;

    if (platform) {
      log.platformCode = platform.platformCode;
      log.platformName = platform.platformName;
    }


    var send = res.send;
    res.send = function (body) {

      // TODO: handle error saving without send to the database
      log.httpCode = res.statusCode;
      if (typeof body === 'object' && body !== null) {
        if (platform?.debug || !platform) {
          console.log(`[Log path] ${req.method} ${path}`)
          console.log(`[Log requestBody]` , JSON.stringify(req.body))
          console.log(`[Log responseBody]` , JSON.stringify(body))
        }
        log.responseBody = body;
        Logs.create(log);
      }
      else if (typeof body === 'string' && res.statusCode == 405 && body !== null) {
        if (platform?.debug || !platform) {
          console.log(`[Log path] ${req.method} ${path}`)
          console.log(`[Log requestBody]` , JSON.stringify(req.body))
          console.log(`[Log responseBody]` , JSON.stringify(body))
        }
        Logs.create(log);
      }

      send.call(this, body);
    };

    if (!req.headers.authorization)
      return res.status(200).send(Utils.response(null, 2004, "Unknown Token"));

    if (!platform) {
      return res.status(200).send(Utils.response(null, 2004, "Invalid Token"));
    }

    next();

  });
}


function logsOut(req, res, next) {


  var log = new LogsOut();
  log.requestBody = req.body;
  log.path = req.url;
  log.reqID = req.headers['reqID'];
  log.userId = req.headers['userid'];

  var send = res.send;
  res.send = function (body) {

    log.httpCode = res.statusCode;
    if (typeof body === 'object' && body !== null) {
      if (body.authorization_reference)
        log.authorization_reference = body.authorization_reference;

      if (body.sessionId)
        log.sessionId = body.sessionId;

      if (body.userId)
        log.userId = body.userId;

      if (body.hwId)
        log.hwId = body.hwId;

      log.responseBody = body;
      LogsOut.create(log);
    }
    else if (typeof body === 'string' && res.statusCode == 405 && body !== null) {
      LogsOut.create(log);
    }

    send.call(this, body);
  };

  next();

}


function evioAuthorization(req, res, next) {


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

app.use('/ocpi/emsp/:version/', authorization22);
app.use('/ocpi/:version/sender/', evioAuthorization);
app.use('/api/private/connectionstation/', logsOut);

//VERSIONS
// app.use('/ocpi/emsp/:version/versions/', require('./receiver/versions'));
// app.use('/ocpi/2.2/sender/versions', require('./sender/versions'));
//app.use('/ocpi/emsp/2.2/versions', require('./receiver/versions'));

// ========================= VERSIONS - Alternative with OCPI versions ========================= //
/*
  TODO: This versions endpoint was changed to /ocpi/emsp/versions/. Older version -> /ocpi/emsp/:version/versions/ .
        We probably need to update the key evioURL in the database and send a patch request to MobiE to update their credentials with this new endpoint
*/
app.use('/ocpi/emsp/versions/', (req, res) => {
  require(`./2.1.1/receiver/versions`)(req, res)
});

app.use('/ocpi/:version/sender/versions', (req, res) => {
  require(`./${req.params.version}/sender/versions`)(req, res)
});
// ============================================================================================ //

//DETAILS
// app.use('/ocpi/emsp/:version/details/', require('./receiver/details'));
// app.use('/ocpi/2.2/sender/details', require('./sender/details'));

// ========================= DETAILS - Alternative with OCPI versions ========================= //
app.use('/ocpi/emsp/:version/details/', (req, res) => {
  require(`./${req.params.version}/receiver/details`)(req, res)
});

app.use('/ocpi/:version/sender/details', (req, res) => {
  require(`./${req.params.version}/sender/details`)(req, res)
});
// ============================================================================================ //



//CREDENTIALS
// app.use('/ocpi/emsp/:version/credentials/', require('./receiver/credentials'));

// ========================= CREDENTIALS - Alternative with OCPI versions ========================= //
app.use('/ocpi/emsp/:version/credentials/', (req, res) => {
  require(`./${req.params.version}/receiver/credentials`)(req, res)
});

// ============================================================================================ //


//LOCATIONS
// app.use('/ocpi/emsp/:version/locations/', require('./receiver/locations'));
// app.use('/ocpi/emsp/:version/locations/:locationId/:evse_uid', require('./receiver/locations'));
// app.use('/ocpi/2.2/sender/mobie/job/locations', require('./sender/locations/locationsMobieJob'));

// ========================= LOCATIONS - Alternative with OCPI versions ========================= //

app.use('/ocpi/emsp/:version/locations/', (req, res) => {
  require(`./${req.params.version}/receiver/locations`)(req, res)
});

app.use('/ocpi/:version/sender/:platformCode/job/locations', (req, res) => {
  require(`./${req.params.version}/sender/locations/locationsJob`)(req, res)
});
// ============================================================================================ //

//TARIFFS
// app.use('/ocpi/emsp/:version/tariffs/:tariffId', require('./receiver/tariffs'));
// app.use('/ocpi/emsp/:version/tariffs/', require('./receiver/tariffs'));
// app.use('/ocpi/emsp/:version/tariffs/:country_code/:party_id/:tariffId', require('./receiver/tariffs'));
// app.use('/ocpi/2.2/sender/mobie/job/tariffs', require('./sender/tariffs/tariffsMobieJob'));

// ========================= TARIFFS - Alternative with OCPI versions ========================= //

app.use('/ocpi/emsp/:version/tariffs/', (req, res) => {
  require(`./${req.params.version}/receiver/tariffs`)(req, res)
});

app.use('/ocpi/:version/sender/:platformCode/job/tariffs', (req, res) => {
  require(`./${req.params.version}/sender/tariffs/tariffsJob`)(req, res)
});
// ============================================================================================ //

//INTERNAL FUNCTIONS (Generate Token)
app.use('/ocpi/:version/', require('./functions'))

//TOKENS
// app.use('/ocpi/emsp/:version/tokens/', require('./receiver/tokens'));
// app.use('/ocpi/2.2/sender/tokens/', require('./sender/tokens'));


// ========================= TOKENS - Alternative with OCPI versions ========================= //

app.use('/ocpi/emsp/:version/tokens/', (req, res) => {
  require(`./${req.params.version}/receiver/tokens`)(req, res)
});
app.use('/ocpi/:version/sender/tokens', logsOut);
app.use('/ocpi/:version/sender/tokens', (req, res) => {
  require(`./${req.params.version}/sender/tokens`)(req, res)
});

// ============================================================================================ //

//CDRs
// app.use('/ocpi/emsp/:version/cdrs/', require('./receiver/cdrs'));
// app.use('/ocpi/2.2/sender/cdrs/', require('./sender/cdrs'));
// app.use('/ocpi/2.2/sender/mobie/job/cdrs', require('./sender/cdrs/cdrsMobieJob'));

// ========================= CDRs - Alternative with OCPI versions ========================= //

app.use('/ocpi/emsp/:version/cdrs/', (req, res) => {
  require(`./${req.params.version}/receiver/cdrs`)(req, res)
});

app.use('/ocpi/:version/sender/cdrs', (req, res) => {
  require(`./${req.params.version}/sender/cdrs`)(req, res)
});

app.use('/ocpi/:version/sender/:platformCode/job/cdrs', (req, res) => {
  require(`./${req.params.version}/sender/cdrs/cdrsJob`)(req, res)
});
// ============================================================================================ //

//Sessions
// app.use('/ocpi/emsp/:version/sessions/', require('./receiver/sessions'));

// ========================= SESSIONS - Alternative with OCPI versions ========================= //

app.use('/ocpi/emsp/:version/sessions/', (req, res) => {
  require(`./${req.params.version}/receiver/sessions`)(req, res)
});

app.use('/ocpi/:version/sender/:platformCode/job/sessions', (req, res) => {
  require(`./${req.params.version}/sender/sessions/sessionsJob`)(req, res)
});
// ============================================================================================ //

//Commands
// app.use('/ocpi/emsp/:version/commands/', require('./receiver/commands'));
// app.use('/api/private/connectionstation/', require('./sender/commands'));

// app.use('/ocpi/2.2/sender/mobie/job/commandresult', require('./receiver/commands/commandResultJob'));

// ========================= COMMANDS - Alternative with OCPI versions ========================= //

app.use('/ocpi/emsp/:version/commands/', (req, res) => {
  require(`./${req.params.version}/receiver/commands`)(req, res)
});

app.use('/api/private/connectionstation/', (req, res) => {
  /*
    TODO: This function to get version with chargerType works, but the version can change with time (new implementations). We need to keep an eye on it.
  */
  let version = Utils.ocpiVersionByChargerType(req.body)
  req.params.version = version
  require(`./${version}/sender/commands`)(req, res)
});

app.use('/ocpi/:version/sender/:platformCode/job/commandresult', (req, res) => {
  require(`./${req.params.version}/receiver/commands/commandResultJob`)(req, res)
});
// ============================================================================================ //

app.use(require('./routes/sessions'))

//EVIO API
app.use('/api/private/payments/', require('./evioApi/payments'));
app.use('/api/private/billing/', require('./evioApi/billing'));
app.use('/api/private/cdrs/', require('./evioApi/cdrs'));
app.use('/api/private/chargingSession/', require('./evioApi/sessions'));
app.use('/api/private/statistics/', require('./evioApi/statistics'));
app.use('/api/private/tariffs/', require('./evioApi/tariffs'));
app.use('/api/private/tokens/', require('./evioApi/tokens'));

// Remote start v2
app.use('/api/private/v2/connectionstation/', require('./v2/routes'));

// Hubject Integration
app.use(require('./routes/requestsOICPMicroservice'))

// The error handler must be registered before any other error middleware and after all controllers
app.use(Sentry.Handlers.errorHandler());

const http_server = http.createServer(app);

http_server.listen(port, async () => {
  await cachePlatforms();
  await cacheDefaultOPCTariff();

  console.log(`EVIO OCPI 2.2 Server Running on port ${port}`);

  //Running all jobs when server restarts
  //Utils.callStartJobs();
});

