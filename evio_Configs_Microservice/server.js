const mongoose = require('mongoose');
const Process = require('process');
const http = require('http');
const app = require('./app');
const Constants = require('./utils/constants');
const { cacheFees } = require('./caching/cache');

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

const connectionDB = async () => {
  const connString = String(process.env.DB_URI).replace('{database}', 'configsDB');

  try {
    const connection = await mongoose.connect(connString, Constants.mongo.options);
    console.log(`Connected to ${connection.connections[0].name}`);
  } catch (error) {
    console.log(`[${connString}] Error`, error);
    Process.exit(0);
  }
};

const start = async () => {
  const server = http.createServer(app);
  console.log('Environment', Constants.environment);
  const port = Constants.environment === 'production' ? process.env.PORT : process.env.PORT_DEV;

  switch (Constants.environment) {
    case 'production':
      console.log('Initialing production environment');
      break;
    case 'pre-production':
      console.log('Initialing pre environment');
      break;
    case 'development':
      console.log('Initialing dev environment');
      break;
    default:
      console.log('Unknown environment');
      break;
  }

  await connectionDB();
  await cacheFees();

  server.listen(port, () => {
    console.log(`Running on port:  ${port}`);
  });
};

start();
