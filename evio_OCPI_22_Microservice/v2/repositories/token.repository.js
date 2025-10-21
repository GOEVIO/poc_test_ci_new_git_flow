const Tokens = require('../../models/tokens');
const { Enums } = require('evio-library-commons').default;
/**
 * Retrieves a token document from the database by its UID.
 *
 * @async
 * @function getTokenByUid
 * @param {string} uid - The unique identifier of the token to retrieve.
 * @param {Object} reject - An object with a throwError method for error handling.
 * @returns {Promise<Object>} The token object if found.
 * @throws {Error} If the token is not found or a database error occurs.
 */
const getTokenByUid = async (uid, reject) => {
    try {
        const token = await Tokens.findOne(
            { uid },
            {
                _id: 0,
                userId: 0,
                __v: 0,
                createdAt: 0,
                updatedAt: 0,
                source: 0
            }
        ).lean();
        if (!token) {
            throw new Error(`Token not found for UID ${uid}`);
        }

        return token;
    } catch (error) {
        console.error('Error get token by UID:', error);
        reject.setField('code', 'server_invalid_token')
            .setField('internalLog', JSON.stringify(error))
            .setField('logMessage', `Error during find token ${idTag} error: ${error.message || ''}`)
            .setField('errorType', Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR)
            .setField('stage', `Get token by UID ${uid}`)
            .setField('message', `Invalid token ${uid}: ${error.message}`)
        throw new Error()
    }
};

module.exports = {
    getTokenByUid
};
