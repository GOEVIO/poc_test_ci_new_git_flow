const axios = require('axios');
const Constants = require('../utils/constants');

const IdentityService = {

  /**
     *
     * @param billingPeriods Array<string>
     * @param forcedUserId string
     * @returns AxiosResponse<any>
     */
  getAllValidBillingProfilesForMonthlyB2C: async (billingPeriods, forcedUserId) => {
    const data = {
      billingPeriods, forcedUserId,
    };
    const url = `${Constants.services.identityHost}/api/private/billingProfile/validPeriodBillingProfiles`;

    return axios.get(url, { data });
  }
};

module.exports = IdentityService;
