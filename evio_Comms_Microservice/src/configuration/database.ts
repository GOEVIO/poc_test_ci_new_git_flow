import { IEnvDatabase } from '../interfaces/configurationsInterfaces';
import dotenv from 'dotenv';
dotenv.config();
// Loading process.env as IEnvDatabase interface
const getConfig = (): IEnvDatabase => {
    return {
        DB_URI: String(process.env.DB_URI).replace('{database}', 'commsDB'),
    };
};

export default getConfig();
