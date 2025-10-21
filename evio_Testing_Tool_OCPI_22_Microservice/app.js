const http = require('http');
const url = require('url');
const global = require('./global');
const mongoose = require('mongoose');
const port = process.env.NODE_ENV === 'production' ? 3020 : 3020;
const express = require('express')
const app = express()
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const helmet = require('helmet');
var cors = require('cors');
var bodyParser = require('body-parser');
const fs = require('fs');
const Utils = require('./utils');

let details = fs.readFileSync('details.json');
let versions = fs.readFileSync('versions.json');
let credentials = fs.readFileSync('credentials.json');
let tariffs = fs.readFileSync('tariffs.json');
let cdrs = fs.readFileSync('cdrs.json');

var testingOcpiDB_versions = require('./models/testingOcpiDB_versions');
var testingOcpiDB_details = require('./models/testingOcpiDB_details');
var testingOcpiDB_credentials = require('./models/testingOcpiDB_credentials');

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

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }));

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

app.use(cookieParser());
app.use(cors());

mongoose.connect(global.mongo_connection)
  .catch(err => {
    console.log(err)
  })

function authorization22(req, res, next) {

  var token = "";
  if (req.headers.authorization) {
    token = req.headers.authorization.split(' ')[1];
  }

  var token_B = "a76de333-014a-421f-8313-50166cb0fe59";


  // var send = res.send;
  // res.send = function (body) {


  // send.call(this, body);
  // };

  if (!req.headers.authorization)
    return res.status(200).send(Utils.response(null, 2004, "Unknown Token"));

  if (token === token_B)
    next();
  else
    return res.status(200).send(Utils.response(null, 2004, "Invalid Token"));


  //next();
}

app.use('/ocpi/', authorization22);

app.get('/', (req, res) => {
  return res.send('OCPI 2.2 microservice initialized!');
});

app.get('/ocpi/versions/', (req, res) => {

  // testingOcpiDB_versions.find({}, { _id: 0 }, (err, versions) => {
  //   console.log(versions);
  //   return res.status(200).send(Utils.response(versions, 1000, "Success"));
  // });


   let versionsData = JSON.parse(versions);
   return res.status(200).send(Utils.response(versionsData, 1000, "Success"));
});

app.put('/ocpi/hub/2.2/credentials', (req, res) => {
  console.log(req.body);
  console.log(req.headers);
  // testingOcpiDB_credentials.find({}, { _id: 0 }, (err, credentials) => {
  //   //console.log(details);
  //   return res.status(200).send(Utils.response(credentials[0], 1000, "Success"));
  // });

   let credentialsData = JSON.parse(credentials);
  console.log("req.body", req.body);
   return res.status(200).send(Utils.response(credentialsData, 1000, "Sucesso"));
});

app.delete('/ocpi/hub/2.2/credentials', (req, res) => {
  console.log(req.body);
  console.log(req.headers);
  //console.log(details);
  return res.status(200).send(Utils.response({}, 1000, "Success"));

});

app.get('/ocpi/2.2/details', (req, res) => {

  // testingOcpiDB_details.find({}, { _id: 0 }, (err, details) => {
  //   //console.log(details);
  //   return res.status(200).send(Utils.response(details, 1000, "Success"));
  // });


   let detailsData = JSON.parse(details);
   return res.status(200).send(Utils.response(detailsData, 1000, "Success"));
});

app.get('/ocpi/hub/emsp/2.2/tariffs', (req, res) => {
  let tariffsData = JSON.parse(tariffs);
  return res.status(200).send(Utils.response(tariffsData, 1000, "Success"));
});

app.put('/ocpi/hub/emsp/2.2/tariffs/:country_code/:party_id/:tariff_id', (req, res) => {
  let tariffsData = JSON.parse(tariffs);
  return res.status(200).send(Utils.response(tariffsData, 1000, "Success"));
});

app.delete('/ocpi/hub/emsp/2.2/tariffs/:country_code/:party_id/:tariff_id', (req, res) => {
  let tariffsData = JSON.parse(tariffs);
  return res.status(200).send(Utils.response(tariffsData, 1000, "Success"));
});

app.post('/ocpi/hub/emsp/2.2/commands/:command/:uid', (req, res) => {
  console.log(req.params);
  return res.status(200).send(Utils.response(null, 1000, "Success"));
  //return res.status(200).send(response);
});

app.put('/ocpi/hub/emsp/2.2/sessions/:country_code/:party_id/:session_id', (req, res) => {
  console.log(req.body);
  return res.status(200).send(Utils.response(null, 1000, "Success"));
  //return res.status(200).send(response);
});

app.patch('/ocpi/hub/emsp/2.2/sessions/:country_code/:party_id/:session_id', (req, res) => {
  console.log(req.body);
  return res.status(200).send(Utils.response(null, 1000, "Success"));
  //return res.status(200).send(response);
});

app.post('/ocpi/hub/emsp/2.2/locations/:country_code/:party_id', (req, res) => {
  console.log(req.params);
  console.log(req.body);
  let response = {
    id : "PRT-00001" 
  }
  return res.status(200).send(Utils.response(response, 1000, "Success"));
  //return res.status(200).send(response);
});

app.put('/ocpi/hub/emsp/2.2/locations/:country_code/:party_id', (req, res) => {
  console.log(req.params);
  console.log(req.body);
  return res.status(200).send(Utils.response(null, 1000, "Success"));
  //return res.status(200).send(response);
});

app.put('/ocpi/hub/emsp/2.2/locations/:country_code/:party_id/:location_id', (req, res) => {
  console.log(req.params);
  console.log(req.body);
  return res.status(200).send(Utils.response(null, 1000, "Success"));
  //return res.status(200).send(response);
});

app.patch('/ocpi/hub/emsp/2.2/locations', (req, res) => {
  console.log(req.body);
  return res.status(200).send(Utils.response(null, 1000, "Success"));
  //return res.status(200).send(response);
});

app.patch('/ocpi/hub/emsp/2.2/locations/:country_code/:party_id/:location_id', (req, res) => {
  console.log(req.params);
  console.log(req.body);
  return res.status(200).send(Utils.response(null, 1000, "Success"));
  //return res.status(200).send(response);
});

app.patch('/ocpi/hub/emsp/2.2/locations/:country_code/:party_id/:location_id/:evse_uid', (req, res) => {
  console.log(req.params);
  console.log(req.body);
  return res.status(200).send(Utils.response(null, 1000, "Success"));
  //return res.status(200).send(response);
});

app.patch('/ocpi/hub/emsp/2.2/locations/:country_code/:party_id/:location_id/:evse_uid/:connector_id', (req, res) => {
  console.log(req.params);
  console.log(req.body);
  return res.status(200).send(Utils.response(null, 1000, "Success"));
  //return res.status(200).send(response);
});

app.get('/ocpi/hub/cpo/2.2/cdrs', (req, res) => {
  let cdrsData = JSON.parse(cdrs);
  return res.status(200).send(Utils.response(cdrsData, 1000, "Success"));
});

app.get('/ocpi/hub/emsp/2.2/cdrs', (req, res) => {
  let cdrsData = JSON.parse(cdrs);
  
  let limit =  req.query.limit !== undefined && req.query.limit !== null ? ( Number(req.query.limit) < 0 || Number(req.query.limit) > 1 ? 1 : Number(req.query.limit) ) : 1
  let offset =  req.query.offset !== undefined && req.query.offset !== null ? (Number(req.query.offset) >= 0 ? Number(req.query.offset) : 0) : 0
  let date_from =  req.query.date_from !== undefined && req.query.date_from !== null ? req.query.date_from : ""
  let date_to =  req.query.date_to !== undefined && req.query.date_to !== null ? req.query.date_to : ""
  try {
      if (cdrsData) {
          res.set("X-Total-Count" , cdrsData.length)
          if (offset + limit < cdrsData.length) {
              if (offset + limit + limit > cdrsData.length) {
                  let link = `<https://${req.get('host')}${req.baseUrl}?offset=${offset+limit}&limit=${cdrsData.length-(offset+limit)}${date_from != "" ? "&date_from=" + date_from : ""}${date_to != "" ? "&date_to=" + date_to : ""}>; rel="next"`
                  res.set("Link" , link)
              } else {
                  let link = `<https://${req.get('host')}${req.baseUrl}?offset=${offset+limit}&limit=${limit}${date_from != "" ? "&date_from=" + date_from : ""}${date_to != "" ? "&date_to=" + date_to : ""}>; rel="next"`
                  res.set("Link" , link)
              }
              res.set("X-Limit" , limit)
          } else {
              limit = cdrsData.length - offset >= 0 ?  cdrsData.length - offset : 0
              res.set("X-Limit" , limit)
          }
          let response = cdrsData.slice(offset , offset + limit)
          return res.status(200).send(Utils.response(response, 1000, "Success"));

      } else {
          return res.status(200).send(Utils.response(null, 2000, "Generic client error "));
      }
      
  } catch (e) {
      console.log("Generic server error. ", e);
      return res.status(200).send(Utils.response(null, 3000, "Generic server error"));
  }
});

app.post('/ocpi/hub/emsp/2.2/tokens/:idTag/authorize', (req, res) => {
  console.log(req.params);
  console.log(req.query);
  console.log(req.body);
  let data = {}
  if (req.params.idTag === "3C665252") {
    data = {
      "allowed":"ALLOWED",
      "token":{ 
        "uid":"3C665252",
        "type":"RFID",
        "issuer":"EVIO",
        "valid":true,
        "whitelist":"ALWAYS",
        "country_code":"PT",
        "party_id":"EVI",
        "last_updated":"2022-07-08T14:01:28.000Z",
        "contract_id":"PT-EVI-xxxxxxxx"
      }
    }
  } else {
    data = {
      "allowed":"NOT_ALLOWED",
      "token":{ 
        "uid":req.params.idTag,
        "type":"RFID",
        "issuer":"EVIO",
        "valid":true,
        "whitelist":"ALWAYS",
        "country_code":"PT",
        "party_id":"EVI",
        "last_updated":"2022-07-08T14:01:28.000Z",
        "contract_id":"PT-EVI-xxxxxxxx"
      }
    }
  } 
  return res.status(200).send(Utils.response(data, 1000, "Success"));
});

var http_server = http.createServer(app);

http_server.listen(port, () => {
  console.log(`EVIO OCPI 2.2 Server Running on port ${port}`);
});
