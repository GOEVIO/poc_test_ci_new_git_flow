import { IEnvSentry } from '../interfaces/sentry.interface';

const getConfig = (): IEnvSentry => ({
    dsn: String(process.env.DSN),
    traceSampleRate: Number(process.env.TRACES_SAMPLE_RATE),
    profilesSampleRate: Number(process.env.PROFILES_SAMPLE_RATE),
});

export default getConfig();
