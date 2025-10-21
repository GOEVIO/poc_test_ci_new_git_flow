const express = require('express');
const cookieParser = require('cookie-parser'); //Parse of coockies on the requests
const logger = require('morgan'); //Logger package to know what is happennig with api gateway
const helmet = require('helmet'); //Package that offers some security to api gateway
const cors = require('cors');
const Process = require('process');
const app = express();
const mongoose = require('mongoose');
require("dotenv-safe").load();

//mongoose.connect('mongodb://localhost:27017/questionsDB')
const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    keepAlive: true
};

connectionDB()
async function connectionDB() {
    const connString = String(process.env.DB_URI).replace('{database}', 'questionsDB');
    await mongoose.connect(connString, options)
        .then(connection => {
            console.log(`Connected to ${connection.connections[0].name}`);
        })
        .catch(err => {
            console.log(`[${connString}] Error`, err);
            Process.exit(0);
        });
};


app.use(cors());
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

app.use(require('../routes/questions'));

app.get('/api/private/healthCheck', (req, res) => {
    return res.status(200).send('OK');
});

module.exports = app;