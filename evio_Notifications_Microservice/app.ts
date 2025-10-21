import dotenv from 'dotenv-safe';
dotenv.config();
import http from 'http';
import express, { Express, Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import helmet from 'helmet';
import cors from 'cors';
import Process from 'process';
import mongoose from 'mongoose';
import * as Sentry from '@sentry/node';

// Controllers
import smsNotificationController from './controllers/smsNotifications.controller';

// Routes
import plugAvailableRouter from './routes/plugAvailable';
import appVersionsRouter from './routes/AppVersions';
import mailNotificationRouter from './routes/mailNotification';
import firebaseNotificationsRouter from './routes/FirebaseNotifications';
import firebaseNotificationTokenHandlerRouter from './routes/FirebaseNotificationTokenHandler';
import notifymeHistoryRouter from './routes/notifymeHistory';
import firebaseNotificationHandlerTokensRouter from './routes/FirebaseNotificationHandlerTokens';
import supportRouter from './routes/Support';
import usersNotificationsRouter from './routes/usersNotifcations';
import wlMailNotificationRouter from './routes/wl/mailNotification';

// Custom console output
const customOutput = (err: boolean = false) => (...args: any[]) => {
  const formattedArgs = args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg) : arg
  ).join(' ');
  
  if (err) {
    process.stderr.write(`${formattedArgs}\n`);
    return;
  }
  process.stdout.write(`${formattedArgs}\n`);
};

console.log = customOutput();
console.info = customOutput();
console.warn = customOutput();
console.error = customOutput(true);

console.log("Environment", process.env.NODE_ENV);
const port = process.env.NODE_ENV === 'production' ? process.env.PORT : process.env.PORT_DEV;

switch (process.env.NODE_ENV) {
  case 'production':
    console.log("Initializing production environment");
    break;
  case 'development':
    console.log("Initializing dev environment");
    break;
  case 'pre-production':
    console.log("Initializing pre environment");
    break;
  default:
    console.log("Unknown environment");
    break;
}

const app: Express = express();
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  retryWrites: true
};

// Database connection
async function connectionDB() {
  const connString = String(process.env.DB_URI).replace('{database}', 'notificationsDB');
  try {
    const connection = await mongoose.connect(connString, options);
    console.log(`Connected to ${connection.connections[0].name}`);
  } catch (err: any) {
    console.log(`[${connString}] Error`, err.message);
    Process.exit(0);
  }
}

connectionDB();

// Sentry initialization (only in non-development environments)
if (process.env.NODE_ENV !== 'development') {
  require('./middlewares/sentry')(app);
}

// Custom morgan logger
logger.token('req-body', (req: Request) => JSON.stringify(req.body) || '{}');
logger.token('res-size', (req: Request, res: Response) => res.get('Content-Length') || '0');
logger.token('req-headers', (req: Request) => JSON.stringify(req.headers));

app.use(
  logger((tokens: any, req: Request, res: Response) => {
    const status = tokens.status(req, res);
    const responseTime = tokens['response-time'](req, res);
    const log = {
      method: tokens.method(req, res),
      url: tokens.url(req, res),
      status: status ? parseInt(status) : 0,
      responseTime: responseTime ? parseFloat(responseTime) : 1,
      reqHeaders: JSON.parse(tokens['req-headers'](req)),
      reqBody: JSON.parse(tokens['req-body'](req)),
      resSize: `${tokens['res-size'](req, res)} bytes`,
      logType: 'httpRequest',
    };
    return JSON.stringify(log);
  })
);

// Middlewares
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));
app.use(cookieParser());
app.use(cors());


// Controllers
app.use(smsNotificationController);

// Routes
app.use(plugAvailableRouter);
app.use(appVersionsRouter);
app.use(mailNotificationRouter);
app.use(firebaseNotificationsRouter);
app.use(firebaseNotificationTokenHandlerRouter);
app.use(notifymeHistoryRouter);
app.use(firebaseNotificationHandlerTokensRouter);
app.use(supportRouter);
app.use(usersNotificationsRouter);
app.use(wlMailNotificationRouter);

// Health check endpoint
app.get("/api/private/healthCheck", (req: Request, res: Response) => {
  return res.status(200).send("OK");
});

// Error handler (only in non-development environments)
if (process.env.NODE_ENV !== 'development') {
  app.use(Sentry.Handlers.errorHandler());
}

// Create and start server
const server = http.createServer(app);
server.listen(port, () => {
  console.log(`Running on port: ${port}`);
});

// Export for testing
export default app;