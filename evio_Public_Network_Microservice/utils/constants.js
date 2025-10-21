const Constants = {
    updatePlugStatusRabbitmqQueue: process.env.RABBITMQ_QUEUE_UPDATE_PLUG_STATUS,
    providers: {
        sentry: {
            dsn:
                process.env.SENTRY_DSN ||
                'https://659a1ce8a38d2890f2dc13f0ce158466@o4505861147131904.ingest.sentry.io/4505861693177856',
            traceSampleRate: Number(process.env.SENTRY_TRACE_SAMPLE_RATE || 0.1),
            profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE || 0.1),
        },
    },
    environment: process.env.NODE_ENV || 'development',
    clients: {
        evio: {
            name: 'EVIO',
        },
    },
    countriesAllowed: ["PT", "FR", "ES"],
    locations : {
        pagination : {
            defaultPage: 1,
            defaultLimit: 10,
            maximumLimit: 100,
        }
    },
    operationalStatus: {
        approved: "APPROVED",
        removed: "REMOVED",
    },
    evseStatus: {
        removed: 'REMOVED',
        planned: 'PLANNED',
        unknown: 'UNKNOWN',
    },
    networks : {
        mobie : "MOBIE",
        gireve : "GIREVE",
        hubject : "HUBJECT",
    }

};

module.exports = Constants;
