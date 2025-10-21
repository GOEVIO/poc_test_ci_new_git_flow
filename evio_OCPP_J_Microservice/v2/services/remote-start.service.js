const moment = require('moment');
const { v4: UUID } = require('uuid');
const WebSocket = require('ws');

const { Helpers } = require('evio-library-commons').default;

const { findSessionById, updateChargingSessionStatusMessageCommands } = require('evio-library-chargers').default;

const {
	RETRY_INTERVAL_MS,
	TOTAL_TIMEOUT_MS,
	MAX_RETRIES_BEFORE_PENDING_DELAY,
	MAX_MS_BEFORE_PENDING_DELAY,
	MIN_MS_BEFORE_PENDING_DELAY,
	ChargerAccessFreeCharge,
	PaymentMethodNotPay,
	StartCommand,
	OCPPJ_16_DeviceType,
	MAX_MS_WAIT_PUT_SESSION,
	createdWayControlCenter,
	SessionStatusesNumberTypes,
    SessionFlowLogsErrorTypes,
    SessionCommandResponseType,
    ChargerCommandResultType,
    SessionFlowLogsStatus,
    OcppWebSocketTypes,
	DeviceTypes,
	CreateWaySessionsType
} = require('../configs/constants');

const SendResponse = require('../error/send-reject-response');

const { validationFields } = require('../validations/remote-start');

const { sleep } = require('../helpers/sleep');
const { getRandomInt } = require('../helpers/get-random-int');
const { getChargerStatus } = require('../helpers/get-charger-status');
const { getAllUsersInfos, getAllOneUserInfo } = require('../helpers/get-all-users-infos');
const { getUserInPreAuthorization } = require('../helpers/get-user-pre-authorization');
const { getUserCoordinates } = require('../../utils/coordinates');

const { ChargerClient } = require('../clients/charger.client');

const { getFeesWithUser } = require('../../utils');


/**
 * Handles the remote start session process for an EV charging station via OCPP-J protocol.
 *
 * The RemoteStartSession class manages the lifecycle of a remote charging session, including:
 * - Validating requests and user permissions
 * - Managing WebSocket communication with the charging station
 * - Handling retries, timeouts, and command responses
 * - Creating and tracking charging sessions with billing and user information
 * - Logging and error handling throughout the session flow
 *
 * @class
 * @classdesc
 * This class encapsulates the logic required to remotely initiate a charging session on a charger,
 * including all necessary checks, session creation, and command dispatching to the charging station.
 *
 * @param {Object} req - The HTTP request object containing session and user data.
 * @param {Object} res - The HTTP response object for sending responses.
 * @param {WebSocket.Server} wss - The WebSocket server instance managing charger connections.
 * @param {EventEmitter} eventEmitter - The event emitter for handling asynchronous command responses.
 *
 * @property {Object} req - The HTTP request object.
 * @property {Object} res - The HTTP response object.
 * @property {WebSocket} client - The WebSocket client representing the charger connection.
 * @property {SendResponse} reject - Helper for managing error responses and logs.
 * @property {number} startTime - Timestamp when the session process started.
 * @property {Object} charger - The charger status and configuration.
 * @property {string} hwId - Hardware ID of the charger.
 * @property {Object} session - The created charging session object.
 * @property {Object} commandResponse - The response from the charger to the remote start command.
 * @property {string} message - Reason for command rejection.
 * @property {number} attemptCount - Number of command attempts made.
 * @property {number} firstCommandAttemptReject - Number of initial command rejections.
 * @property {string} currentStatus - Current status of the session flow.
 * @property {ChargerClient} chargerClient - Client for charger-related operations.
 * @property {string} action - OCPP action being performed.
 * @property {string} messageId - Unique message ID for the OCPP command.
 * @property {Array} call - The OCPP call message array.
 *
 * @example
 * const session = new RemoteStartSession(req, res, wss, eventEmitter);
 * await session.remoteStartSession();
 */
class RemoteStartSession {
	req;
	res;
	client;
	wss;
	eventEmitter;
	reject;
	startTime;
	charger;
	hwId;
	session;
	sessionId;
	commandResponse;
	message = 'session_cs_rejected';
	attemptCount = 0;
	firstCommandAttemptReject = 0;
	currentStatus;
	chargerClient;
	action;
	messageId;
	call;
	errorType;
	isDeviceSession;

	constructor(req, res, wss, eventEmitter) {
		this.startTime = Date.now();
		this.reject = new SendResponse();
		this.req = req;
		this.res = res;
		this.reject.setField('request', this.req?.body || {});
		this.reject.setField('action', 'start');
		this.reject.setField('stage_pre_fix', `[OCPP - RemoteStartSession]`);
		this.chargerClient = new ChargerClient();
		this.action = 'RemoteStartTransaction';
		this.messageId = UUID();
		this.wss = wss;
		this.eventEmitter = eventEmitter;
	}

	// -- INTERNAL HELPERS METHODS -- //

	/**
	 * Sets the `client` property to the WebSocket client whose `id` matches `hwId`.
	 * Iterates through all connected WebSocket clients and assigns the matching client to `this.client`.
	 *
	 * @returns {void}
	 */
	setClient(){
		const clients = Array.from(this.wss.clients);
        this.client = clients.filter(a => a.id == this.hwId)[0];
	}

	/**
	 * Calculates the remaining time before a total timeout is reached.
	 *
	 * @returns {number} The number of milliseconds left until the timeout, or 0 if the timeout has already elapsed.
	 */
	getTimeLeft(ms = TOTAL_TIMEOUT_MS) {
		const elapsedTime = Date.now() - this.startTime;
		return Math.max(ms - elapsedTime, 0);
	}

	/**
	 * Determines whether a delay is necessary before issuing the next command attempt.
	 *
	 * The method checks if the number of failed command attempts has reached or exceeded
	 * the maximum allowed before a pending delay, and if the remaining time is less than or equal
	 * to the total timeout minus the minimum milliseconds before a pending delay.
	 * Alternatively, it checks if the remaining time is less than or equal to the total timeout
	 * minus the maximum milliseconds before a pending delay.
	 *
	 * @returns {boolean} True if a delay is necessary before the next command attempt, otherwise false.
	 */
	isNecessaryCommandDelayStatus() {
		const isTotalMsBeforePendingDelay = this.getTimeLeft() <= (TOTAL_TIMEOUT_MS - MIN_MS_BEFORE_PENDING_DELAY);
		const isMaxMsBeforePendingDelay = this.getTimeLeft() <= (TOTAL_TIMEOUT_MS - MAX_MS_BEFORE_PENDING_DELAY);
		const isTotalAttemptsBeforePendingDelay = this.firstCommandAttemptReject >= MAX_RETRIES_BEFORE_PENDING_DELAY;
		const isCurrentStatusPendingDelay = this.currentStatus === SessionStatusesNumberTypes.PENDING_DELAY;

		if (
			(
				(isTotalAttemptsBeforePendingDelay && isTotalMsBeforePendingDelay)
				|| isMaxMsBeforePendingDelay
			)
			&& !isCurrentStatusPendingDelay
		) {
			this.currentStatus = SessionStatusesNumberTypes.PENDING_DELAY;
			return true;
		}
		return false;
	}

	/**
	 * Checks if the WebSocket client connection to the charging station is established.
	 * If the connection is not open, sets error fields on the reject object and throws an error.
	 *
	 * @throws {Error} Throws an error if the WebSocket connection is not established.
	 */
	checkClientConnection() {
		if (!this.client || this.client.readyState !== WebSocket.OPEN) {
			const message = `[Remote Start Transaction] Communication not established between the CS and the charging station ${this.req.body.hwId}`;
			this.reject.setField('code', 'server_error_connecting_charging_station')
				.setField('message', message)
				.setField('errorType', SessionFlowLogsErrorTypes.DEVICE_COMMUNICATION_ERROR);
			throw new Error();
		}
	}

	/**
	 * Invalidates the current charging session by updating charger information,
	 * marking the session as invalid, and throwing an error with the rejection reason.
	 *
	 * @throws {Error} Throws an error with the rejection reason after invalidating the transaction.
	 */
	async invalidateTransaction() {
		console.log('\nInvalidating transaction due to session timeout or rejection');
		this.reject.setField('status', SessionFlowLogsStatus.ERROR);

		await this.chargerClient.updateSession({
			_id: this.session._id,
			status: SessionStatusesNumberTypes.INVALID,
			stopReason: {
				reasonCode: "other",
				reasonText: this.commandResponse.accept ? 'User did not connect the plug' : "Communication not established between the Central System and the Charging Station"
			},
			message: this.commandResponse.accept ? 'session_timeout' : 'session_cs_rejected',
			errorType: this.commandResponse.accept ? 'TIMEOUT' : 'CS'
		}, this.reject);

		this.reject.throwError();
	}

	getCreatedWay(){
		const createdWayObject = {
			[DeviceTypes.APT]: CreateWaySessionsType.APT_START_SESSION,
			[DeviceTypes.QR_CODE]: CreateWaySessionsType.QR_CODE_START_SESSION,
		}

		return createdWayObject[this.isDeviceSession?.deviceType] || CreateWaySessionsType.REMOTE_START_SESSION;
	}

	/**
	 * Periodically checks the status of a session to determine if it has become active within a maximum wait time.
	 * If the session becomes active, the function returns early.
	 * If the session times out or is rejected, sets the appropriate reject reason.
	 * If the maximum wait time is exceeded, logs an error, sets rejection fields, and invalidates the session.
	 *
	 * @async
	 * @returns {Promise<void>}
	 */
	async checkPutSession() {
		while (this.getTimeLeft(MAX_MS_WAIT_PUT_SESSION) > 0) {
			try {
				const session = await findSessionById(this.sessionId, { status: 1, stopReason: 1 });
				if (session.status === SessionStatusesNumberTypes.ACTIVE) {
					await updateChargingSessionStatusMessageCommands({
						_id: this.sessionId,
						status: SessionStatusesNumberTypes.ACTIVE,
						message: 'session_active'
					});
					console.log('Session is already active');
					return;
				}

				await sleep(RETRY_INTERVAL_MS);
			} catch (err) {
				console.error('Error in session start flow:', err.message);
				await sleep(RETRY_INTERVAL_MS);
			}
		}

		console.error('\n[RemoteStartSession] Session start flow timed out, invalidating session');
		this.reject.setField('code', 'server_error_remote_start_failed')
		.setField('internalLog', 'Session start flow timed out, invalidating session')
		.setField('message', 'Session start flow timed out, put session not received, invalidating session')
		.setField('errorType', SessionFlowLogsErrorTypes.TIMEOUT_ERROR);

		this.invalidateTransaction();
	}

	/**
	 * Checks if the given user is allowed to start a free charging transaction.
	 * If the user is not allowed, sets error details and throws an error.
	 *
	 * @param {string|number} userId - The ID of the user attempting to start the transaction.
	 * @throws {Error} Throws an error if the user is not permitted to start a free transaction.
	 */
	checkIsUserAllowedToStartFreeTransaction(userId) {
		if (userId !== this.charger.operatorId) {
			this.reject.setField('code', 'server_userId_required')
				.setField('message', `RemoteStartTransaction failed because userId ${userId} has not permission to charge in this charging station via free mode`)
				.setField('errorType', SessionFlowLogsErrorTypes.AUTHENTICATION_ERROR)
				.setField('stage', 'checkIsUserAllowedToStartFreeTransaction')
				.setField('statusCode', 500);
			throw new Error();
		}
	}

	async getUserInfoDevices(preAuthorization, userId){
		let userIdToFind = userId;
		const usersData = {
			userIdInfo: preAuthorization?.billingInfo,
			userIdWillPayInfo: preAuthorization?.billingInfo,
			userIdToBillingInfo: preAuthorization?.billingInfo
		}

		if(this.isDeviceSession.deviceType === DeviceTypes.QR_CODE){
			userIdToFind = preAuthorization?.userId ? preAuthorization.userId : null;
		}

		if(userIdToFind){
			const userIdInfo = await getAllOneUserInfo(userIdToFind, this.reject);
			if(userIdInfo && Object.keys(userIdInfo)?.length){
				usersData.userIdInfo = userIdInfo;
			}
		}

		return usersData;

	}


	// -- START FLOW METHODS -- //
	/**
	 * Initiates a remote charging session for an EV charger.
	 *
	 * This method validates the request, prepares session data, handles user and billing information,
	 * and creates a new charging session. It supports free start transactions, custom billing periods,
	 * and various payment and user configurations. If the session is successfully created, it returns
	 * session details; otherwise, it throws an error with detailed context.
	 *
	 * @async
	 * @function
	 * @returns {Promise<Object>} An object containing session creation status, sessionId, hwId, and userId.
	 * @throws {Error} Throws a detailed error if session creation fails.
	 */
	async remoteStartSession() {
		try {
			console.log('\n[RemoteStartSession] Starting remote session flow...');
			this.reject.setField('stage', 'Route [POST /api/private/connectionstation/ocppj/start]');
			const isFreeStartTransaction = this.req.body.freeStartTransaction || false;

			if (isFreeStartTransaction) {
				this.req.body.idTag = getRandomInt(1_000_000_000, 9_999_999_999).toString();
			}
			this.isDeviceSession = Helpers.verifyIsDeviceRequest(this.req.body.clientType);

			validationFields(this.req, this.reject);

			const { hwId, idTag, tariffId, plugId, deviceIdentifier = '' } = this.req.body;
			this.hwId = hwId;
			this.setClient();

			let billingPeriod = this.req.body.billingPeriod;
			if (!billingPeriod || this.isDeviceSession?.isDevice) {
				billingPeriod = "AD_HOC"
			}

			let userId = this.isDeviceSession?.isDevice && this.req.body.userId ? this.req.body.userId : this.req.headers['userid'];
			const autoStop = this.req.body.autoStop;

			this.checkClientConnection();

			this.charger = await getChargerStatus(hwId, this.reject);

			const dateNow = moment(new Date().toISOString()).utc();

			let body = {
				hwId,
				idTag,
				tariffId,
				command: StartCommand,
				chargerType: this.charger.chargerType ? this.charger.chargerType : OCPPJ_16_DeviceType,
				status: SessionStatusesNumberTypes.PENDING,
				userId,
				plugId,
				startDate: dateNow,
				authType: this.isDeviceSession?.isDevice ? 'AD_HOC_USER' : 'APP_USER',
				address: this.charger.address,
				freeOfCharge: this.charger.accessType === ChargerAccessFreeCharge,
				operatorId: this.charger.operatorId,
				userCoordinates: getUserCoordinates(this.req.body),
				notes: this.req.body.notes ? this.req.body.notes : "",
				message: 'session_preparing',
				deviceIdentifier: deviceIdentifier ? deviceIdentifier : ""
			};

			if(isFreeStartTransaction){
				this.checkIsUserAllowedToStartFreeTransaction(userId);
				body = {
					...body,
					fees: fees ?? await getFeesWithUser(this.charger, this.req?.body?.userIdToBilling),
					evId: "-1",
					fleetId: "-1",
					sessionPrice: -1,
					tariffId: "-1",
					userIdWillPay: this.charger.createUser,
					paymentMethod: PaymentMethodNotPay,
					createdWay: createdWayControlCenter,
				};
			}else{
				let userPromiseResult = {
					userIdInfo: null,
					userIdWillPayInfo: null,
					userIdToBillingInfo: null
				};
				if(this.isDeviceSession?.isDevice){
					const preAuthorization = await getUserInPreAuthorization(this.req.body.adyenReference)
					if(preAuthorization && Object.keys(preAuthorization)?.length){
						userPromiseResult = await this.getUserInfoDevices(preAuthorization, userId);

						if(this.isDeviceSession.deviceType === DeviceTypes.QR_CODE && preAuthorization?.userId){
							userId = preAuthorization.userId;
							body.userId = preAuthorization.userId;
						}
					}
				}else{
					userPromiseResult = await getAllUsersInfos(
						userId,
						this.req.body.userIdWillPay,
						this.req.body.userIdToBilling,
						this.reject
					)
				}

				body = {
					...body,
					autoStop,
					billingPeriod,
					plafondId: this.req.body.plafondId,
					paymentMethod: this.req.body.paymentMethod,
					userIdInfo: userPromiseResult.userIdInfo,
					userIdWillPayInfo: userPromiseResult.userIdWillPayInfo,
					userIdToBillingInfo: userPromiseResult.userIdToBillingInfo,
					createdWay: this.getCreatedWay(),
				};

				const paramsGetFromBody = [
					'paymentMethodId', 'walletAmount', 'reservedAmount', 'confirmationAmount',
					'adyenReference', 'transactionId', 'address', 'tariff', 'cardNumber', 'clientType', 'paymentType',
					'clientName', 'userIdToBilling', 'plafondId', 'fees', 'evId', 'userIdWillPay'
				];

				paramsGetFromBody.forEach(param => {
					if (this.req.body[param]) {
						body[param] = this.req.body[param];
					}
				});

				if (userId == this.charger.createUser || this.charger.accessType === ChargerAccessFreeCharge) {
					body.tariffId = "-1";
					body.tariff = {};
					body.paymentMethod = PaymentMethodNotPay
				}
			}

			if(this.req.body?.sessionSimulation){
				body.sessionSimulation = this.req.body.sessionSimulation;
			}

			this.session = await this.chargerClient.createSession(body, this.reject);
			this.sessionId = this.session._id.toString();
			this.currentStatus = SessionStatusesNumberTypes.PENDING;
			this.reject
				.setField('sessionId', this.sessionId)
				.setField('externalSessionId', this.session.id);

			let data = {
				idTag: idTag,
				connectorId: parseInt(plugId)
			};
			this.reject.setField('requestUtilsLog', data)

			this.call = [OcppWebSocketTypes.callRequest, this.messageId, this.action, data];
			this.reject.setField('responseAlreadySended', true)

			return {
				auth: 'true',
				code: "",
				message: 'Session created successfully, attempting to command start',
				sessionId: this.sessionId,
				hwId: this.hwId,
				userId: userId,
			};

		} catch (error) {
			if (error?.message) {
				console.error("[Service - remoteStartSession] Error:", error.message);
				this.reject.setField('code', 'server_error_remote_start_failed')
					.setField('internalLog', JSON.stringify(error))
					.setField('message', error.message || "Error starting remote session")
					.setField('errorType', SessionFlowLogsErrorTypes.INTERNAL_ERROR);
			}
			throw this.reject.throwError();
		}

	}


	/**
	 * Attempts to send the START_SESSION command repeatedly until it is accepted or the allowed time elapses.
	 * Handles command rejection, retries with a delay, and logs each attempt.
	 * If the command is not accepted after all attempts, marks the session with a device communication error and invalidates the transaction.
	 * On success, restarts the timer and proceeds to check the session status.
	 *
	 * @async
	 * @returns {Promise<void>} Resolves when the command is accepted and the session check is initiated, or when the transaction is invalidated.
	 */
	async attemptToCommands() {
		while (this.getTimeLeft() > 0) {
			try {
				console.log('\nSending START_SESSION command...');
				if (this.isNecessaryCommandDelayStatus()) {
					await updateChargingSessionStatusMessageCommands({
						_id: this.sessionId,
						status: SessionStatusesNumberTypes.PENDING_DELAY,
						message: 'session_keep_waiting'
					});
				}

				// Waits for the asynchronous response from the charger via WebSocket.
				// The response is handled through an event listener inside clientSendCommand().
				await this.clientSendCommand();

				if (!this.commandResponse?.accept) {
					this.firstCommandAttemptReject++;
					this.reject.pushAttempts({
						retryAttempt: this.attemptCount,
						commandResponseStatus: this.commandResponse?.result || SessionCommandResponseType.ERROR_UNKNOWN_RESPONSE,
						message: `Command response rejected, command message: ${this.commandResponse?.message || "No command response message"}`
					});
					console.log('Command response not accepted or missing. Retrying...');
					await sleep(RETRY_INTERVAL_MS);
					continue;
				}

				console.log('\nCommand response accepted:', this.commandResponse);
				await updateChargingSessionStatusMessageCommands({
					_id: this.sessionId,
					status: SessionStatusesNumberTypes.PENDING_START,
					message: 'session_connect_plug',
					commandResponseDate: new Date(),
					notes: "Command Start accepted"
				});

				this.reject.pushAttempts({
					retryAttempt: this.attemptCount,
					commandResponseStatus: this.commandResponse?.result,
					message: `Command response accepted, command message: ${this.commandResponse?.message || "No command response message"}`
				});

				break;
			} catch (err) {
				console.error('Error in session start flow:', err.message);
				await sleep(RETRY_INTERVAL_MS);
			}
		}

		if (!this?.commandResponse?.accept) {
			this.reject.setField('errorType', SessionFlowLogsErrorTypes.DEVICE_COMMUNICATION_ERROR);
			this.invalidateTransaction();
			return;
		}

		// Restart the timer for checking the put session
		console.log('\n[RemoteStartSession] Session start flow completed, starting timer for "PUT" session...');
		this.startTime = Date.now();
		await this.checkPutSession();
	}

	/**
	 * Sends a remote start command to the client and handles the response.
	 *
	 * This method serializes the command (`this.call`) and sends it via the client's WebSocket connection.
	 * It then listens for a response event identified by `this.messageId`. Based on the response status,
	 * it logs the outcome and sets the `commandResponse` property accordingly.
	 *
	 * Logging and error handling are performed using the `this.reject` object, which records the result,
	 * success status, messages, and error types.
	 *
	 * @returns {void}
	 */
	clientSendCommand() {
		console.log(`\n[RemoteStartSession] Sending command: ${this.action} with messageId: ${this.messageId}`);
		this.checkClientConnection();
		return new Promise((resolve) => {
			const listener = async (result) => {
				console.log(`\n[RemoteStartSession] Received response for messageId: ${this.messageId}`, result);
				this.reject.setField('response', result);

				const remoteStartTransactionStatus = result.status;

				if (remoteStartTransactionStatus === ChargerCommandResultType.ACCEPTED) {
					this.reject.setField('success', true)
						.setField('text', 'RemoteStartTransaction accepted')
						.setField('status', SessionFlowLogsStatus.SUCCESS)
						.saveLogs();

					this.commandResponse = {
						accept: true,
						message: 'RemoteStartTransaction accepted',
						result: remoteStartTransactionStatus,
					};
				} else {
					const isRejected = remoteStartTransactionStatus === ChargerCommandResultType.REJECTED;
					console.log(`\n[RemoteStartSession] RemoteStartTransaction not accepted, status: ${remoteStartTransactionStatus}`);

					this.reject.setField('text', isRejected ? 'RemoteStartTransaction rejected' : 'Unknown remoteStart response status')
						.setField('errorType', SessionFlowLogsErrorTypes.EXTERNAL_SERVICE_ERROR)
						.setField('message', `[clientSendCommand] RemoteStartTransaction ${isRejected ? 'rejected' : `unknown status: ${remoteStartTransactionStatus}`}`)
						.saveLogs();

					this.commandResponse = {
						accept: false,
						message: 'RemoteStartTransaction rejected or unknown status',
						result: remoteStartTransactionStatus,
					};
				}

				resolve();
			};

			let timeout;
			const timeoutMs = 10000;

			const cleanup = () => {
				this.eventEmitter.removeListener(this.messageId, listener);
				if (timeout) clearTimeout(timeout);
			};

			this.eventEmitter.on(this.messageId, (...args) => {
				cleanup();
				listener(...args);
			});

			timeout = setTimeout(() => {
				console.warn(`[RemoteStartSession] Timeout waiting for response for messageId: ${this.messageId}`);
				cleanup();
				this.commandResponse = {
					accept: false,
					message: 'Timeout waiting for response from client',
					result: SessionCommandResponseType.UNKNOWN_SESSION,
				};
				resolve();
			}, timeoutMs);

			this.client.send(JSON.stringify(this.call), (err) => {
				if (err) {
					console.error('\n[RemoteStartSession] Error sending command to client:', err);

					this.eventEmitter.removeListener(this.messageId, listener);

					this.commandResponse = {
						accept: false,
						message: 'Error sending command to client',
						result: SessionCommandResponseType.ERROR_UNKNOWN_RESPONSE,
					};

					resolve();
				}
			});
		});
	}

};


module.exports = {
	RemoteStartSession
};

