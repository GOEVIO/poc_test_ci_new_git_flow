
const Sentry = require('@sentry/node');
const MagnifinanceService = require('../services/magnifinance');
const Invoice = require('../models/Invoice');

module.exports = {
  getBillingDocument: async (req, res) => {
    const context = 'GET /api/private/getBillingDocument';
    try {
      const { documentId } = req.query;

      if (!documentId) {
        return res.status(400).send({ code: 'documentId_missing', message: 'documentId missing' });
      }

      const { email, token } = MagnifinanceService.getCredentials();

      const arg = {
        Authentication: {
          Email: email,
          Token: token
        },
        DocumentId: documentId
      };

      const client = await MagnifinanceService.getClientInstance();
      const result = await client.DocumentGetAsync(arg);

      console.log(`[${context}] result `, result);
      return res.status(200).send(result);
    } catch (error) {
      Sentry.captureException(error);
      console.log(`[${context}] Error `, error);
      return res.status(500).send(error.message);
    }
  },

  getInvoiceDocument: async (req, res) => {
    const context = 'GET /api/private/billing/invoiceDocument';

    try {
      const { invoiceId } = req.query;

      if (!invoiceId) {
        console.log(`[${context}] invoice not fetched`, { invoiceId });
        return res.status(400).send({ auth: false, code: 'invoice_id_missing', message: 'Invoice id is missing' });
      }

      const invoice = await Invoice.findOne({ _id: invoiceId }).lean();

      console.log(`[${context}] fetched invoice`, invoice, { invoiceId });

      return res.status(200).send(invoice);
    } catch (error) {
      Sentry.captureException(error);
      console.log(`[${context}] Error `, error);

      return res.status(500).send(error.message);
    }
  },

  getInvoiceDocuments: async (req, res) => {
    const context = 'GET /api/private/billing/invoiceDocuments';
    try {
      const { invoiceId } = req.query.invoiceId;

      if (!invoiceId) {
        console.log(`[${context}] invoice not fetched`, { invoiceId });
        return res.status(400).send({ auth: false, code: 'invoice_id_missing', message: 'Invoice id is missing' });
      }

      const invoice = await Invoice.find({ _id: invoiceId }).lean();

      console.log(`[${context}] fetched invoice`, invoice, { invoiceId });

      return res.status(200).send(invoice);
    } catch (error) {
      Sentry.captureException(error);
      console.log(`[${context}] Error `, error);

      return res.status(500).send(error.message);
    }
  },
};
