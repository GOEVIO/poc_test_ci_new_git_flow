var http = require('http');
const express = require('express')
const app = express()
var cookieParser = require('cookie-parser'); //Parse of coockies on the requests
var logger = require('morgan'); //Logger package to know what is happennig with api gateway
const helmet = require('helmet'); //Package that offers some security to api gateway
var cors = require('cors');
require("dotenv-safe").load();

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

const port = process.env.NODE_ENV === 'production' ? 3012 : 3012;

app.get('/', (req, res) => {
    res.send('Connection Station initialized!');
});

var bodyParser = require('body-parser');

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
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(cors());

app.get('/api/private/healthCheck', (req, res) => {
    return res.status(200).send('OK');
});

let OperationCenter = require('./cpcl/entities/OperationCenter')(8091);

var cluster = require('cluster');
if (cluster.isMaster) {

    var server = http.createServer(app);

    server.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });

    app.use(require('./routes/OperationCenter'));

} else {
    const ConnectionHandler = require('./cpcl/entities/ConnectionHandler');
    let ConnectionHandlerWorker = new ConnectionHandler();
}
