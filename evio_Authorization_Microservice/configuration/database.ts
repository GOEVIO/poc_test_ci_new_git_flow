import { IEnvDatabase } from '../interfaces/configurations.interface';

// Loading process.env as IEnvDatabase interface
const getConfig = (): IEnvDatabase => ({
    dbUri:  String(process.env.DB_URI).replace('{database}', 'tokenDB'),
});

export default getConfig();
