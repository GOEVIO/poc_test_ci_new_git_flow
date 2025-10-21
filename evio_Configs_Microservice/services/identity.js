const axios = require('axios');
require('dotenv-safe').load();

const service = {
  updateLicensePreferences: async (userid, licensePreferences) => {
    const URL = `${process.env.HostUsers}/api/private/users/licensePreferences`;

    return axios.patch(URL, licensePreferences, { headers: { userid } });
  }
};

module.exports = service;