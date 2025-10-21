const Platforms = require('../../models/platforms');
const { Enums } = require('evio-library-commons').default;
/**
 * Retrieves a platform document by its platform code.
 *
 * @async
 * @function
 * @param {string} platformCode - The unique code identifying the platform.
 * @param {Object} reject - An object containing error handling utilities.
 * @param {Function} reject.throwError - Function to throw a custom error.
 * @returns {Promise<Object>} The platform document if found.
 * @throws Will call reject.throwError if the platform is not found or if an error occurs during the query.
 */
const getPlatformByPlatformCode = async (platformCode, reject) => {
    try {
        const platform = await Platforms.findOne({ platformCode }).lean();
        if (!platform) {
            throw new Error(`Platform not found for code ${platformCode}`);
        }

        return platform;
    } catch (error) {
        console.error('Error get platform by code:', error);
        reject.setField('code', 'server_invalid_platform')
            .setField('internalLog', JSON.stringify(error))
            .setField('errorType', Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR)
            .setField('message', `Invalid platform ${platformCode}: ${error.message}`)
            .setField('stage', `Get platform by code ${platformCode}`)
            .setField('logMessage', `Error getting platform versions: ${error.message || ''}`);
        throw new Error()
    }
};

module.exports = {
    getPlatformByPlatformCode
};
