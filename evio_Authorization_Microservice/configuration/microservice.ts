import { IEnvMicroservice } from '../interfaces/configurations.interface';

// Loading process.env as IEnvMicroservice interface
const getConfig = (): IEnvMicroservice => ({
    port: Number(process.env.PORT),
    portDev: Number(process.env.PORT_DEV),
    nodeEnv: String(process.env.NODE_ENV),
});

export default getConfig();
