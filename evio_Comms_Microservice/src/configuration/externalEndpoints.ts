import { IEnvExternalEndpoints } from '../interfaces/configurationsInterfaces';
import dotenv from 'dotenv';
dotenv.config();

// Loading process.env as IEnvDatabase interface
const getConfig = (): IEnvExternalEndpoints => {
    return {
        CHARGERS_HOST: String(process.env.CHARGERS_HOST),
        CHARGER_UPDATE_CONTROLLERS: String(process.env.CHARGER_UPDATE_CONTROLLERS),
        CHARGER_UPDATE_DEVICE_INFO: String(process.env.CHARGER_UPDATE_DEVICE_INFO),
        CHARGER_UPDATE_DEVICE_MEASUREMENTS: String(process.env.CHARGER_UPDATE_DEVICE_MEASUREMENTS),
        CHARGER_UPDATE_SWITCHBOARDS_CHARGINGMODES: String(process.env.CHARGER_UPDATE_SWITCHBOARDS_CHARGINGMODES),
        CHARGER_UPDATE_SWITCHBOARDS_LISTCHARGINGMODES: String(process.env.CHARGER_UPDATE_SWITCHBOARDS_LISTCHARGINGMODES),
        CHARGER_UPDATE_OFFLINE_START: String(process.env.CHARGER_UPDATE_OFFLINE_START),
        CHARGER_UPDATE_CONTROLLER_CONNECTION_STATUS: String(process.env.CHARGER_UPDATE_CONTROLLER_CONNECTION_STATUS),
    };
};

export default getConfig();
