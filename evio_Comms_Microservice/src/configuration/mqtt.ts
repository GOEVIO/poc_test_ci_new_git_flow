import { IEnvMQTT } from '../interfaces/configurationsInterfaces';
import dotenv from 'dotenv';
dotenv.config();

// Loading process.env as IEnvMQTT interface
const getConfig = (): IEnvMQTT => {
    return {
        BROKER_URL: String(process.env.BROKER_URL),
        BROKER_PORT: Number(process.env.BROKER_PORT),
        BROKER_USERNAME: String(process.env.BROKER_USERNAME),
        BROKER_PASSWORD: String(process.env.BROKER_PASSWORD),
        CRON_ONLINE_STATUS: String(process.env.CRON_ONLINE_STATUS),
        OFFLINE_TIME: Number(process.env.OFFLINE_TIME),
    };
};

export default getConfig();
