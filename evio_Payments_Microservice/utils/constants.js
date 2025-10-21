const Constants = {
    mongo: {
        options: {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            keepAlive: true
        },
    },
    providers: {
        sentry: {
            dsn: 'https://549b4d4a7f07a5f9be5ad58115f9791d@o4505861147131904.ingest.us.sentry.io/4505861497094144',
            traceSampleRate: Number(process.env.SENTRY_TRACE_SAMPLE_RATE || 0.1),
            profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE || 0.1),
        },
    },
    environment: process.env.NODE_ENV || 'development',
    services: {
        identity: {
            host: process.env.HostUser || 'http://localhost:3003',
            anonymizeUserData: process.env.PathAnonymizeUserData || '/api/private/user/anonymizeUserData'
        },
        notifications: {
            host: process.env.NotificationsHost || 'http://localhost:3008',        
        },
    },
    emails: {
        SupportEvio: process.env.EMAIL_SUPPORT || 'support@go-evio.com',
        Finance: process.env.EMAIL_FINANCE || 'finance@go-evio.com',
    },
    lusopay: {
        apiUrl: process.env.LUSOPAY_API_URL,
        apiUrlFilterRefMultibanco: process.env.LUSOPAY_API_URL_FILTER_REFMULT || '/transactions?kinds=payment&fields=id,amount,date,description,kind',
        apiUrlFilterMbWay: process.env.LUSOPAY_API_URL_FILTER_MBWAY || '/transactions?kinds=scheduledPayment&fields=id,amount,date,description,kind',
        evio: {
            user: process.env.LUSOPAY_USER_EVIO,
            pass: process.env.LUSOPAY_PASS_EVIO
        },
        gocharge: {
            user: process.env.LUSOPAY_USER_GOCHARGE,
            pass: process.env.LUSOPAY_PASS_GOCHARGE,
        }
    },
    wallet: {
        minimumAmountTo: {
            startSession: Number(process.env.MINIMUM_WALLET_AMOUNT_TO_START_SESSION || 15)
        }
    },
    TAX_EXEMPTION_REASON_CODE_M40: "M40",
    billingProfileStatus: {
        ACTIVE: process.env.BillingProfileStatusActive || 'active',
        INACTIVE: process.env.BillingProfileStatusInactive || 'inactive',
    },
    RESERVATION_REASON: 'Payment reserved on start session',
};

module.exports = Constants;
