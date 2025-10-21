const Constants = {
  limitQueryMax: 100,
  queryMininum: 1,
  environment: process.env.NODE_ENV || "development",
  providers: {
    sentry: {
      dsn: "https://431ceba7793ee6f161c7041628d2c370@o4505861147131904.ingest.us.sentry.io/4506829806632960",
      traceSampleRate: Number(process.env.SENTRY_TRACE_SAMPLE_RATE || 0.01),
      profilesSampleRate: Number(
        process.env.SENTRY_PROFILES_SAMPLE_RATE || 0.01,
      ),
    },
  },
  ocpi22: {
    host: process.env.HostOCPI || "http://localhost:3019",
    getSessionById: "/api/private/ocpi/sessions/byId",
  },
  chargers: {
    host: process.env.HostCharger || "http://localhost:3002",
    getSessionById: "/api/private/chargingSession/Query",
  },
  eventProducer: {
    reportRoutingKey: "report_consumer_queue",
  },
  reports: {
    clients: ["BackOffice", "webapp"],
  },
  permissionToRetrieveHistory: {
    BackOffice: process.env.ClientWeb || 'BackOffice',
    Web: 'web',
    Webapp: 'webapp',
  },
};

module.exports = {
  Constants,
};
