const Session = require('../../models/sessions');
const Utils = require('../../utils');
const global = require('../../global');
/**
 * Retrieves a session document from the database by its query.
 *
 * @async
 * @function findSession
 * @param {Object} query - The query object to find the session.
 * @returns {Promise<Object>} The session object if found.
 * @throws {Error} If the session is not found or a database error occurs.
 */
const findSession = async (query, projection = {}) => {
    try {
        return await Session.findOne(query, projection).lean();
    } catch (error) {
        console.error('Error get session by query:', error);
        throw new Error('Failed to find session');
    }
};

/**
 * Creates a new session document in the database.
 *
 * @async
 * @function createSession
 * @param {Object} sessionData - The data for the new session.
 * @param {Object} reject - An instance of a custom error handler (e.g. SendRejectResponse).
 * @returns {Promise<Object>} The created session object.
 * @throws {Error} If there is an error during session creation.
 */
const createSession = async (sessionData, reject) => {
    try {
        const session = new Session(sessionData);
        const sessionCreated = await session.save();
        if (!sessionCreated) {
            throw new Error('Error starting session');
        }
        return sessionCreated.toObject ? sessionCreated.toObject() : sessionCreated;
    } catch (error) {
        console.error('Error creating session:', error);
        reject.setField('code', 'server_error_remote_start_failed')
            .setField('internalLog', JSON.stringify(error))
            .setField('message', "Error starting session");
        throw new Error()
    }
};

async function updateSessionCommandResult(authorization_reference, status, displayTextMessage, commandResultStart, message = '') {
    const query = {
        authorization_reference: authorization_reference,
        status: {$nin: [global.SessionStatusStopped, global.SessionStatusSuspended]}
    };

    const body = {
        status: status,
        displayText: { language: "EN", text: displayTextMessage },
        commandResultStart: commandResultStart
    };
    if(message){
        body.message = message;
    }

    try {
        await Session.findOneAndUpdate(query, body, {new: true});
    } catch (error) {
        console.error("Error updating session command result:", error);
        throw new Error(error);
    }
}

const updateSessionCommandResponse = async ({_id, status, message, displayTextMessage, responseTimeout = 70, commandResponseDate = null}) => {
    const $set = {
        status,
        displayText: { language: "EN", text: displayTextMessage },
        message,
        responseTimeout
    };

    if (commandResponseDate) {
        $set.commandResponseDate = commandResponseDate;
    }

    await Session.updateOne({ _id }, { $set });
}

const updateSessionByQuery = async (query, $set) => {
    await Session.updateOne(query, { $set });
}

module.exports = {
    findSession,
    createSession,
    updateSessionCommandResponse,
    updateSessionCommandResult,
    updateSessionByQuery
};
