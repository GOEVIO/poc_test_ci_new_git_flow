export interface IEnvMicroservice {
    PORT: number;
    PORT_DEV: number;
    NODE_ENV: string;
    DELAY_START_REQUEST: number;
    START_REQUEST_FAIL_ATTEMPTS_TO_REPORT: number;
}

export interface IEnvDatabase {
    DB_URI: string;
}

export interface IEnvMQTT {
    BROKER_URL: string;
    BROKER_PORT: number;
    BROKER_USERNAME: string;
    BROKER_PASSWORD: string;
    CRON_ONLINE_STATUS: string;
    OFFLINE_TIME: number;
}
export interface IEnvExternalEndpoints {
    CHARGERS_HOST: string;
    CHARGER_UPDATE_CONTROLLERS: string;
    CHARGER_UPDATE_DEVICE_INFO: string;
    CHARGER_UPDATE_DEVICE_MEASUREMENTS: string;
    CHARGER_UPDATE_SWITCHBOARDS_CHARGINGMODES: string;
    CHARGER_UPDATE_SWITCHBOARDS_LISTCHARGINGMODES: string;
    CHARGER_UPDATE_OFFLINE_START: string;
    CHARGER_UPDATE_CONTROLLER_CONNECTION_STATUS: string;
}

export interface IEnvControllerProtocols {
    ALLOW_PROTOCOLS: string[];
    PROTOCOL_MQTT: string;
}

export interface IEnvStrategies {
    ALLOW_STRATEGIES: string[];
    STRATEGY_SOLAR_MODE: string;
    STRATEGY_BASE_MODE: string;
}
export interface IEnvChargingModes {
    ALLOW_CHARGINGMODES: string[];
    CHARGINGMODE_SOLAR: string;
    CHARGINGMODE_BASE: string;
    CHARGINGMODE_UNKNOWN: string;
    CHARGINGMODE_NO: string;
}
export interface IEnvControllerModels {
    ALLOW_MODELS: string[];
    MODEL_SMARTBOX_V1: string;
    MODEL_SIEMENS_A8000: string;
}

export interface IEnvDeviceTypes {
    ALLOW_DEVICE_TYPES: string[];
    CHARGER: string;
    PV: string;
    BATTERY: string;
}
export interface IEnvController {
    PROTOCOL: IEnvControllerProtocols;
    MODELS: IEnvControllerModels;
    STRATEGIES: IEnvStrategies;
    CHARGINGMODES: IEnvChargingModes;
    DEVICETYPES: IEnvDeviceTypes;
}
export interface IEnvSentry {
    DSN: string;
    TRACE_SAMPLE_RATE: number;
    PROFILES_SAMPLE_RATE: number;
}
export interface IEnv {
    MICROSERVICE: IEnvMicroservice;
    DATABASE: IEnvDatabase;
    MQTT: IEnvMQTT;
    ENDPOINTS: IEnvExternalEndpoints;
    CONTROLLER: IEnvController;
    SENTRY: IEnvSentry;
}
