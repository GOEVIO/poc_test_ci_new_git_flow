const axios = require('axios');
const { getCode } = require('country-list');
const { AppConfigurationReadRepository } = require('evio-library-configs');
const Constants = require('../utils/constants');


const ConfigsService = {
  /**
     * Get fees configuration
     * This endpoint returns with 400 if any fees are not found
     * @param country
     * @param postalCode
     * @returns AxiosResponse<any>
     */
  getFeesByCountryAndPostalCode: async (country, postalCode, countryCodeCharger) => {
    const countryCode = country ? getCode(country) : countryCodeCharger;

    const url = `${Constants.services.configsHost}/api/private/config/fees?countryCode=${countryCode}&postalCode=${postalCode}`;
    return axios.get(url);
  },
  /**
     * Retrieves the app configuration for a given client name.
     * @param {String} clientName - Client name to retrieve the app configuration for.
     * @returns {Object|null} Maps configuration object from the app configuration, or null if not found.
     */
  getAppConfiguration: async (clientName) => {
    try {
      const appConfiguration = await AppConfigurationReadRepository.getAppConfigurationsByClient(clientName);
      if (!appConfiguration) {
        return null;
      }
      return appConfiguration.mapsConfiguration;
    } catch (error) {
      console.log('error', error);
      return null;
    }
  },
  /**
    * Get fees configuration
    * This endpoint returns with 400 if any fees are not found
    * @param country
    * @param postalCode
    * @param userId
    * @returns AxiosResponse<any>
    */
    getFeesByCountryAndUserId: async (country, postalCode, countryCodeCharger, userId) => {
        try {
            const countryCode = country ? getCode(country) : countryCodeCharger;

            console.info(`getFeesByCountryAndUserId: country - ${country} / postalCode  - ${postalCode} / countryCodeCharger - ${countryCodeCharger} / userId - ${userId}`)

            const userQueryString = userId ? `&userId=${userId}` : '';

            const url = `${Constants.services.configsHost}/api/private/config/fees?countryCode=${countryCode}&postalCode=${postalCode}${userQueryString}`;

            const result = await axios.get(url);

            console.info(`getFeesByCountryAndUserId Result: ${result.data}`)
            return result.data;
        } catch (error) {
            console.log('[getFeesByCountryAndUserId] Error', error.message || error);
            throw error;
        }
    },
};

module.exports = ConfigsService;
