const http = require('http');
const app = require('./configs/server');
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
};

let server = http.createServer(app);
server.listen(port, () => {
    console.log(`Running on port ${port}`);
});