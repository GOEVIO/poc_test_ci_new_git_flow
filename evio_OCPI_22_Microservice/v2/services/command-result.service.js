const { Enums, Helpers } = require('evio-library-commons').default;
const { findSession, updateSessionCommandResult } = require('../repositories/session.repository')
const Utils = require('../../utils');
const UtilsFirebase = require('../../utils_firebase');
const { saveSessionLogs } = require('../../functions/save-session-logs');

class CommandResultSession {
	baseDataToSaveLog = {
		userId: '',
		hwId: '',
		plugId: '',
		sessionId: '',
		externalSessionId: '',
		stage: "[HandlerCommandResult.commandResultStartSession]",
		action: "start",
		status: Enums.SessionFlowLogsStatus.ERROR,
		errorType: Enums.SessionFlowLogsErrorTypes.VALIDATION_ERROR,
	}

	constructor(req, res) {
		this.req = req;
		this.res = res;
	}

	async handleCommandResult(){
		try {
			const data = this.req.body;

			if (Utils.isEmptyObject(data)){
				saveSessionLogs({
					...this.baseDataToSaveLog,
					errorMessage: 'Empty request body - Invalid or missing parameters',
				})
				return this.res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));
			}
			this.baseDataToSaveLog.payload = this.req.body;

			const authorization_reference = this.req.params.authorization_reference;
			if (!authorization_reference) {
				saveSessionLogs({
					...this.baseDataToSaveLog,
					errorMessage: 'Not Found authorization_reference - Invalid URL',
				})
				return this.res.status(200).send(Utils.response(null, 2000, "Invalid URL"));
			}
			this.baseDataToSaveLog.externalSessionId = authorization_reference;
			console.log("CommandResult received " + authorization_reference);
			console.log(data);

			const result = data.result;
			let message = "";
			if (data?.message?.length > 0 && data.message[0].text) {
				message = data.message[0].text;
			}

			let query = {
				authorization_reference
			};

			const session = await findSession(query);

			if(!session){
				saveSessionLogs({
					...this.baseDataToSaveLog,
					errorMessage: `Not found session - Invalid or missing parameters: ${authorization_reference} message: ${message}`,
				})
				return this.res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));
			}
			this.baseDataToSaveLog.userId = session.userId;
			this.baseDataToSaveLog.hwId = session.location_id;
			this.baseDataToSaveLog.plugId = session.connector_id;
			this.baseDataToSaveLog.sessionId = session._id;
			this.baseDataToSaveLog.externalSessionId = session?.id || '';

			console.log(`\nSession Remote Start Command Result ${authorization_reference} ${result}\n`);
			if (result === Enums.SessionCommandResultType.ACCEPTED) {
				await updateSessionCommandResult(authorization_reference, session.status, `Command result accepted: ${message}` || `Command result accepted without message, result: ${result}`, result, 'session_connect_plug');
				const isDeviceSession = Helpers.verifyIsDeviceRequest(session?.createdWay);
				if(session.source?.toUpperCase() === 'MOBIE' && !isDeviceSession?.isDevice) {
					UtilsFirebase.startFirebaseNotification([session]);
				}
				return this.res.status(200).send(Utils.response(null, 1000, "Success"));
			} else {
				let displayTextMessage = `Command result failed: ${message}` || `Command result failed without message, result: ${result}`
				if(result === Enums.SessionCommandResultType.TIMEOUT) {
					await Utils.updatePreAuthorize(session?.transactionId, true);
					displayTextMessage = `Command result timeout: ${message}` || `Command result timeout without message, result: ${result}`;
				}
				await updateSessionCommandResult(authorization_reference, session.status, displayTextMessage, result);

				return this.res.status(200).send(Utils.response(null, 1000, "Success"));
			}
		} catch (error) {
			saveSessionLogs({
				...this.baseDataToSaveLog,
				errorMessage: `Error processing command result: ${error.message}`,
			})
            return this.res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));
		}
	}
}

module.exports = {
	CommandResultSession
};

