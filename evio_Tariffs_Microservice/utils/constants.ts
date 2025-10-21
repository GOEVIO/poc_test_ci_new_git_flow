import { equal } from 'assert';
import dotenv from 'dotenv-safe';
import * as process from 'process';

dotenv.config();

export default {
    mongo: {
        options: {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            keepAlive: true,
            dbName: 'tariffsDB',
        },
        URI: String(process.env.DB_URI).replace('{database}', 'tariffsDB'),
    },
    environment: String(process.env.NODE_ENV) || 'development',
    port: Number(process.env.PORT) || 3009,
    port_dev: Number(process.env.PORT_DEV) || 3009,
    chargers: {
        host: process.env.ChargerHost || 'http://chargers:3002',
        paths: {
            tariff: "/api/private/chargers/tariffs",
            removeTariff: "/api/private/chargers/removeTariffs",
            chargingSessionValidateTariff: "/api/private/chargingSession/byTariffId",
            editTariff: "/api/private/chargers/editTariffs",
            updatePurchaseTariff: "/api/private/chargers/updatePurchaseTariff",
        }
    },
    sentry: {
        dsn: process.env.SENTRY_DSN || 'https://eb78b705331cc103735777882106d592@o4505861147131904.ingest.us.sentry.io/4509332337328129',
        validation: {
            name: 'NAME',
            equals: 'EQUALS',
            includes: 'INCLUDES',
        }
    }
};
