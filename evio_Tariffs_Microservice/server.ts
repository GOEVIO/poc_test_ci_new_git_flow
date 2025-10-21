import http from 'http';
import mongoose from 'mongoose';
import app from './app';
import dotenvSafe from 'dotenv-safe';
import Constants from './utils/constants';
import toggle from 'evio-toggle';

dotenvSafe.config();

const customOutput = (err = false) => (...args: any[]) => {
    const formattedArgs = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : arg
    ).join(' ');
    (err ? process.stderr : process.stdout).write(`${formattedArgs}\n`);
};
console.log = customOutput();
console.error = customOutput(true);

const connectionDB = async () => {
    try {
        const conn = await mongoose.connect(Constants.mongo.URI, Constants.mongo.options);
        console.log(`Connected to MongoDB: ${conn.connection.name}`);
    } catch (e) {
        console.error('MongoDB connection error', e);
        process.exit(1);
    }
};

const start = async () => {
    await connectionDB();

    const port = Constants.environment === 'production' ? Constants.port : Constants.port_dev;
    const server = http.createServer(app);

    server.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
};

start();
