const Constants = {
  mongo: {
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      keepAlive: true,
    },
    URI: String(process.env.DB_URI).replace('{database}', 'notificationsDB'),
  },
  providers: {
    sentry: {
      dsn:
        process.env.SENTRY_DSN ||
        'https://a3c55e1bd13c821b2e17c42bd79c6562@o4505861147131904.ingest.us.sentry.io/4508127149162496',
      traceSampleRate: Number(process.env.SENTRY_TRACE_SAMPLE_RATE || 0.1),
      profilesSampleRate: Number(
        process.env.SENTRY_PROFILES_SAMPLE_RATE || 0.1,
      ),
    },
  },
  environment: process.env.NODE_ENV || 'development',
  appVersionsProxy: `${process.env.CONFIGS_HOST}/api/private/config/appVersions`,
  senderShortName: 'EVIO',
  senderPhoneNumber: '+16562212808',
  company: {
    kinto: {
      contactEmail: 'charge@kinto-mobility.pt',
      contactWebsite: 'https://www.kinto-mobility.eu/',
      appleStoreLink: 'https://apps.apple.com/pt/app/kinto-charge/id6451482950',
      playStoreLink:
        'https://play.google.com/store/apps/details?id=com.evio.kinto&pli=1',
    },
    evio: {
      contactEmail: 'support@go-evio.com',
      contactWebsite: process.env.evioWebsite,
      appleStoreLink: process.env.appleStoreLink,
      playStoreLink: process.env.playStoreLink,
    },
  },
  supportedLanguages: {
    portuguese: 'pt',
    english: 'en_GB',
  },
  environment: process.env.NODE_ENV || 'development',
  apiUrls: {
    production: process.env.HOST_PRD || 'https://api.go-evio.com',
    'pre-production': process.env.HOST_QA || 'https://pre-api.go-evio.com',
    development: process.env.HOST_DEV || 'https://dev-api.go-evio.com',
    local: 'http://localhost:7000',
  },
  REGISTERED: 'REGISTERED',
  AndroidAppLink: process.env.AndroidAppLink,
  iOSAPPLink: process.env.iOSAPPLink,
  ClientName: 'EVIO'
};

module.exports = Constants;
