//import dotenv_safe from 'dotenv/config';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import env from './configuration/index';
import http from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import helmet from 'helmet';
import mongoose from 'mongoose';
import Process from 'process';
import cors from 'cors';
import bodyParser from 'body-parser';
import { isUnsetKeysVariables } from './validator/objectValidator';
import mqttHandler from './controllers/mqttController';
import * as Sentry from '@sentry/node';
import controllersRoute from './routes/controllersRoute';
import healthCheckRoute from './routes/healthCheckRoute';
import deviceRoute from './routes/deviceRoute';
import sentryMiddleware from './middleware/sentryMiddleware';
import startController from './controllers/startMicroserviceController'

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

if (isUnsetKeysVariables(env)) {
    console.error('[Comms app] Error - There are missing environment values !!');
    throw new Error('There are missing environment values !!!!');
}

const app = express();
const port = env.MICROSERVICE.NODE_ENV === 'production' ? env.MICROSERVICE.PORT : env.MICROSERVICE.PORT_DEV;

switch (env.MICROSERVICE.NODE_ENV) {
    case 'production':
        console.log('initiating production environment');
        break;
    case 'development':
        console.log('initiating dev environment');
        break;
    case 'pre-production':
        console.log('initiating pre environment');
        break;
    default:
        console.log('Unknown environment');
        break;
}
async function connectionDB() {
    await mongoose
        .connect(env.DATABASE.DB_URI)
        .then((connection) => {
            console.log(`Connected to ${connection.connections[0].name}`);
        })
        .catch((err) => {
            console.log(`[${env.DATABASE.DB_URI}] Error ${err.message}`);
            Process.exit(0);
        });

    mongoose.connection.on('error', (err) => {
        console.log(`[${env.DATABASE.DB_URI}] Connection error - ${err.message}`);
        Process.exit(0);
    });

    mongoose.connection.on('disconnect', (err) => {
        console.log(`[${env.DATABASE.DB_URI}] Connection disconnected - ${err.message}`);
        Process.exit(0);
    });
}
connectionDB();
if (env.MICROSERVICE.NODE_ENV !== 'development') sentryMiddleware(app);

app.use(bodyParser.json({ limit: '5000mb' }));
app.use(
    bodyParser.urlencoded({
        limit: '5000mb',
        extended: true,
        parameterLimit: 50000,
    })
);
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
app.use(express.json({ limit: '5000mb' }));
app.use(
    express.urlencoded({
        limit: '5000mb',
        extended: true,
        parameterLimit: 50000,
    })
);
app.use(cookieParser());
app.use(cors());
app.use(controllersRoute);
app.use(healthCheckRoute);
app.use(deviceRoute);

if (env.MICROSERVICE.NODE_ENV !== 'development') app.use(Sentry.Handlers.errorHandler());

const server = http.createServer(app);
server.listen(port, async () => {
    console.log(`Running on port:  ${port}`);
    await startController.sendStartOffline()
    mqttHandler.startMQTT().catch((error) => {
        console.error(`[app startMQTT] Error - ${error.message}`);
    });
});
