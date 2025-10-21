require('dotenv-safe').load();

const Constants = {
  providers: {
    sentry: {
      dsn: 'https://5cdb7fcde9da70eb7d073ede42818495@o4505861147131904.ingest.us.sentry.io/4505861591334912',
      traceSampleRate: Number(process.env.SENTRY_TRACE_SAMPLE_RATE || 0.1),
      profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE || 0.1),
    },
  },
  environment: process.env.NODE_ENV || 'development',
  clientName: {
    WhiteLabelGoCharge: process.env.WhiteLabelGoCharge,
    WhiteLabelHyundai: process.env.WhiteLabelHyundai,
    WhiteLabelKLC: process.env.WhiteLabelKLC,
    WhiteLabelKinto: process.env.WhiteLabelKinto,
  },
  networks: {
    mobie: {
      name: process.env.NetworkMobiE,
      key: process.env.NetworkKeyMobiE,
      grantNew: process.env.MobiE_GrantNew,
      grant: process.env.MobiE_Grant,
      chargerType:"004"
    },
    gireve: {
      name: process.env.NetworkGireve,
      key: process.env.NetworkKeyRoaming,
      chargerType:"010"
    },
    evio: {
      name: process.env.NetworkEVIO,
      key: process.env.NetworkKeyEVIO,
      chargerType: "008"
    },
    hubject: {
      name: process.env.NetworkHubject,
      key: process.env.NetworkKeyRoaming,
      chargerType:"015" 
    },
    hyundai: {
      name: process.env.NetworkHyundai,
      key: process.env.NetworkKeyHyundai
    },
    kinto: {
      name: process.env.NetworkKinto,
      key: process.env.NetworkKeyKinto
    },
    tesla: {
      name: process.env.NetworkTesla,
      key: process.env.NetworkKeyTesla,
      chargerType: process.env.TeslaCharger,
      chargerTypeOCM: process.env.OCMCharger
    },
    others: { key: process.env.NetworkKeyOthers }
  },
  services: {
    ocpiHost: process.env.HostChargingSessionMobie,
    configsHost: process.env.ConfigsHost,
    publicNetworkHost: process.env.PublicChargersHost,
    chargersServiceProxy: process.env.ChargersServiceProxy,
    chargerPrivateServiceProxy:  process.env.ChargerPrivateServiceProxy,
    publicChargersHost: process.env.PublicChargersHost,
    publicGetChargerPathPrivate: process.env.PublicGetChargerPathPrivate,
    publicNetworkChargerType: process.env.PublicNetworkChargerType,
    chargerDetailsPrivateEVIONetWork: process.env.ChargerDetailsPrivateEVIONetWork,
    identityHost: process.env.IdentityHost,
    publicNetworkMaps: process.env.PublicNetworkMaps,
    notificationsHost: process.env.NotificationsHost,
    PathNotifymeHistory: process.env.PathNotifymeHistory,
    PathNotifymeHistoryBulk: process.env.PathNotifymeHistoryBulk,
    PathNotificationSendEmail: process.env.PathNotificationSendEmail || '/api/private/sendEmail'
  },
  privateAccess: process.env.ChargerAccessPrivate,
  redis: {
    sentinelHost1: 'redis-sentinel1',
    sentinelHost2: 'redis-sentinel2',
    sentinelHost3: 'redis-sentinel3',
    sentinelPort: 26379,
    masterName: 'mymaster',
  },
  adHocActivationFeeCard: process.env.adHocActivationFeeCard,
  defaultZone: "PT",
  defaultCountry:"PT",
  plafond_minimum_value_running_session: Number(process.env.PLAFOND_MINIMUM_VALUE_RUNNING_SESSIONS) || 2.5,
  publicChargersTypes: process.env.PublicNetworkChargerType ?
    String(process.env.PublicNetworkChargerType).split(',') :
    ["003","004","009","010","015"],
  TAX_EXEMPTION_REASON_CODE_M40: "M40",
  wallet: {
    minimumValueToTopUp: Number(process.env.WALLET_MINIMUM_VALUE_TO_TOP_UP) || 7.5,
    maximumValueToTopUp: Number(process.env.WALLET_MAXIMUM_VALUE_TO_TOP_UP) || 20,
    minimumValueToStopSession: Number(process.env.WALLET_MINIMUM_VALUE_TO_STOP_SESSION) || 7.5,
    defaultValueToTopUp: Number(process.env.WALLET_DEFAULT_VALUE_TO_TOP_UP) || 40,
  }
};

module.exports = Constants;
