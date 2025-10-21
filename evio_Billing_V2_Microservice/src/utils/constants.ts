import * as dotenv from 'dotenv';
dotenv.config();

export default {
  services: {
    phc: {
      host: process.env.HostPhc || 'http://54.195.51.148:85',
      authenticate: '/authenticate.php',
      createInvoice: '/createinvoice.php',
      createCreditNote: '/credit-note.php',
      ftpHost: process.env.PHC_FTP_HOST || '54.195.51.148',
      ftpUser: process.env.PHC_FTP_USER || 'evio',
      ftpPassword: process.env.PHC_FTP_PASSWORD || '',
      company: process.env.PHC_COMPANY || 'GOEVIO',
      username: process.env.PHC_USERNAME || 'TesteUsr',
      password: process.env.PHC_PASSWORD || 'testePsw',
      maxRetries: process.env.PHC_MAX_RETRIES || 15,
      maxRetriesRetryProcess: process.env.PHC_MAX_RETRIES_FOR_RETRY_PROCESS || 3,
    },
    ocpi: {
      host: process.env.HostOcpi || 'http://ocpi-22:3019',
      cdrExtension: '/api/private/billing/cdrExtension',
      cdrExtensionPeriodic: '/api/private/chargingSession/billingPeriodSessionsGetBillingInformation',
    }
  },
  sessions: {
    sessionBillingStartDate: process.env.SESSION_BILLING_START_DATE || '2025-07-01',
    sessionBillingEndDate: process.env.SESSION_BILLING_END_DATE
  },
  database: {
    postgres: {
      host: process.env.DATABASE_HOST,
      port: process.env.DATABASE_PORT,
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      name: process.env.DATABASE_NAME,
      schema: process.env.DATABASE_SCHEMA,
    },
    sqlserver: {
      host: process.env.SQLSERVER_HOST,
      port: process.env.SQLSERVER_PORT,
      user: process.env.SQLSERVER_USER,
      password: process.env.SQLSERVER_PASSWORD,
      name: process.env.SQLSERVER_DATABASE,
    }
  },
  email: {
    host: process.env.EMAIL_HOST || 'smtp.office365.com',
    port: process.env.EMAIL_PORT || 587,
    subject: {
      INVOICE_PT: 'Envio de confirmação de Fatura',
      INVOICE_EN: 'Invoice Confirmation Sending',
      CREDIT_NOTE_PT: 'Envio de confirmação de Nota de Crédito',
      CREDIT_NOTE_EN: 'Credit Note Confirmation Sending',
      PT_PREFIX: process.env.EMAIL_SUBJECT_PT_PREFIX,
      EN_PREFIX: process.env.EMAIL_SUBJECT_EN_PREFIX,
    },
    clientNames: {
      EVIO: {
        user: process.env.EVIO_EMAIL_USER,
        pass: process.env.EVIO_EMAIL_PASS
      },
      ACP: {
        user: process.env.ACP_EMAIL_USER,
        pass: process.env.ACP_EMAIL_PASS
      },
      GoCharge: {
        user: process.env.GOCHARGE_EMAIL_USER,
        pass: process.env.GOCHARGE_EMAIL_PASS
      },
      Hyundai: {
        user: process.env.HYUNDAI_EMAIL_USER,
        pass: process.env.HYUNDAI_EMAIL_PASS
      },
    }
  },
  evioUser: {
    userId: '605b51a919ba1400128f306a',
    nif: '515681890'
  }
};
