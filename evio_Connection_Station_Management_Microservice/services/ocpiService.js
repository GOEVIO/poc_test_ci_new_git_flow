const axios = require('axios');
const Constants = require('../utils/constants');

const OCPIService = {

  /**
   * Get the country codes to billing period sessions
   * @param userId
   * @param billingPeriod
   * @param invoiceWithoutPayment
   * @param start_date_time
   * @param end_date_time
   * @returns {Promise<any>}
   */
  getCountryCodesToBillingPeriodSessionsV2: async (userId, billingPeriod, invoiceWithoutPayment,
  // eslint-disable-next-line camelcase
    start_date_time, end_date_time) => {
    const params = {
      userId,
      billingPeriod,
      invoiceWithoutPayment,
      start_date_time,
      end_date_time,
    };

    const url = `${Constants.services.ocpiHost}/api/private/chargingSession/getCountryCodesToBillingPeriodSessionsV2`;
    const result = await axios.get(url, { params });

    return result.data;
  }
};

module.exports = OCPIService;
