import { IEnvSentry } from '../interfaces/configurationsInterfaces';
import dotenv from 'dotenv';
dotenv.config();

const getConfig = (): IEnvSentry => ({
    DSN: String(process.env.DSN),
    TRACE_SAMPLE_RATE: Number(process.env.TRACE_SAMPLE_RATE) | 0.1,
    PROFILES_SAMPLE_RATE: Number(process.env.PROFILES_SAMPLE_RATE) | 0.1,
});

export default getConfig();