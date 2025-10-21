const http = require('http');
const https = require('https');
const WebSocket = require('ws');
const url = require('url');
const handlers = require('./handlers');
const global = require('./global');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const ocppPort = process.env.NODE_ENV === 'production' ? 8090 : 8090;
const port = process.env.NODE_ENV === 'production' ? 3018 : 3018;
const chargerHeartBeatServiceProxy = `${global.charger_microservice_host}/api/private/chargers/heartBeat`;
const OcppJsonCall = require("./OcppJsonCall")
const  event = require('events');
const  eventEmitter = new event.EventEmitter();
const CS_TO_CP = require('./CS_TO_CP');
const Sentry = require('@sentry/node');
const { remoteStart } = require('./v2/controllers/remote-start.controller')
const { handleRemoteFunctionStart } = require('./v2/middlewares/remote-start.middleware')

const server = http.createServer();

const wss = new WebSocket.Server({ noServer: true, perMessageDeflate: false });

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

const Utils = require('./utils')
wss.on('connection', async function connection(ws, request) {
  let closeConnection = await Utils.closeUnknownChargerConnection(request)
  if (closeConnection) return ws.terminate()

  const urlWithoutEndingBars = request.url.replace(/\/+$/, "");
  const chargeBoxIdentity = urlWithoutEndingBars.split("/").pop();

  ws.isAlive = true;
  ws.on('pong', () => { heartbeat(ws) });

  if (request.url !== "/")
    ws.id = chargeBoxIdentity;
  else
    ws.id = "1234"

  console.log(`New connection: Remote Address: ${request.connection.remoteAddress} - Id: ${chargeBoxIdentity}`);

  ws.on('message', function message(msg) {
    console.log(`Received message ${msg} from ${chargeBoxIdentity}`);

    let data;
    try {
      data = JSON.parse(msg);
    } catch (error) {
      ws.send("Error parsing message")
      return;
    }

    const messageType = data[0];
    const messageId = data[1];
    const operation = data[2];
    const payload = data[3];

    if (messageType === global.callResult || messageType === global.callError) {
      eventEmitter.emit(messageId, data[2]);
    }
    else {
      handlerRequest(messageId, operation, chargeBoxIdentity, request, payload).then((result) => {
        ws.send(JSON.stringify(result))
      });
    }

  });

  ws.on('close', function (data) {
    console.log("Charging station connection closed", ws.id);
    Utils.updateChargerStatusOnClose(chargeBoxIdentity)

    const trigger = global.triggeredByCP;
    const status = global.chargePointStatusEVIOFaulted;
    Utils.saveLog(
        chargeBoxIdentity,
        { event: "ws_close", source: "updateChargerStatusOnClose", data },
        { status, hwId: chargeBoxIdentity },
        false,
        "WebSocketClose",
        `WS connection closed, charger ${chargeBoxIdentity} marked as ${status}`,
        0,
        trigger
    );
  });


  ws.on('error', function (error) {
    console.log('Client error: ', error);
  });
});

wss.on('close', function close() {
  clearInterval(interval);
});

server.on('upgrade', function upgrade(request, socket, head) {
  wss.handleUpgrade(request, socket, head, function done(ws) {
    wss.emit('connection', ws, request);
  });
});

server.listen(ocppPort, () => {
  console.log(`OCPP16 Server Running on port ${ocppPort}`);
});

// sending ping every 10 seconds to verify the clients endpoint is still responsive
const interval = setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
    if (ws.isAlive === false) return ws.terminate();

    ws.isAlive = false;
    ws.ping(noop(ws));
  });
}, 30000);

function noop(ws) {
  // console.log("PING" , ws.id)
}

function heartbeat(ws) {
  // console.log("PONG" , ws.id)
  ws.isAlive = true;
}

const handlerRequest = (messageId, operation, chargeBoxIdentity, request, payload) => {
  return new Promise(function (resolve, reject) {

    const ip = Utils.getEndpoint(request.connection.remoteAddress, request.connection.remoteAddress);
    const endpoint = "ws://" + ip + request.url

    const args = { 'messageId': messageId, "chargeBoxIdentity": chargeBoxIdentity, "endpoint": endpoint };

    Utils.inteligentHeartBeat(chargerHeartBeatServiceProxy, chargeBoxIdentity , false);
    switch (operation) {
      case 'BootNotification':

        handlers.BootNotification.handle(args, payload, wss, eventEmitter).then(function (data) {

          console.log('BootNotification result: ' + JSON.stringify(data));
          resolve(data);

        });
        break;
      case 'Heartbeat':

        handlers.Heartbeat.handle(args).then(function (data) {

          console.log('Heartbeat result: ' + JSON.stringify(data));
          resolve(data);

        });
        break;
      case 'StatusNotification':
        handlers.StatusNotification.handle(args, payload).then(function (data) {
          console.log('StatusNotification result: ' + JSON.stringify(data));
          resolve(data);

        });
        break;
      case 'Authorize':
        handlers.Authorize.handle(args, payload).then(function (data) {

          console.log('Authorize result: ' + JSON.stringify(data));
          resolve(data);

        });
        break;
      case 'DataTransfer':
        handlers.DataTransfer.handle(args).then(function (data) {

          console.log('DataTransfer result: ' + JSON.stringify(data));
          resolve(data);

        });
        break;
      case 'DiagnosticsStatusNotification':
        handlers.DiagnosticsStatusNotification.handle(args, payload).then(function (data) {
          console.log('DiagnosticsStatusNotification result: ' + JSON.stringify(data));
          resolve(data);

        });
        break;
      case 'FirmwareStatusNotification':
        handlers.FirmwareStatusNotification.handle(args, payload).then(function (data) {
          console.log('FirmwareStatusNotification result: ' + JSON.stringify(data));
          resolve(data);

        });
        break;
      case 'MeterValues':
        handlers.MeterValues.handle(args, payload).then(function (data) {
          console.log('MeterValues result: ' + JSON.stringify(data));
          resolve(data);

        });
        break;
      case 'StartTransaction':
        handlers.StartTransaction.handle(args, payload).then(function (data) {
          console.log('StartTransaction result: ' + JSON.stringify(data));
          resolve(data);

        });
        break;
      case 'StopTransaction':
        handlers.StopTransaction.handle(args, payload).then(function (data) {
          console.log('StopTransaction result: ' + JSON.stringify(data));
          resolve(data);

        });
        break;
      default:
        console.error(`Operation not supported: ${operation}`)
        const response = [global.callError, messageId, {}];
        resolve(response);
    }
  });
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                              EVIO API
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const express = require('express')
const app = express()
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const bodyParser = require('body-parser');

const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true
};

connectionDB()
async function connectionDB() {
  await mongoose.connect(global.mongo_connection, options)
    .then(connection => {
      console.log("Database Connected");
    })
    .catch(err => {
      console.error(err)
    })
};

const Constants = require('./utils/constants');

if (Constants.environment !== 'development') {
  // eslint-disable-next-line global-require
  require('./middlewares/sentry')(app);
}

app.use(bodyParser.json({limit: '50mb'}))
app.use(bodyParser.urlencoded({limit: "50mb", extended: true, parameterLimit:50000}));

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
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: "50mb", extended: true, parameterLimit:50000}));
app.use(cookieParser());
app.use(cors());

app.get('/', (req, res) => {
  return res.send('OCPP-J microservice initialized!');
});

app.post('/api/private/connectionstation/ocppj/getConfiguration', (req, res) => {
  CS_TO_CP.getConfiguration.handle(req, res, wss, eventEmitter);
});

app.post('/api/private/connectionstation/ocppj/getConfigurationKeysDiff', (req, res) => {
  CS_TO_CP.getConfigurationKeysDiff.handle(req, res, wss, eventEmitter);
});

app.post('/api/private/connectionstation/ocppj/updateToEvioKeys', (req, res) => {
  CS_TO_CP.updateToEvioKeys.handle(req, res, wss, eventEmitter);
});

app.post('/api/private/connectionstation/ocppj/getEvioKeys', (req, res) => {
  CS_TO_CP.getEvioKeys.handle(req, res, wss, eventEmitter);
});

app.post('/api/private/connectionstation/ocppj/changeConfiguration', (req, res) => {
  CS_TO_CP.changeConfiguration.handle(req, res, wss, eventEmitter);
});

app.post('/api/private/connectionstation/ocppj/changeConfigurationv2', (req, res) => {
  CS_TO_CP.changeConfigurationv2.handle(req, res, wss, eventEmitter);
});

app.post('/api/private/connectionstation/ocppj/reset', (req, res) => {
  CS_TO_CP.reset.handle(req, res, wss, eventEmitter);
});

app.post('/api/private/connectionstation/ocppj/start', handleRemoteFunctionStart, async (req, res, next) => {
  if (req.useNewApproachStartSession) {
    await remoteStart(req, res, wss, eventEmitter);
  } else {
    CS_TO_CP.remoteStartTransaction.handle(req, res, wss, eventEmitter);
  }
});

app.post('/api/private/connectionstation/ocppj/stop', (req, res, next) => {
  CS_TO_CP.remoteStopTransaction.handle(req, res, wss, eventEmitter);
});

app.post('/api/private/connectionstation/ocppj/changeAvailability', (req, res, next) => {
  CS_TO_CP.changeAvailability.handle(req, res, wss, eventEmitter);
});

app.post('/api/private/connectionstation/ocppj/getLocalListVersion', (req, res, next) => {
  CS_TO_CP.getLocalListVersion.handle(req, res, wss, eventEmitter);
});

app.post('/api/private/connectionstation/ocppj/sendLocalList', (req, res, next) => {
  CS_TO_CP.sendLocalList.handle(req, res, wss, eventEmitter);
});

app.post('/api/private/connectionstation/ocppj/unlockConnector', (req, res, next) => {
  CS_TO_CP.unlockConnector.handle(req, res, wss, eventEmitter);
});

app.post('/api/private/connectionstation/ocppj/clearChargingProfile', (req, res, next) => {
  CS_TO_CP.clearChargingProfile.handle(req, res, wss, eventEmitter);
});

app.post('/api/private/connectionstation/ocppj/setChargingProfile', (req, res, next) => {
  CS_TO_CP.setChargingProfile.handle(req, res, wss, eventEmitter);
});

app.post('/api/private/connectionstation/ocppj/getCompositeSchedule', (req, res, next) => {
  CS_TO_CP.getCompositeSchedule.handle(req, res, wss, eventEmitter);
});

app.post('/api/private/connectionstation/ocppj/cancelReservation', (req, res, next) => {
  CS_TO_CP.cancelReservation.handle(req, res, wss, eventEmitter);
});

app.post('/api/private/connectionstation/ocppj/reserveNow', (req, res, next) => {
  CS_TO_CP.reserveNow.handle(req, res, wss, eventEmitter);
});

app.post('/api/private/connectionstation/ocppj/triggerMessage', (req, res, next) => {
  CS_TO_CP.triggerMessage.handle(req, res, wss, eventEmitter);
});

app.post('/api/private/connectionstation/ocppj/getDiagnostics', (req, res, next) => {
  CS_TO_CP.getDiagnostics.handle(req, res, wss, eventEmitter);
});

app.post('/api/private/connectionstation/ocppj/updateFirmware', (req, res, next) => {
  CS_TO_CP.updateFirmware.handle(req, res, wss, eventEmitter);
});

app.post('/api/private/connectionstation/ocppj/clearCache', (req, res, next) => {
  CS_TO_CP.clearCache.handle(req, res, wss, eventEmitter);
});

app.post('/api/private/connectionstation/ocppj/whitelist', (req, res, next) => {
  CS_TO_CP.getWhitelist.handle(req, res, wss, eventEmitter);
});

app.post('/api/private/connectionstation/ocppj/logs', (req, res, next) => {
  CS_TO_CP.getLogs.handle(req, res, wss, eventEmitter);
});

/////////////////////////////////////////////////
/////////////// COMMANDS OCPI CPO ///////////////
/////////////////////////////////////////////////
app.post('/api/private/ocppj/ocpi/unlockConnector', (req, res, next) => {
  CS_TO_CP.unlockConnectorOCPI.handle(req, res, wss, eventEmitter);
});

app.post('/api/private/ocppj/ocpi/start', (req, res, next) => {
  CS_TO_CP.remoteStartTransactionOCPI.handle(req, res, wss, eventEmitter);
});

// Huject uses this endpoint
app.post('/api/private/ocppj/ocpi/stop', (req, res, next) => {
  CS_TO_CP.remoteStopTransactionOCPI.handle(req, res, wss, eventEmitter);
});

/////////////////////////////////////////////////
////////// NEW REMO START WITH RETRIES //////////
/////////////////////////////////////////////////
app.post('/api/private/v2/connectionstation/ocppj/start', (req, res) => {
  remoteStart(req, res, wss, eventEmitter);
});

app.use(Sentry.Handlers.errorHandler());

const http_server = http.createServer(app);

http_server.listen(port, () => {
  console.log(`EVIO API Server Running on port ${port}`);
  Utils.cleanNotificationsHistory()
});
