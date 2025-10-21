const sibsFiles = process.env.SIBS_TXTFILE ? JSON.parse(process.env.SIBS_TXTFILE) : {
  txtfile_cardnumber_start: 26,
  txtfile_cardnumber_length: 30,
  txtfile_idTagDec_start: 36,
  txtfile_idTagDec_length: 17,
  txtfile_decimalTag_start: 59,
  txtfile_decimalTag_length: 16,
}

const Constants = {
  mongo: {
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      keepAlive: true,
    },
  },
  providers: {
    sentry: {
      dsn:
        process.env.SENTRY_DSN ||
        'https://b34e25cc3809a369ed40ff92e977e8f3@o4505861147131904.ingest.sentry.io/4506825639067648',
      traceSampleRate: Number(process.env.SENTRY_TRACE_SAMPLE_RATE || 0.01),
      profilesSampleRate: Number(
        process.env.SENTRY_PROFILES_SAMPLE_RATE || 0.01,
      ),
    },
  },
  environment: process.env.NODE_ENV || 'development',
  sibs: sibsFiles,
  cardCodes: JSON.parse(process.env.SIB_CARD_CODES || '{ "default": "id_letter_EN" }'),
  SIBSFileNamePT: process.env.SIBSFileNamePT || '0035860-04722-GETSEQ_',
  SIBSFileNameOther: process.env.SIBSFileNameOther || '0035860-08247-GETSEQ_',
  SIBSFileUploadType: process.env.SIBSFileUploadType ||'uploadFile',
  connectionConfigs: {
    address: process.env.webDAVAddress,
    username: process.env.webDAVUsername,
    password: process.env.webDAVPassword,
  },
  connectionConfigsPut: {
    address: process.env.webDAVAddressPutFile,
    username: process.env.webDAVUsernamePutFile,
    password: process.env.webDAVPasswordPutFile,
  }
};

module.exports = Constants;
