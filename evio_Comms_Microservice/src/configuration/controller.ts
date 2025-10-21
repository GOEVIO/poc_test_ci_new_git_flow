import * as controllerInterfaces from '../interfaces/configurationsInterfaces';
import dotenv from 'dotenv';
dotenv.config();

// Loading process.env as IEnvDatabase interface
const getConfig = (): controllerInterfaces.IEnvController => {
    return {
        PROTOCOL: getConfigProtocol(),
        MODELS: getConfigModels(),
        STRATEGIES: getConfigStrategies(),
        CHARGINGMODES: getConfigChargingModes(),
        DEVICETYPES: getConfigDeviceTypes(),
    };
};

const getConfigStrategies = (): controllerInterfaces.IEnvStrategies => {
    return {
        STRATEGY_SOLAR_MODE: String(process.env.STRATEGY_SOLAR_MODE),
        STRATEGY_BASE_MODE: String(process.env.STRATEGY_BASE_MODE),
        ALLOW_STRATEGIES: [String(process.env.STRATEGY_SOLAR_MODE), String(process.env.STRATEGY_BASE_MODE)],
    };
};

const getConfigProtocol = (): controllerInterfaces.IEnvControllerProtocols => {
    return {
        PROTOCOL_MQTT: String(process.env.PROTOCOL_MQTT),
        ALLOW_PROTOCOLS: [String(process.env.PROTOCOL_MQTT)],
    };
};
const getConfigChargingModes = (): controllerInterfaces.IEnvChargingModes => {
    return {
        ALLOW_CHARGINGMODES: [
            String(process.env.CHARGINGMODE_SOLAR),
            String(process.env.CHARGINGMODE_BASE),
            String(process.env.CHARGINGMODE_BASE),
            String(process.env.CHARGINGMODE_UNKNOWN),
            String(process.env.CHARGINGMODE_NO),
        ],
        CHARGINGMODE_SOLAR: String(process.env.CHARGINGMODE_SOLAR),
        CHARGINGMODE_BASE: String(process.env.CHARGINGMODE_BASE),
        CHARGINGMODE_UNKNOWN: String(process.env.CHARGINGMODE_UNKNOWN),
        CHARGINGMODE_NO: String(process.env.CHARGINGMODE_NO),
    };
};
const getConfigModels = (): controllerInterfaces.IEnvControllerModels => {
    return {
        MODEL_SMARTBOX_V1: String(process.env.MODEL_SMARTBOX_V1),
        MODEL_SIEMENS_A8000: String(process.env.MODEL_SIEMENS_A8000),
        ALLOW_MODELS: [String(process.env.MODEL_SMARTBOX_V1), String(process.env.MODEL_SIEMENS_A8000)],
    };
};

const getConfigDeviceTypes = (): controllerInterfaces.IEnvDeviceTypes => {
    return {
        CHARGER: String(process.env.DEVICE_TYPE_CHARGER),
        PV: String(process.env.DEVICE_TYPE_PV),
        BATTERY: String(process.env.DEVICE_TYPE_BATTERY),
        ALLOW_DEVICE_TYPES: [String(process.env.DEVICE_TYPE_CHARGER), String(process.env.DEVICE_TYPE_PV), String(process.env.DEVICE_TYPE_BATTERY)],
    };
};
export default getConfig();
