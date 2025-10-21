export const Constants = {
    mongo: {
        options: {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            keepAlive: true
        },
    },
    providers: {
        sentry: {
            dsn:
                process.env.SENTRY_DSN
                || 'https://2c2e2a86736591ee1ad4a8eec691927c@o4505861147131904.ingest.us.sentry.io/4505861160501248',
            traceSampleRate: Number(
                process.env.SENTRY_TRACE_SAMPLE_RATE || 0.01
            ),
            profilesSampleRate: Number(
                process.env.SENTRY_PROFILES_SAMPLE_RATE || 0.01
            ),
            ignoredTransactions: [
                '/api/validateUsers',
                '/api/private/users/allInfoById',
                '/api/private/users/account',
            ],
        }
    },
    environment: process.env.NODE_ENV || 'development',
    NODE_ENV: process.env.NODE_ENV || 'development',
};

