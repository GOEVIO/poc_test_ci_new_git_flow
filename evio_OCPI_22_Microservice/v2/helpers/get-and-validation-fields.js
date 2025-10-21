const { isEmptyObject } = require('./check-empty-object');
const { Enums } = require('evio-library-commons').default;

/**
 * Extracts and validates required parameters from the request object.
 * Throws a SendRejectResponse error if any required field is missing or invalid.
 *
 * @param {Object} req - The Express request object.
 * @param {Object} req.body - The request body containing parameters.
 * @param {Object} req.headers - The request headers.
 * @returns {Object} An object containing validated and normalized parameters:
 *   - {string} hwId - Hardware ID.
 *   - {string} evId - Electric Vehicle ID.
 *   - {string} plugId - Plug ID.
 *   - {Object} ceme - CEME object.
 *   - {string} userId - User ID (from headers or default '-1').
 *   - {string} idTag - Token ID.
 *   - {string} paymentType - Payment type (always "MONTHLY").
 *   - {string} billingPeriod - Billing period ("AD_HOC" if not provided).
 * @throwError {SendRejectResponse} If any required parameter is missing or invalid.
 */
const getAndValidationFields = (req, reject) => {
    const data = req?.body;
    if (isEmptyObject(data)) {
        reject.throwError({ codeOverride: "server_data_required", messageOverride: 'Data required' });
    };
    data.userId = req.headers['userid'] || '-1';

    [
        {
            field: 'hwId',
            code: 'server_hw_required',
            message: 'HwId required'
        },
        {
            field: 'evId',
            code: 'server_ev_id_required',
            message: 'EV ID required'
        },
        {
            field: 'plugId',
            code: 'server_plug_id_required',
            message: 'Plug ID required'
        },
        {
            field: 'ceme',
            code: 'server_ceme_required',
            message: 'CEME required'
        },
        {
            field: 'userId',
            code: 'server_user_id_required',
            message: 'User ID required'
        }
    ].forEach(({ field, code, message }) => {
        if (!data[field]) {
            reject.setField('code', code)
                .setField('internalLog', `${field} not found or invalid in request body`)
                .setField('message', message)
                .setField('errorType', Enums.SessionFlowLogsErrorTypes.VALIDATION_ERROR)
            throw new Error()
        } else if (field !== 'ceme') {
            reject.setField(field, data[field]);
        }
    });

    if (!data?.idTag || data.idTag == "-1") {
        reject.setField('code', 'server_error_token_not_found')
            .setField('internalLog', `invalid idTag ${data.idTag}`)
            .setField('message', `Error creating Token`)
            .setField('errorType', Enums.SessionFlowLogsErrorTypes.VALIDATION_ERROR)
        throw new Error()
    }

    return {
        hwId: data.hwId,
        evId: data.evId,
        plugId: data.plugId,
        ceme: data.ceme,
        userId: data.userId,
        idTag: data.idTag,
        billingPeriod: data?.billingPeriod || "AD_HOC",
    };

}

module.exports = {
    getAndValidationFields
};