const Constants = {
  providers: {
    sentry: {
      dsn: 'https://7c3cb090afa7a069a260c99f049823dd@o4505861147131904.ingest.us.sentry.io/4505861664079872',
      traceSampleRate: Number(process.env.SENTRY_TRACE_SAMPLE_RATE || 0.01),
      profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE || 0.01),
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
  responseStatus: {
    Accepted: 'Accepted',
    Rejected: 'Rejected',
    Scheduled: 'Scheduled',
    Unknown: 'Unknown'
  }
};

module.exports = Constants;
