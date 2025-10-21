const http = require('http');
const app = require('./app');
const Constants = require('./utils/constants');

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

  server.listen(port, () => {
    console.log(`Running on port:  ${port}`);
  });
};

start();
