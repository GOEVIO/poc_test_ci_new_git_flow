import { IEnvMicroservice } from '../interfaces/configurationsInterfaces';
import dotenv from 'dotenv';
dotenv.config();

// Loading process.env as IEnvMicroservice interface
const getConfig = (): IEnvMicroservice => {
    return {
        PORT: Number(process.env.PORT),
        PORT_DEV: Number(process.env.PORT_DEV),
        NODE_ENV: String(process.env.NODE_ENV),
        DELAY_START_REQUEST: Number(process.env.DELAY_START_REQUEST),
        START_REQUEST_FAIL_ATTEMPTS_TO_REPORT: Number(process.env.START_REQUEST_FAIL_ATTEMPTS_TO_REPORT),
    };
};

export default getConfig();
