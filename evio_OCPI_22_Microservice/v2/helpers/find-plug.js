const { Enums } = require('evio-library-commons').default;
/**
 * Finds a plug by its ID in the provided list of plugs.
 * @param {Array} plugs - The array of plug objects to search through.
 * @param {string} plugId - The ID of the plug to find.
 * @returns {Object} The found plug object.
 * @throwError {Error} If the plug with the specified ID is not found.
 */
const findPlug = (plugs, plugId, reject) => {
    const plug = plugs.find(p => p.plugId === plugId);
    if (!plug) {
        reject.setField('code', 'server_plug_id_not_found')
            .setField('internalLog', `Plug Id ${plugId} not found`)
            .setField('message', `Plug Id ${plugId} not found`)
            .setField('errorType', Enums.SessionFlowLogsErrorTypes.VALIDATION_ERROR)
            .setField('stage', `Find plug by ID ${plugId}`);
        throw new Error();
    }
    return plug;
}

module.exports = {
    findPlug
};