require("dotenv-safe").load();
const http = require('http');
const express = require('express')
const app = express()
const cookieParser = require('cookie-parser'); //Parse of coockies on the requests
const helmet = require('helmet'); //Package that offers some security to api gateway
const cors = require('cors');
const Process = require('process');
const Sentry = require('@sentry/node');
const morgan = require('morgan');

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


//mongoose.connect('mongodb://localhost:27017/statisticsDB')
const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    keepAlive: true
};

connectionDB()
async function connectionDB() {
    const connString = String(process.env.DB_URI).replace('{database}', 'statisticsDB');
    await mongoose.connect(connString, options)
        .then(connection => {
            console.log(`Connected to ${connection.connections[0].name}`);
        })
        .catch(err => {
            console.log(`[${connString}] Error`, err);
            Process.exit(0);
        });
};

// Enabling for all environments
require('./middlewares/sentry')(app);

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


app.use(cors());

app.use(helmet());
app.use(express.json({ limit: '10000kb' }));
app.use(express.urlencoded({ extended: false, limit: '10000kb' }));
app.use(cookieParser());

app.use('/api/private/insights_v2', require('./routes/insights'));
app.use('/api/private/history_v2', require('./routes/history'));
app.use('/api/private/reports', require('./routes/reports'));
app.use('/evioapi/chargingsessions/history', require('./routes/historyExternalAPI'));

app.get('/api/private/healthCheck', (req, res) => {
    return res.status(200).send('OK');
});

// The error handler must be registered before any other error middleware and after all controllers
app.use(Sentry.Handlers.errorHandler());

var server = http.createServer(app);

server.listen(port, () => {
    console.log(`Running on port ${port}`);
});
