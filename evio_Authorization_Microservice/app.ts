// @ts-nocheck

import http from 'http';
import express from 'express';
import cookieParser from 'cookie-parser'; // Parse of coockies on the requests
import logger from 'morgan'; // Logger package to know what is happennig with api gateway
import helmet from 'helmet'; // Package that offers some security to api gateway
import cors from 'cors';
import mongoose from 'mongoose';
import Process from 'process';
import bodyParser from 'body-parser';
//import Sentry from '@sentry/node';
import * as Sentry from '@sentry/node';
import { database, microservice } from './configuration';
import sentryMiddleware from './middlewares/sentry';
import authenticationRoutes from './routes/authentication';

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

const app = express();
const port =
    microservice.nodeEnv === 'production'
        ? microservice.port
        : microservice.portDev;

console.log(`Initializing ${microservice.nodeEnv ?? 'Unknown'} environment`);

const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    keepAlive: true,
};

async function connectionDB() {
    await mongoose
        .connect(database.dbUri, options)
        .then((connection) => {
            console.log(`Connected to ${connection.connections[0].name}`);
        })
        .catch((err) => {
            console.log(`[${database.dbUri}] Error ${err.message}`);
            Process.exit(0);
        });
}
connectionDB();
if (microservice.nodeEnv !== 'development')sentryMiddleware(app);

app.use(bodyParser.json({ limit: '1000kb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '1000kb' }));

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
app.use(cookieParser());
app.use(cors());

app.use(authenticationRoutes);

app.get('/api/private/healthCheck', (req, res) => res.status(200).send('OK'));

// The error handler must be registered before any other error middleware and after all controllers
if (microservice.nodeEnv !== 'development') app.use(Sentry.Handlers.errorHandler());

const server = http.createServer(app);
server.listen(port, () => {
    console.log(`Running on port ${port}`);
});
