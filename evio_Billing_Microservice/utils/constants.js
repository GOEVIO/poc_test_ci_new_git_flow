require('dotenv-safe').load();

const Constants = {
  services: {
    identity: process.env.IDENTITY_SERVICE,
  },
  providers: {
    magnifinance: process.env.MagnifinanceWSDL,
    PortugalTaxIdValidatorUrl: process.env.PortugalTaxIdValidatorUrl,
    InternationalTaxIdValidatorUrl: process.env.InternationalTaxIdValidatorUrl,
    sentry: {
      dsn: process.env.SENTRY_DSN || 'https://c928eeb908e9e6c854d2548413719f93@o4505861147131904.ingest.sentry.io/4506784402636800',
      traceSampleRate: Number(process.env.SENTRY_TRACE_SAMPLE_RATE || 0.1),
      profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE || 0.1),
    },
  },
  environment: process.env.NODE_ENV || 'development',
  nifDefault: '999999990',
  invoiceErrorMessages: {
    TaxValueCodeNotAccordingToRegion : 'invoice_service_error_invalid_tax_code_region_email_message',
    invalidNifEmailBody: 'invoice_service_error_invalid_nif_email_message',
    invalidNifEmailTitle: 'invoice_service_error_invalid_nif_email_title'
  },
  defaultCEMEtariff:{
    activationFee: process.env.defaultActivationFee,
    activationFeeAdHoc: process.env.defaultactivationFeeAdHoc
  },
  invoiceType: {
    invoice: 'invoice',
    budget: 'budget',
    creditNote: 'credit_note',
  },
  defaultLanguage: 'en_GB'
};

module.exports = Constants;
