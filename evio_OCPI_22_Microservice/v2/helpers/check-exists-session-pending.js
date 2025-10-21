const { findSession } = require('../repositories/session.repository');
const { Enums } = require('evio-library-commons').default;

const checkExistsSessionPending = async (hwId, evse_uid, reject) => {
    const query = {
        location_id: hwId,
        evse_uid: evse_uid,
        status: {$in:[ Enums.SessionStatusesTextTypes.PENDING, Enums.SessionStatusesTextTypes.PENDING_DELAY, Enums.SessionStatusesTextTypes.PENDING_START]}
    };
    const session = await findSession(query);
    if (session) {
        reject.setField('code', 'server_charger_already_occupied')
            .setField('internalLog', `There is another session in ${session.status} status`)
            .setField('stage', ` Find by query ${JSON.stringify(query || {})}`)
            .setField('message', `EVSE occupied - There is another session in ${session.status} status`)
            .setField('errorType', Enums.SessionFlowLogsErrorTypes.VALIDATION_ERROR);
        throw new Error();
    }
};

module.exports = {
    checkExistsSessionPending
};