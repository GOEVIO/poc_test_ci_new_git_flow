const axios = require('axios');
const Constants = require('../utils/constants');

/**
 * Get the countries to billing period sessions
 * @param userId
 * @param billingPeriod
 * @param invoiceWithoutPayment
 * @param start_date_time
 * @param end_date_time
 * @param clientName
 * @returns {Promise<any>}
 */
async function getCountriesToBillingPeriodSessions(userId, billingPeriod, invoiceWithoutPayment,
// eslint-disable-next-line camelcase
  start_date_time, end_date_time, clientName) {
  const host = `${Constants.services.chargersServiceProxy}/api/private/chargingSession/getCountriesToBillingPeriodSessions`;
  const params = {
    userId, billingPeriod, invoiceWithoutPayment, start_date_time, end_date_time, clientName
  };

  const result = await axios.get(host, { params });
  return result.data;
}

async function getPrivateDetailsEVIONetWork(query, data) {
  const context = 'Function getPrivateDetailsEVIONetWork';
  try {
    const host = `${Constants.services.chargersServiceProxy}${Constants.services.chargerDetailsPrivateEVIONetWork}`;
    const params = {
      _id: query._id,
      active: true,
    };

    const headers = {
      userid: data.userid,
    };

    const result = await axios.get(host, { headers, params });
    return result.data;
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    if (error.response) {
      console.error(`[${context}][$][.catch] Error`, error.response.data);
      throw error.response.data;
    } else {
      console.error(`[${context}][$][.catch] Error`, error.message);
      throw error;
    }
  }
}

async function getChargersEVIONetWork(host, headers, params, data) {
  const context = 'Function getChargersEVIONetWork';
  try {
    const result = await axios.get(host, { headers, params, data });
    return result.data;
  } catch (error) {
    console.error(`[${context}] Error `, error.response ? error.response.data : error.message);
    throw error;
  }
}
module.exports = {
  getPrivateDetailsEVIONetWork,
  getChargersEVIONetWork,
  getCountriesToBillingPeriodSessions,
};
