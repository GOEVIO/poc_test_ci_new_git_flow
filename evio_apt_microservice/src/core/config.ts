/* eslint-disable max-lines-per-function */

import { z } from 'zod'

const configModule = () => ({
  root: {
    APP_PORT: process.env.PORT || 6001,
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
      InternationalTaxIdValidatorUrl:
        process.env.InternationalTaxIdValidatorUrl,
      sentry: {
        dsn: process.env.SENTRY_DNS || '',
        traceSampleRate: Number(0.1),
        profilesSampleRate: Number(0.1),
      },
    },
    environment: process.env.NODE_ENV || 'development',
  },
  db: {
    apt: {
      dbPort: z
        .number({
          message: 'apt db port must be defined in DATABASE_PORT env var',
        })
        .parse(Number(process.env.DATABASE_PORT)),
      dbHost: z
        .string({
          message: 'apt db host must be defined in DATABASE_HOST env var',
        })
        .parse(process.env.DATABASE_HOST),
      dbUser: z
        .string({
          message: 'apt db user must be defined in DATABASE_USER env var',
        })
        .parse(process.env.DATABASE_USER),
      dbPassword: z
        .string({
          message:
            'apt db password must be defined in DATABASE_PASSWORD env var',
        })
        .parse(process.env.DATABASE_PASSWORD),
      dbSchema: z
        .string({
          message: 'apt db schema must be defined in DATABASE_SCHEMA env var',
        })
        .parse(process.env.DATABASE_SCHEMA),
    },
  },
  client: {
    paymentsV2: {
      host: z
        .string({
          message:
            'payments service host must be defined in PAYMENTS_SERVICE_HOST env var',
        })
        .url()
        .parse(process.env.PAYMENTS_SERVICE_HOST),
      preAuthorizationUrl: '/api/private/payments/v2/preauthorisation',
      readCardUrl: '/api/private/payments/v2/apt/preauthorization/readingcard',
      identify: '/api/private/payments/v2/identify',
      cancelPreAuthorization: '/api/private/payments/v2/preauthorisation',
    },
    connectionStation: {
      host: z
        .string({
          message:
            'connection station service host must be defined in CONNECTION_STATION_SERVICE_HOST env var',
        })
        .url()
        .parse(process.env.CONNECTION_STATION_SERVICE_HOST),
      sessionPath: '/api/private/connectionstation',
    },
    charger: {
      host: z
        .string({
          message:
            'charger service host must be defined in CHARGER_SERVICE_HOST env var',
        })
        .url()
        .parse(process.env.CHARGER_SERVICE_HOST),
      getSessionPath: '/api/private/chargingSession',
    },
    ocpi: {
      host: z
        .string({
          message:
            'ocpi service host must be defined in OCPI_SERVICE_HOST env var',
        })
        .url()
        .parse(process.env.OCPI_SERVICE_HOST),
      getSessionPath: '/api/private/chargingSession/chargingSessionById',
    },
    notification: {
      host: z
        .string({
          message:
            'notification service host must be defined in NOTIFICATION_SERVICE_HOST env var',
        })
        .url()
        .parse(
          process.env.NOTIFICATIONS_SERVICE_HOST || 'http://localhost:3008'
        ),
    },
  },
})

export type ConfigModuleType = ReturnType<typeof configModule>

export default configModule
