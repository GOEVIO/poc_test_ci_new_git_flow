import Constants from './utils/constants';
import app from './app';

// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv-safe').load();

const http = require('http');
const mongoose = require('mongoose');
const Process = require('process');
const JobCardCSV = require('./handlers/jobCardCSV');

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
    try {
        const connection = await mongoose.connect(Constants.mongo.URI, Constants.mongo.options);
        console.log(`Connected to ${connection.connections[0].name}`);
    } catch (e: any) {
        console.log(`${Constants.mongo.URI} Error`, e);
        Process.exit(0);
    }
};

const start = async () => {
    const server = http.createServer(app);
    const port = Constants.environment === 'production' ? process.env.PORT : process.env.PORT_DEV;

    switch (Constants.environment) {
        case 'production':
            console.log('Initing production environment');
            break;
        case 'development':
            console.log('Initing dev environment');
            break;
        case 'pre-production':
            console.log('Initing pre environment');
            break;
        default:
            console.log('Unknown environment');
            break;
    }

    await connectionDB();
    server.listen(port, () => {
        console.log(`Running on port:  ${port}`);
        // JobCardCSV.startCardsJob().then(() => {
        //     console.log('Started Santogal CSV Job');
        // }).catch((error: any) => {
        //     console.log('---> Error - Fail to start Santogal CSV Job ', error);
        // });
    });
};

start();
