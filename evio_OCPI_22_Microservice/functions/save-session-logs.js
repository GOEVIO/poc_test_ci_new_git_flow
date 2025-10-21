const { captureException } = require("@sentry/node");
const { saveSessionFlowLogs } = require('evio-library-ocpi');
const { Enums } = require('evio-library-commons').default;
/**
 * Saves session logs with additional service information.
 *
 * @param {Object} logsInfo - The log information to be saved.
 * @param {string} logsInfo.userId - The user ID associated with the session.
 * @param {string} logsInfo.hwId - The hardware ID.
 * @param {string} logsInfo.plugId - The plug ID.
 * @param {string} logsInfo.stage - The stage of the session flow.
 * @param {string} logsInfo.action - The action performed.
 * @param {string} logsInfo.status - The status of the session flow.
 * @param {string} [logsInfo.errorType] - Optional error type to include in the logs.
 * @param {string} [logsInfo.errorMessage] - Optional error message to include in the logs.
 * @param {Object} [logsInfo.payload] - Optional payload to be stringified and included in the logs.
 * @param {string} [logsInfo.sessionId] - Optional session ID.
 * @param {string} [logsInfo.externalSessionId] - Optional External session ID.
 * @param {[Object]} [logsInfo.retries] - Optional array of retry attempts.
 * @returns {void}
 */
const saveSessionLogs = (logsInfo = {}, upsert = false) => {
    const context = 'Function [saveSessionLogs]:';
    try {
        const dataToSave = { ...logsInfo, service: 'ocpi-22' };

        if (dataToSave?.status === Enums.SessionFlowLogsStatus.SUCCESS) {
            delete dataToSave.errorType;
            delete dataToSave.errorMessage;
            delete dataToSave.payload;
        } else if (dataToSave.payload) {
            try {
                dataToSave.payload = JSON.stringify(logsInfo?.payload);
            } catch (err) {
                dataToSave.payload = '[Unserializable payload]';
            }
        }

        saveSessionFlowLogs(dataToSave, upsert);
    } catch (error) {
        console.error(`${context} Error saving session logs: ${error.message}`);
        captureException(error);
    }
};

module.exports = {
    saveSessionLogs
}