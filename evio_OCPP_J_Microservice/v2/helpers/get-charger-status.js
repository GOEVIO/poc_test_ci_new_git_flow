const {
	SessionFlowLogsErrorTypes,
} = require('../configs/constants');
const { checkChargerStatus } = require('evio-library-chargers').default;

const getChargerStatus = async (hwId, reject) => {
    try {
        const charger = await checkChargerStatus(hwId);

        if (!charger) {
            reject.setField('code', 'server_charger_not_found')
                .setField('internalLog', `Charger with hwId ${hwId} not found`)
                .setField('message', `Charger with hwId ${hwId} not found`);
            throw new Error();
        }
        return charger;
    } catch (error) {
        console.error(`Error in getChargerStatus: ${error.message}`);
        reject.setField('code', 'server_get_charger_status_error')
            .setField('internalLog', `Error in getChargerStatus: ${error.message}`)
            .setField('message', 'Error retrieving charger status')
            .setField('errorType', SessionFlowLogsErrorTypes.INTERNAL_ERROR)
            .setField('statusCode', 500);
        throw new Error();
    }

}

module.exports = {
    getChargerStatus
};