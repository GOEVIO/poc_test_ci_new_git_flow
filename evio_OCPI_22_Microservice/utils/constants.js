const Constants = {

  mongo: {
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    },
    URI:  String(process.env.DB_URI).replace('{database}', 'ocpiDB'),
  },
  providers: {
    sentry: {
      dsn: 'https://a2f4afdab13c92dcbf93540645876683@o4505861147131904.ingest.us.sentry.io/4505861644681216',
      traceSampleRate: Number(process.env.SENTRY_TRACE_SAMPLE_RATE || 0.1),
      profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE || 0.1),
    },
  },
  environment: process.env.NODE_ENV || 'development',
  redis: {
    sentinelHost1: 'redis-sentinel1',
    sentinelHost2: 'redis-sentinel2',
    sentinelHost3: 'redis-sentinel3',
    sentinelPort: 26379,
    masterName: 'mymaster',
  },
  billingPeriods: {
    AD_HOC: 'AD_HOC',
    MONTHLY: 'MONTHLY',
  },
  defaultEVValues: {
    evEfficiencyPerKwhPerKm: 0.171
  },
  defaultCEMEtariff: {
    activationFee: process.env.defaultActivationFee,
    activationFeeAdHoc: process.env.defaultactivationFeeAdHoc
  },
  sessionHistoryV2RabbitmqQueue: String(process.env.RABBITMQ_QUEUE_SESSION_HISTORY_V2) || 'session_history_v2',
  chargers : {
    collection : {
      publicNetwork : 'publicNetworkDB',
    },
    operationalStatus: {
        approved: 'APPROVED',
        removed: 'REMOVED',
    },
    status: {
        unavailable: '50',
        available: '10',
    },
    type: {
      EVIOBoxType:'007',
      SonOFFType:'002',
      ChargerTypeSiemens:'001',
      MobieCharger:'004',
      OCMCharger:'003',
      TeslaCharger:'009',
      GireveCharger:'010',
      ChargerTypeGoCharge:['011', '012'],
      HubjectCharger:'015'
    }
  },
  ocpi : {
    get : {
      mode: {
        full: "full",
        delta: 'delta'
      },
      request: {
        limit: 100,
        offset: 0,
        totalCount: 10,
      }
    },
    modules : {
      credentials: "credentials",
      locations: "locations",
      sessions: "sessions",
      cdrs: "cdrs",
      tariffs: "tariffs",
      tokens: "tokens",
      hubclientinfo: "hubclientinfo",
      commands: "commands"
    }
  },
  maxDaysForPreAuthorizations: 1,
  THREE_DAYS_IN_SECONDS: 259200, // 72h
  TAX_EXEMPTION_REASON_CODE_M40: "M40"
};

module.exports = Constants;
