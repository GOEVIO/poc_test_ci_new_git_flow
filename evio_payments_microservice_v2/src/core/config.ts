const configModule = () => ({
  root: {
    APP_PORT: process.env.APP_PORT,
    FLAGSMITH_ENVIRONMENT_KEY: process.env.FLAGSMITH_ENVIRONMENT_KEY,
    FLAGSMITH_API_HOST: process.env.FLAGSMITH_API_HOST,
    DB_URI: process.env.DB_URI,
    services: {
      identity: process.env.IDENTITY_SERVICE,
    },
    mongo: {
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        keepAlive: true,
      },
    },
    providers: {
      magnifinance: process.env.MagnifinanceWSDL,
      PortugalTaxIdValidatorUrl: process.env.PortugalTaxIdValidatorUrl,
      InternationalTaxIdValidatorUrl: process.env.InternationalTaxIdValidatorUrl,
      sentry: {
        dsn: process.env.SENTRY_DSN || 'https://9693f8a3162a2a260478e00f7270449e@o4505861147131904.ingest.us.sentry.io/4507702570123264',
        traceSampleRate: Number(process.env.SENTRY_TRACE_SAMPLE_RATE || 0.1),
        profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE || 0.1),
      },
    },
    environment: process.env.NODE_ENV || 'development',
  },
  db: {
    payments: {
      dbName: 'paymentsDB',
      collectionPreAuthorization: 'preAuthorizations',
      collectionTransactions: 'transactions',
      collectionPayments: 'payments',
    },
  },
  chargersTypesOCPI: ['004', '010', '015'],
  ChargingSession: {
    status: {
      completed: 'COMPLETED',
      expired: 'EXPIRED',
      invalid: 'INVALID',
      removed: 'REMOVED',
      suspended: 'SUSPENDED',
    },
  },
  PreAuthorizationRefusalCodes: {
    expired24h: 'Pre Authorization released because have more than 24 hours.',
    suspendSession: 'Session was suspended so it will release the preAuthorization',
    invalidReason: 'Session was invalid with invalid CDR so it will release the preAuthorization',
  },
  AdyenSalvadorCaetano: {
    AdyenAPIKEYSC: process.env.AdyenAPIKEYSC,
    AdyenMerchantAccountSC: process.env.AdyenMerchantAccountSC,
    AdyenAPIKEYTestSC: process.env.AdyenAPIKEYTestSC,
    AdyenMerchantAccountTestSC: process.env.AdyenMerchantAccountTestSC,
    AdyenLiveEndpointUrlPrefixSC: process.env.AdyenLiveEndpointUrlPrefixSC,
  },
  AdyenEVIO: {
    AdyenAPIKEY: process.env.AdyenAPIKEY,
    AdyenMerchantAccount: process.env.AdyenMerchantAccount,
    AdyenAPIKEYTest: process.env.AdyenAPIKEYTest,
    AdyenMerchantAccountTest: process.env.AdyenMerchantAccountTest,
    AdyenLiveEndpointUrlPrefix: process.env.AdyenLiveEndpointUrlPrefix,
    UserAdyenBasicAuth: process.env.UserAdyenBasicAuth,
    PassAdyenBasicAuth: process.env.PassAdyenBasicAuth,
    Environment: process.env.AdyenEnvironment || 'TEST',
  },
  OCPI: {
    ocpiHost: 'http://ocpi-22:3019',
    sessions: '/api/private/ocpi/sessions',
  },
  CHARGERS: {
    chargersHost: 'http://chargers:3002',
    sessions: '/api/private/chargingSession/v1/',
  },
  payment: {
    apt: {
      AdyenMerchantAccount: process.env.AdyenMerchantAccountAPT || 'EVIO_TPA',
      currency: 'EUR',
      preAuthorizeAmount: 40,
      connectionTimeoutMillis: 125000,
      preAuthExpiration: {
        amex: 7,
        cartebancaire: 13,
        diners: 7,
        discover: 10,
        jcb: 365,
        mc: 30,
        visa: 5,
        default: 5,
      },
    },
  },
})

export type ConfigModuleType = ReturnType<typeof configModule>

export default configModule
