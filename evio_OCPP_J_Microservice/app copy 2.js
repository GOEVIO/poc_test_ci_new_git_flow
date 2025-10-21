const http = require('http');
const WebSocket = require('ws');
const url = require('url');

const server = http.createServer();
const wss1 = new WebSocket.Server({ noServer: true });
const wss2 = new WebSocket.Server({ noServer: true });

wss1.on('connection', function connection(ws, request) {
  console.log('test 1');
  const pathname = url.parse(request.url).pathname;
  var id = pathname.replace('/', '');
  console.log(pathname);
  ws.id = id;

  ws.on('message', function message(msg) {
    console.log(`Received message ${msg} `);
  });

  
  ws.send('something 3');
  // ...
});

wss2.on('connection', function connection(ws) {
  
  ws.send('something 4');
  // ...
});

server.on('upgrade', function upgrade(request, socket, head) {
  const pathname = url.parse(request.url).pathname;

  //console.log(wss1.clients.size);
  wss1.handleUpgrade(request, socket, head, function done(ws) {
    wss1.emit('connection', ws, request);
  });
  // if (pathname === '/ws1') {
  //   wss1.handleUpgrade(request, socket, head, function done(ws) {
  //     wss1.emit('connection', ws, request);
  //   });
  // } else if (pathname === '/ws2') {
  //   wss2.handleUpgrade(request, socket, head, function done(ws) {
  //     wss2.emit('connection', ws, request);
  //   });
  // } 
  // else {
  //   socket.destroy();
  // }
});

server.listen(3014);

///////////////////////////////////////////////////
const express = require('express')
const app = express()
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const helmet = require('helmet');
var cors = require('cors');
var bodyParser = require('body-parser');
const port = process.env.NODE_ENV === 'production' ? 3014 : 3015;

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

app.get('/', (req, res) => {
  return res.send('OCPP-J microservice initialized!');
});

app.post('/test', (req, res) => {
  wss1.clients.forEach(function each(client) {

    if (client.readyState === WebSocket.OPEN) {
      client.send("test DC");
    }
  });
  return res.send('test');
});

app.post('/send', (req, res) => {
  let clients = Array.from(wss1.clients);
  var clientt = clients.filter(client => client.id = 123456789)
  console.log(clientt.id)
  if (client.readyState === WebSocket.OPEN) {
    client.send("test DC 2");
  }
});

var http_server = http.createServer(app);

http_server.listen(port, () => {
  console.log(`Running on port ${port}`);
});