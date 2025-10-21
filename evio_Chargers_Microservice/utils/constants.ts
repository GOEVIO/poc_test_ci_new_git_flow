import dotenv from 'dotenv-safe';
import * as process from 'process';

dotenv.config();

export default {
    mongo: {
        options: {
            useNewUrlParser: Boolean(process.env.DB_OPTION_USENEWURLPARSER) || true,
            useUnifiedTopology: Boolean(process.env.DB_OPTION_USEUNIFIEDTOPOLOGY) || true,
            keepAlive: Boolean(process.env.DB_OPTION_KEEPALIVE) || true,
            dbName: 'chargersDB',
        },
        URI: String(process.env.DB_URI).replace('{database}', 'chargersDB'),
    },
    environment: String(process.env.NODE_ENV) || 'development',
    port: Number(process.env.PORT) || 3002,
    port_dev: Number(process.env.PORT_DEV) || 3002,
    comms_endpoints: {
        HostComms: String(process.env.HostComms) || 'http://comms:3036',
        UpdateCommsDevices: String(process.env.UpdateCommsDevices) || '/api/private/controller',
        UpdateCommsChargingMode: String(process.env.UpdateCommsChargingMode) || '/api/private/controller/ChargingMode',
        UpdateCommsSetpoints: String(process.env.UpdateCommsSetpoints) || '/api/private/controller/publishTopic',
    },
    controllers: {
        model: {
            SmartBox_v1: String(process.env.ControllerModelSmartBoxV1) || 'smartBox_v1',
            Siemens_A8000: String(process.env.ControllerModelA8000) || 'Siemens_A8000',
        },
    },
    translationKeys: {
        TranslationChargingMode: String(process.env.TranslationChargingMode) || 'ChargingMode',
    },
    providers: {
        sentry: {
            dsn: String(process.env.sentryDsnKey) || '',
            traceSampleRate: Number(process.env.SENTRY_TRACE_SAMPLE_RATE) || 0.01,
            profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE) || 0.01,
            ignoredTransactions: [],
        },
    },
    devicesCommsSetPoints: {
        Charging_Mode: String(process.env.Charging_Mode) || 'Charging_Mode',
        Sharing_Mode: String(process.env.Sharing_Mode) || 'Sharing_Mode',
        A_Limit: String(process.env.A_Limit) || 'A_Limit',
        A_Min_Solar: String(process.env.A_Min_Solar) || 'A_Min_Solar',
    },
    sessionHistoryV2RabbitmqQueue: String(process.env.RABBITMQ_QUEUE_SESSION_HISTORY_V2) || 'session_history_v2',
    publicNetWorkEndPoints: {
        HostPublicNetWork: String(process.env.HostPublicNetWork) || 'http://public-network:3029',
        PathGetOperator: String(process.env.PathGetOperator) || '/api/public/operators'
    },
    paymentV2: {
        host: process.env.HostPaymentV2 || 'http://payments-v2:6002',
        pathUpdateSimulation: process.env.PathUpdateSimulationEndpoint || '/api/private/payments/v2/simulation/v1'
    },
    postgresql: {
        host: String(process.env.Postgres_Host),
        port: Number(process.env.Postgres_Port),
        user: String(process.env.Postgres_User),
        password: String(process.env.Postgres_Pass),
    },
    qrCodeLink: 'https://link.go-evio.com/qrcode?id=',
    hosts: {
        users: String(process.env.HostUser) || 'http://identity:3003',
        tariffs: String(process.env.HostTariffs) || 'http://tariffs:3009',
        evs: String(process.env.HostEvs) || 'http://evs:3006',
    },
    paths: {
        groupCSUsersMap: String(process.env.PathGetGroupCSUsersMap) || '/api/private/groupCSUsers/map',
        multiTariffById: String(process.env.PathGetMultiTariffById) || '/api/private/salesTariff/multiTariffById',
        getTariff: String(process.env.PathGetTariff) || '/api/private/salesTariff/byIdForCharger',
        getToAddOnChargerB2B: String(process.env.PathToAddOnChargerB2B) || '/api/private/fleets/toAddOnChargerB2B',
        getGroupCSUsersV2: '/api/private/groupCSUsers',
    },
    operationalStatus: {
        approved: String(process.env.OperationalStatusApproved ) || 'APPROVED',
        waitingAproval: String(process.env.OperationalStatusWaitingAproval ) || 'WAITINGAPROVAL',
        removed: String(process.env.OperationalStatusRemoved ) || 'REMOVED',
    },
    chargerAccess: {
        public: String(process.env.ChargerAccessPublic ) || 'Public',
        private: String(process.env.ChargerAccessPrivate ) || 'Private',
        restrict: String(process.env.ChargerAccessRestrict ) || 'Restrict',
        freeCharge: String(process.env.ChargerAccessFreeCharge ) || 'FreeCharge',
        plugAndCharge: String(process.env.ChargerAccessPlugAndCharge ) || 'PlugAndCharge',
    },
    clientType: {
        backOficce: String(process.env.ClientTypeBackOffice) || 'BackOffice'
    },
    title: {
        mobile: 'Mobile',
        cardEVIO: 'EVIO card'
    }
};
