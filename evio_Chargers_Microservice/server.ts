import Constants from './utils/constants';
import app from './app';
import http from 'http';
import mongoose from 'mongoose';
import Process from 'process';
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv-safe').load();

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
    const port = Constants.environment === 'production' ? Constants.port : Constants.port_dev;

    switch (Constants.environment) {
        case 'production':
        case 'development':
        case 'pre-production':
            console.log(`Initiating ${Constants.environment} environment`);
            break;
        default:
            console.log('Unknown environment');
            break;
    }

    await connectionDB();
    server.listen(port, () => {
        console.log(`Running on port ${port}`);
    });
};

start();
