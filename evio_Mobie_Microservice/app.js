var http = require('http');
const express = require('express')
const app = express()
var cookieParser = require('cookie-parser'); //Parse of coockies on the requests
var logger = require('morgan'); //Logger package to know what is happennig with api gateway
const helmet = require('helmet'); //Package that offers some security to api gateway
var cors = require('cors');
require("dotenv-safe").load();
const bodyParser = require('body-parser');
const Process = require('process');

app.use(bodyParser.json());

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

const mongoose = require('mongoose');

const connString = String(process.env.DB_URI).replace('{database}', 'mobieDB');
mongoose.connect(connString, { useNewUrlParser: true })
  .catch(err => {
    console.log(`[${connString}] Error`, err);
    Process.exit(0);
  });

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
app.use(express.json({ limit: '1000kb' }));
app.use(express.urlencoded({ extended: false, limit: '1000kb' }));
app.use(cookieParser());
app.use(cors());

app.use(require('./routes/mobie'));
app.use(require('./routes/mobieDB'));

app.get('/api/public/healthCheck', (req, res) => {
  return res.status(200).send('Ok');
});

const port_http = process.env.PORT_HTTP;
var httpServer = http.createServer(app);
httpServer.listen(port_http, () => {
  console.log("HTTP server running on port: " + port_http)
})