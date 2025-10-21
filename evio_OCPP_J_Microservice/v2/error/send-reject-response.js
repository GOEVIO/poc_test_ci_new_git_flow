const {
	SessionFlowLogsStatus,
	SessionFlowLogsErrorTypes,
} = require('../configs/constants');
const { saveSessionLogs } = require('../../utils/save-session-logs');
const { saveLog } = require('../../utils');
/**
 * Custom error class for sending a reject response with additional context.
 *
 * @class SendRejectResponse
 * @extends Error
 */
class SendRejectResponse extends Error {
	/**
	 * Creates an instance of SendRejectResponse.
	 *
	 * @param {Object} params - The parameters for the reject response.
	 * @param {boolean} [params.auth=false] - Indicates if authentication is required.
	 * @param {string} [params.code="server_reject_response"] - The error code.
	 * @param {string} [params.message="Reject response"] - The public error message.
	 * @param {string} [params.internalLog=""] - Internal log message for debugging.
	 * @param {string} [params.authorization_reference="No session created for this error"] - Reference for authorization/session.
	 * @param {string} [params.hwId=""] - Hardware ID related to the error.
	 * @param {string} [params.userId=""] - User ID related to the error.
	 * @param {string} [params.sessionId="-1"] - Session ID related to the error.
	 * @param {SessionFlowLogsStatus} params.status - The status of the session flow.
	 * @param {string} params.action - The action performed in the session flow.
	 * @param {Object} params.request - The request object related to the session.
	 * @param {string} params.stage - The stage of the session flow.
	 * @param {string} params.errorType - The type of error encountered. 
	 * @param {string} params.logMessage - The log message to be recorded.
	 * @param {string} [params.stage_pre_fix=''] - Optional prefix for the stage.
	 */
	constructor({
		auth = true,
		code = "server_reject_response",
		message = "Reject response",
		internalLog = "",
		authorization_reference = "No session created for this error",
		hwId = "",
		userId = "",
		sessionId = "-1",
		status = SessionFlowLogsStatus.ERROR,
		request = {},
		action = '',
		stage = '',
		errorType = SessionFlowLogsErrorTypes.VALIDATION_ERROR,
		logMessage = '',
		stage_pre_fix = '',
		responseAlreadySended = false,
		statusCode = 400,
		plugId = '',
		response = '',
		success = false,
		type = 'RemoteStartTransaction',
		text = '',
		trigger = 'server_ocpp_trigger_cs'
	} = {}) {
		super(message);
		this.name = this.constructor.name;
		this.auth = auth;
		this.code = code;
		this.message = message;
		this.internalLog = internalLog;
		this.authorization_reference = authorization_reference;
		this.hwId = hwId;
		this.userId = userId;
		this.sessionId = sessionId;
		this.status = status;
		this.action = action;
		this.request = request;
		this.stage = stage;
		this.errorType = errorType;
		this.logMessage = logMessage;
		this.stage_pre_fix = stage_pre_fix;
		this.retries = [];
		this.responseAlreadySended = responseAlreadySended;
		this.statusCode = statusCode;
		this.plugId = plugId;
		this.response = response;
		this.success = success;
		this.type = type;
		this.text = text;
		this.trigger = trigger;
		this.requestUtilsLog = null;
	}

	/**
	 * Sets a specific field of the error object.
	 *
	 * @param {string} field - The name of the field to update.
	 * @param {*} value - The value to set.
	 * @returns {SendRejectResponse} - The same instance for chaining.
	 */
	setField(field, value) {
		this[field] = value;
		return this;
	}

	saveLogs(){
		saveSessionLogs({
			hwId: this.hwId,
			userId: this.userId,
			sessionId: this.sessionId.toString(),
			status: this.status,
			action: this.action,
			request: this.request,
			errorMessage: this.logMessage || this.message,
			errorType: this.errorType,
			stage: this.stage_pre_fix + this.stage,
			retries: this.retries,
			plugId: this.plugId,
		});
		this.saveUtilsLogs();
	}

	saveUtilsLogs(){
		saveLog(
			this.hwId,
			this.requestUtilsLog || this.request,
			this.response,
			this.success,
			this.type,
			this.text || this.message,
			this.plugId,
			this.trigger
		);
	}

	/**
	 * Adds a retry attempt to the retries list with relevant details.
	 *
	 * @param {Object} params - The parameters for the retry attempt.
	 * @param {number} params.retryAttempt - The current retry attempt number.
	 * @param {number} [params.timestamp=Date.now()] - The timestamp of the retry attempt.
	 * @param {?string} [params.commandResponseStatus=null] - The status of the command response, if any.
	 * @param {?string} [params.commandResultStatus=null] - The status of the command result, if any.
	 * @param {string} [params.message=''] - An optional message describing the retry attempt.
	 */
	pushAttempts({
		retryAttempt,
		timestamp = new Date(),
		commandResponseStatus = null,
		commandResultStatus = null,
		message = ''
	}) {
		this.retries.push({
			retryAttempt,
			timestamp,
			commandResponseStatus,
			commandResultStatus,
			message
		});
	}

	/**
	 * Throws a new SendRejectResponse error based on the current instance data.
	 *
	 * @param {string} [message] - Optional override for the error message.
	 * @param {string} [code] - Optional override for the error code.
	 * @param {string} [internalLog] - Optional override for the internal log message.
	 * @throwError {SendRejectResponse}
	 */
	throwError({ message = '', code = '', internalLog = '' } = {}) {
		this.message = message || this.message;
		this.code = code || this.code;
		this.internalLog = internalLog || this.internalLog;
		this.saveLogs();
		if(this.responseAlreadySended) {
			console.warn('Response already sent, cannot throw error again');
			console.warn('Error details:', {
				auth: this.auth,
				code: this.code,
				message: this.message,
				internalLog: this.internalLog,
				authorization_reference: this.authorization_reference,
				hwId: this.hwId,
				userId: this.userId,
				sessionId: this.sessionId.toString(),
			});
			return;
		}
		throw new SendRejectResponse({
			auth: this.auth,
			code: this.code,
			message: this.message,
			internalLog: this.internalLog,
			authorization_reference: this.authorization_reference,
			hwId: this.hwId,
			userId: this.userId,
			sessionId: this.sessionId.toString(),
			status: this.statusCode,
		});
	}
}

module.exports = SendRejectResponse;
