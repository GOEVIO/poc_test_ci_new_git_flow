const Sentry = require('@sentry/node');
const AxiosHandler = require('../services/axios');
const Invoice = require('../models/Invoice');

module.exports = {
  updateBillingHistory: async (invoice) => {
    const context = 'Function updateBillingHistory';
    try {
      const host = process.env.HostStatistics + process.env.PathUpdateBillingHistory;
      const data = invoice;

      // console.log(`[${context}] data `, data)

      const response = await AxiosHandler.axiosPatchBody(host, data);

      if (response) {
        await Invoice.findOneAndUpdate({ _id: invoice._id }, {
          $set: { syncToHistory: true },
          $unset: { sentToSyncToHistory: '' } // remove temporary field
        }, { new: true });
        console.log(`[${context}] ${invoice._id} History updated`);
      } else {
        console.log(`[${context}] ${invoice._id} History not updated`);
      }
    } catch (error) {
      Sentry.captureException(error);
      if (error) {
        if (error.response) {
          console.error(`[${context}] Error `, error.response.data.message);
        } else {
          console.error(`[${context}] Error `, error.message);
        }
      } else {
        console.error(`[${context}] Error `, error);
      }
    }
  }
};
