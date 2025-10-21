var http = require('http');
const express = require('express')
const app = express()
var cookieParser = require('cookie-parser');
var logger = require('morgan'); //Logger package to know what is happennig with api gateway
const helmet = require('helmet'); //Package that offers some security to api gateway
var cors = require('cors');
const port = process.env.PORT || 3016;
const mongoose = require('mongoose');
var CentralSystem = require('./ocpp-js/entities/CentralSystem');
var CentralSystemServer = new CentralSystem('8090');
var parser = require('fast-xml-parser');
var he = require('he');
const bodyParser = require('body-parser');
const global = require('./global');
const CS_TO_CP = require('./ocpp-js/CS_TO_CP');

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

// Process application/json
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: false
}));

const axios = require("axios");

var options = {
  attributeNamePrefix: "@_",
  attrNodeName: "attr", //default is 'false'
  textNodeName: "#text",
  ignoreAttributes: true,
  ignoreNameSpace: true,
  allowBooleanAttributes: false,
  parseNodeValue: true,
  parseAttributeValue: false,
  trimValues: true,
  cdataTagName: "__cdata", //default is 'false'
  cdataPositionChar: "\\c",
  parseTrueNumberOnly: false,
  arrayMode: false, //"strict"
  attrValueProcessor: (val, attrName) => he.decode(val, { isAttributeValue: true }),//default is a=>a
  tagValueProcessor: (val, tagName) => he.decode(val), //default is a=>a
  stopNodes: ["parse-me-as-string"]
};
var host = global.charger_microservice_host;

const chargingSessionServiceProxy = `${host}/api/private/chargingSession`;
const chargerServiceProxy = `${host}/api/private/chargers/status`;


mongoose.connect(global.mongo_connection)
  .catch(err => {
    console.log(err)
  })


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
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(cors());


//app.use(require('./routes/CPCommands'));
app.get('/', (req, res) => {
  res.send('OCPP Central System Microservice initialized!');
});

function hasValidData(req, res, next) {

  var userId = req.headers['userid'];

  if (!userId)
    return res.status(400).send({ auth: false, code: "server_user_id_required", message: "User id required" });

  var chargerId = req.body.chargerId;
  if (!chargerId)
    return res.status(400).send({ auth: false, code: "server_charger_id_required", message: 'Charger Id required' });

  var hwId = req.body.hwId;
  if (!hwId)
    return res.status(400).send({ auth: false, code: "server_hw_id_required", message: 'Hardware ID required' });


  next();
}

app.use('/api/private/connectionstation/ocpps_fast_charger/', hasValidData);

app.post('/api/private/connectionstation/ocpps_fast_charger/start', (req, res, next) => {

  CS_TO_CP.remoteStartTransaction.handle(req, res, next, CentralSystemServer);
  
});

app.post('/api/private/connectionstation/ocpps_fast_charger/changeConfiguration', (req, res, next) => {

  CS_TO_CP.changeConfiguration.handle(req, res, next, CentralSystemServer);
  
});

app.post('/api/private/connectionstation/ocpps_fast_charger/reset', (req, res, next) => {

  CS_TO_CP.reset.handle(req, res, next, CentralSystemServer);
  
});

app.post('/api/private/connectionstation/ocpps_fast_charger/unlockConnector', (req, res, next) => {

  CS_TO_CP.unlockConnector.handle(req, res, next, CentralSystemServer);
  
});


app.post('/api/private/connectionstation/ocpps_fast_charger/stop', (req, res, next) => {
 
  CS_TO_CP.remoteStopTransaction.handle(req, res, next, CentralSystemServer);

});

app.post('/api/private/connectionstation/ocpps_fast_charger/getConfiguration', (req, res, next) => {


  var userId = req.headers['userid'];
  var chargerId = req.body.chargerId;
  var hwId = req.body.hwId;
  var evId = req.body.evId;
  var plugId = req.body.plugId;
  var context = "[OCPP Fast Charger Server - Get Configuration]";

  /////////////////////////////////////////////////////////////////////////////
  //Check if charger exists on EVIO Network and get data of charger
  var params = {
    hwId: hwId
  };

  chekIfChargerExists(chargerServiceProxy, params).then((charger) => {

    if (charger) {
      if (!charger.data.charger[0].endpoint)
        return res.status(400).send({ auth: false, code: "server_endpoint_undefined", message: 'Endpoint undefined' });

      ///////////////////////////////////////////////////////////////////////////
      // create client or get already created client by _getClientByEndpoint function
      getClient(context, charger.data.charger[0]).then((client) => {

        if (client) {


          CentralSystemServer.GetConfiguration(hwId, charger.data.charger[0].endpoint).then(function (configuration) {

            if (configuration.result)
              return res.status(200).send(configuration.result);
            else
              console.log(`${context} Error getting configuration on charger ${hwId}`)

          }).catch(function (err) {
            console.log(`${context} Error getting configuration on charger ${hwId}  with error ${err}`)

            return res.status(400).send({ auth: false, code: "error", message: err.message });
          });

        }
        else {
          console.log(`Error creating client for : ${charger.data.charger[0].hwId} , ${charger.data.charger[0].endpoint}`);
          return res.status(400).send({ auth: false, code: "error", message: 'Error' });
        }
      });

    }
    else {
      return res.status(400).send({ auth: false, status: false, message: `Charger ${hwId} does not exists` });
    }
  });

});

app.post('/api/private/connectionstation/ocpps/getDiagnostics', (req, res, next) => {

  var userId = req.headers['userid'];
  var chargerId = req.body.chargerId;
  var hwId = req.body.hwId;
  var evId = req.body.evId;
  var plugId = req.body.plugId;
  var context = "[OCPP Server - Get Diagnostics]";

  /////////////////////////////////////////////////////////////////////////////
  //Check if charger exists on EVIO Network and get data of charger
  var params = {
    hwId: hwId
  };

  chekIfChargerExists(chargerServiceProxy, params).then((charger) => {

    if (charger) {
      if (!charger.data.charger[0].endpoint)
        return res.status(400).send({ auth: false, code: "server_endpoint_undefined", message: 'Endpoint undefined' });

      ///////////////////////////////////////////////////////////////////////////
      // create client or get already created client by _getClientByEndpoint function
      getClient(context, charger.data.charger[0]).then((client) => {


        if (client) {

          CentralSystemServer.getDiagnostics(hwId, charger.data.charger[0].endpoint).then(function (result) {

            console.log(`${context} CP result: ${result}`);
          }).catch(function (err) {
            console.log(`${context} Error getting diagnostics on charger ${hwId}  with error ${err}`)

            return res.status(400).send({ auth: false, code: "error", message: err.message });
          });

        }
        else {
          return res.status(400).send({ auth: false, code: "error", message: 'Error' });
          console.log(`Error creating client for : ${charger.data.charger[0].hwId} , ${charger.data.charger[0].endpoint}`);
        }
      });

    }
    else {
      return res.status(400).send({ auth: false, status: false, message: `Charger ${hwId} does not exists` });
    }
  });

});


const getClient = (context, charger) => {

  return new Promise((resolve, reject) => {

    CentralSystemServer._getClientByEndpoint(charger.endpoint).then((client) => {

      if (client) {
        //console.log(`${context} Client found: ${client.endpoint} , chargeBoxId: ${client.chargeBoxIdentity}\n`);
        resolve(true);
      }
      else {
        //console.log(`${context} Creating client: ${charger.hwId},  ${charger.endpoint}\n`);

        //Create client if does not exists
        CentralSystemServer.createChargeBoxClient(charger, function () {
          resolve(true);
        });
      }
    });

  });
}

const chekIfChargerExists = (ServiceProxy, params) => {

  return new Promise((resolve, reject) => {
    axios.get(ServiceProxy, { params })
      .then(function (response) {

        var charger = response.data.charger[0];

        if (typeof charger === 'undefined') {
          resolve(false);
        }
        else {
          resolve(response);
        }

      }).catch(function (error) {
        console.log("error" + error);
        console.log(error.response.data.message);
        resolve(false);
      });
  });
};


app.get('/api/private/healthCheck', (req, res) => {
  return res.status(200).send('OK');
});

var server = http.createServer(app);
server.listen(port, () => {
  console.log(`Server OCPP is running on port:  ${port} \n`);

});
