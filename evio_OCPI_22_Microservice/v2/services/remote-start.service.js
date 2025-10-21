const { Enums, Helpers } = require('evio-library-commons').default;
const {
	RETRY_INTERVAL_MS,
	TOTAL_TIMEOUT_MS,
	MAX_RETRIES_BEFORE_PENDING_DELAY,
	MAX_MS_BEFORE_PENDING_DELAY,
	MIN_MS_BEFORE_PENDING_DELAY,
	MAX_MS_WAIT_PUT_SESSION,
	HubjectNetwork
} = require('../configs/constants');

const SendResponse = require('../error/send-reject-response');
const vatService = require('../../services/vat');

const Utils = require('../../utils');
const { sleep } = require('../helpers/sleep');
const { getAndValidationFields } = require('../helpers/get-and-validation-fields');
const { findPlug } = require('../helpers/find-plug');
const { findPlatformData } = require('../helpers/find-platform-data');
const { checkExistsSessionPending } = require('../helpers/check-exists-session-pending');
const { getTariffOPCRemoteStart } = require('../helpers/get-tariff-opc');
const { getTariffCEMERemoteStart } = require('../helpers/get-tariff-ceme');
const { getAllUsersInfos, getAllOneUserInfo } = require('../helpers/get-all-users-infos');
const { getAdHocTariff } = require('../helpers/get-ad-hoc-tariff');
const { getPlugTariffAdHocId } = require('../helpers/get-plug-tariff-ad-hoc-id');
const { formatAptTariffs } = require('../helpers/format-apt-tariffs');
const { getUserInPreAuthorization } = require('../helpers/get-user-pre-authorization');

const { getTokenByUid } = require('../repositories/token.repository');
const { getPlatformByPlatformCode } = require('../repositories/platforms.repository');
const { updateSessionCommandResponse, findSession, createSession, updateSessionByQuery } = require('../repositories/session.repository');

const { PublicNetworkClient } = require('../client/public-network.client');
const { PlatformClient } = require('../client/platform.client');
const { OICPClient } = require('../client/oicp.client');
const {  DevicesServiceClient } = require('../client/devices.client');

const { getUserCoordinates } = require('../../functions/coordinates')

/**
 * Handles the remote start session flow for EV charging, including validation, session creation,
 * command sending, retries, error handling, and session state management.
 *
 * This class encapsulates all logic required to initiate a remote charging session, interact with
 * platform services, manage retries and timeouts, and update session and charger states accordingly.
 *
 * @class
 *
 * @property {Object} req - The HTTP request object.
 * @property {Object} res - The HTTP response object.
 * @property {SendResponse} reject - Helper for managing error responses.
 * @property {number} startTime - Timestamp when the session flow started.
 * @property {string} authorization_reference - Unique reference for session authorization.
 * @property {Object} charger - Charger information object.
 * @property {string} endpoint - Platform endpoint for remote commands.
 * @property {string} platformToken - Token for platform authentication.
 * @property {string} responseUrl - URL for receiving platform responses.
 * @property {Object} tokenObj - Token object for authorization.
 * @property {string} hwId - Hardware ID of the charger.
 * @property {string} evse_uid - Unique identifier for the EVSE.
 * @property {Object} session - Session record object.
 * @property {Object} commandResponse - Result of the remote start command.
 * @property {Object} commandResult - Result of the command execution.
 * @property {string} message - Reason for session rejection.
 * @property {number} attemptCount - Counter for command attempts.
 * @property {number} firstCommandAttemptReject - Counter for failed command attempts.
 *
 * @constructor
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 *
 * @example
 * const remoteSession = new RemoteStartSession(req, res);
 * await remoteSession.remoteStartSession();
 *
 * @method getTimeLeft
 * @method isNecessaryCommandDelayStatus
 * @method invalidateTransaction
 * @method handleErrorCommandResponse
 * @method remoteStartSession
 * @method useVatServiceToGetFees
 * @method attemptToCommands
 * @method sendStartSessionCommand
 * @method checkCommandResult
 * @method checkPutSession
 */
class RemoteStartSession {
	req;
	res;
	version;
	reject;
	startTime;
	authorization_reference;
	charger;
	endpoint;
	platformToken;
	responseUrl;
	tokenObj;
	hwId;
	evse_uid;
	session;
	commandResponse;
	commandResult;
	message;
	attemptCount = 0;
	firstCommandAttemptReject = 0;
	isHubjectNetwork;
	currentStatus;
	publicNetworkClient;
	platformClient;
	oicpClient;
	restartCommunication;
	stopProcess;
	resultToStopProcess;
	hubjectNetworkSessionData;
	isDeviceSession;
	adyenReference;
	devicesServiceClient;
	pendingStatuses = [
		Enums.SessionStatusesTextTypes.PENDING,
		Enums.SessionStatusesTextTypes.PENDING_DELAY,
		Enums.SessionStatusesTextTypes.PENDING_START
	];

	constructor(req, res, version) {
		this.startTime = Date.now();
		this.reject = new SendResponse();
		this.authorization_reference = Utils.generateToken(24);
		this.req = req;
		this.res = res;
		this.version = version;
		this.reject.setField('request', this.req?.body || {});
		this.reject.setField('action', 'start');
		this.reject.setField('stage_pre_fix', `[OCPI - RemoteStartSession ${this.version}]`);
		this.publicNetworkClient = new PublicNetworkClient();
		this.platformClient = new PlatformClient();
		this.oicpClient = new OICPClient();
		this.devicesServiceClient = new DevicesServiceClient();
		this.resultToStopProcess = [Enums.SessionCommandResultType.EVSE_OCCUPIED, Enums.SessionCommandResultType.EVSE_INOPERATIVE];
	}

	// -- INTERNAL HELPERS METHODS -- //

	/**
	 * Calculates the remaining time before a total timeout is reached.
	 *
	 * @returns {number} The number of milliseconds left until the timeout, or 0 if the timeout has already elapsed.
	 */
	getTimeLeft(ms = TOTAL_TIMEOUT_MS) {
		const elapsedTime = Date.now() - this.startTime;
		return Math.max(ms - elapsedTime, 0);
	}

	isMissingTenSeconds() {
		const timeLeft = this.getTimeLeft();
		return timeLeft <= 10000;
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
		const isCurrentStatusPendingDelay = this.currentStatus === Enums.SessionStatusesTextTypes.PENDING_DELAY;

		if (
			(
				(isTotalAttemptsBeforePendingDelay && isTotalMsBeforePendingDelay)
				|| isMaxMsBeforePendingDelay
			)
			&& !isCurrentStatusPendingDelay && !this.restartCommunication
		) {
			this.currentStatus = Enums.SessionStatusesTextTypes.PENDING_DELAY;
			return true;
		}
		return false;
	}

	isCSError(){
		const resultIsTimeout = this.commandResult?.result === Enums.SessionCommandResultType.TIMEOUT;

		return !resultIsTimeout && (this.commandResult?.accept === false || this.commandResult?.result !== undefined)
		 || this.commandResponse?.accept === false;
	}

	getErrorMessageKey(){
		if(!this.isCSError()){
			return 'session_timeout';
		}

		switch (this.commandResult?.result) {
			case Enums.SessionCommandResultType.EVSE_OCCUPIED:
				return 'session_restarting_evse_occupied';
			case Enums.SessionCommandResultType.EVSE_INOPERATIVE:
				return 'session_restarting_evse_inoperative';
			default:
				return 'session_cs_rejected';
		}
	}

	/**
	 * Invalidates the current charging session by updating charger information,
	 * marking the session as invalid, and throwing an error with the rejection reason.
	 *
	 * @throws {Error} Throws an error with the rejection reason after invalidating the transaction.
	 */
	async invalidateTransaction() {
		if(!this.isDeviceSession?.isDevice){
			Utils.updatePreAuthorize(this.transactionId, true);
		}

		await updateSessionByQuery({ _id: this.session._id, status: {$in: this.pendingStatuses} }, {
			status: Enums.SessionStatusesTextTypes.INVALID,
			authorization_reference: this.authorization_reference,
			message: this.getErrorMessageKey(),
			errorType: this.isCSError() ? 'CS' : 'TIMEOUT'
		});
		this.reject.setField(
			'errorType', this.isCSError() ? Enums.SessionFlowLogsErrorTypes.DEVICE_COMMUNICATION_ERROR : Enums.SessionFlowLogsErrorTypes.TIMEOUT_ERROR)
			.setField('status', Enums.SessionFlowLogsStatus.ERROR)
			.throwError();
	}

	/**
	 * Handles errors that occur during the remote start command process.
	 * Analyzes the error object, extracts relevant information, sets appropriate error codes,
	 * logs internal details, and prepares a command response indicating failure.
	 *
	 * @param {Object} e - The error object thrown during the remote start process.
	 * @param {Object} [e.response] - Optional response object from an HTTP request.
	 * @param {Object} [e.response.data] - Optional data from the response.
	 * @param {string} [e.message] - Optional error message.
	 *
	 * @returns {void}
	 */
	handleErrorCommandResponse(e) {
		let errorMessageResponse = "Error during call Platform Service: ";
		this.commandResponse = {
			accept: false,
			message: errorMessageResponse,
			timeout: -1,
			result: e?.response?.data?.data?.result || Enums.SessionCommandResponseType.ERROR_UNKNOWN_RESPONSE
		};
		let code = "server_error_remote_start_failed";
		let internalLog = {};
		let message = '';
		try {
			if (!e?.response) {
				errorMessageResponse += e.message || '';
				internalLog = JSON.stringify(e);
			} else {
				const data = e?.response?.data || {};
				const msgObj = data?.data?.message;
				if (!data?.status_code && Array.isArray(msgObj) && msgObj[0]?.text) {
					message = msgObj[0]?.text;
					if (message.includes('offline')) {
						code = "server_error_remote_start_failed_offline_charger";
					}
					errorMessageResponse = message;
				} else if (!data?.status_code) {
					errorMessageResponse = JSON.stringify(data);
				} else if (Array.isArray(msgObj) && msgObj[0]?.text) {
					message = msgObj[0]?.text;
				}
				internalLog = JSON.stringify(data);
			}
		} catch (error) {
			console.error("[Catch RemoteStartSession - handleErrorCommandResponse] Error parsing error response:", error);
		}

		this.reject.setField('code', code)
			.setField('internalLog', internalLog || JSON.stringify(e))
			.setField('message', errorMessageResponse || "" + internalLog || "");
	}

	getCreatedWay(){
		const createdWayObject = {
			[Enums.DeviceTypes.APT]: Enums.CreateWaySessionsType.APT_START_SESSION,
			[Enums.DeviceTypes.QR_CODE]: Enums.CreateWaySessionsType.QR_CODE_START_SESSION,
		}

		return createdWayObject[this.isDeviceSession?.deviceType] || Enums.CreateWaySessionsType.REMOTE_START_SESSION;
	}

	async getUserInfoDevices(preAuthorization, userId){
		let userIdToFind = userId;
		const usersData = {
			userIdInfo: preAuthorization?.billingInfo,
			userIdWillPayInfo: preAuthorization?.billingInfo,
			userIdToBillingInfo: preAuthorization?.billingInfo
		}

		if(this.isDeviceSession.deviceType === Enums.DeviceTypes.QR_CODE){
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
	 * Starts a remote charging session (version 2) by validating input, retrieving charger and user information,
	 * calculating tariffs and fees, and creating a session record. Handles various billing, authorization, and
	 * platform-specific logic for EV charging.
	 *
	 * @async
	 * @function
	 * @returns {Promise<Object>} An object containing session creation status, sessionId, hwId, userId, and authorization_reference.
	 * @throws {Error} Throws a formatted error if session creation fails or any step encounters an error.
	 *
	 * @example
	 * const result = await remoteStartSession();
	 * // result: {
	 * 	auth: 'true',
	 * 	code: 'generic_code_message',
	 * 	message: 'Session created successfully',
	 * 	sessionId: "00000000-0000-0000-0000-000000000000",
	 * 	hwId: 'CHARGER-01',
	 * 	userId: "00000000-0000-0000-0000-000000000000",
	 * 	authorization_reference: 'fake-authorization-reference'
	 * }
	 */
	async remoteStartSession() {
		try {
			console.log(`[Service - remoteStartSession ${this.version}] Starting remote session...`);
			const { hwId, evId, plugId, ceme, userId, idTag, billingPeriod } = getAndValidationFields(this.req, this.reject);
			const { deviceIdentifier } = this.req.body;
			this.isDeviceSession = Helpers.verifyIsDeviceRequest(this.req.body.clientType);

			this.hwId = hwId;
			this.transactionId = this.req.body.transactionId;
			this.charger = await this.publicNetworkClient.getChargerByHwId(hwId, this.reject);
			this.isHubjectNetwork = this.charger.network === HubjectNetwork;
			this.adyenReference = this.req.body.adyenReference || '';
			const platformCode = !this.isHubjectNetwork ? this.charger.network : "Gireve";

			let timeZone = this.charger.timeZone
			if (!timeZone) {
				let {
					latitude,
					longitude
				} = Utils.getChargerLatitudeLongitude(this.charger.geometry)
				timeZone = Utils.getTimezone(latitude, longitude)
			}

			const paymentType = ['b2c', Enums.DeviceTypes.APT, Enums.DeviceTypes.QR_CODE].includes(this.req.body.clientType) ? "AD_HOC" : "MONTHLY";
			const auth_method = "WHITELIST";

			const plug = findPlug(this.charger.plugs, plugId, this.reject);
			this.evse_uid = plug.uid;
			const plugPower = plug.power || 22;
			const plugVoltage = plug.voltage || 400;

			await checkExistsSessionPending(this.hwId, this.evse_uid, this.reject);

			const token = await getTokenByUid(idTag, this.reject);
			const token_type = token.type;
			const cdr_token = {
				uid: token.uid,
				type: token_type,
				contract_id: token.contract_id,
			};

			let ev;
			let fleet;
			let invoiceType = ''
			let invoiceCommunication = ''
			if (evId !== '-1') {
				const getEVAllByEvId = await Utils.getEVAllByEvId(evId);
				ev = getEVAllByEvId.ev
				fleet = getEVAllByEvId.fleet
				invoiceType = ev?.invoiceType;
				invoiceCommunication = ev?.invoiceCommunication;
			}
			const platform = await getPlatformByPlatformCode(platformCode, this.reject);
			
			let userPromiseResult = {
				userIdInfo: null,
				userIdWillPayInfo: null,
				userIdToBillingInfo: null
			};

			if(!this.isDeviceSession?.isDevice){
				userPromiseResult = await getAllUsersInfos(
					userId,
					this.req.body.userIdWillPay,
					this.req.body.userIdToBilling,
					this.reject
				)
			}

			
			let tariffOPC = {};
			let tariffCEME = {};
			let tariffADHOC = null;
			let fees = {};
			
			if(this.isDeviceSession?.isDevice){
				const preAuthorization = await getUserInPreAuthorization(this.adyenReference)
				if(preAuthorization && Object.keys(preAuthorization)?.length){
					userPromiseResult = await this.getUserInfoDevices(preAuthorization, userId);
				}
				const plugTariffAdhocId = getPlugTariffAdHocId(plug);
				if(plugTariffAdhocId){
					tariffADHOC = await getAdHocTariff(plugTariffAdhocId, this.charger);
				}
				const deviceTariffs = await this.devicesServiceClient.getTariffs(this.charger.hwId, plugId, this.isDeviceSession.deviceType, this.reject);

				if(deviceTariffs?.success){
					const { cemeTariff, cpoTariff } = formatAptTariffs(deviceTariffs.data, this.charger, this.version === '2.2');
					console.log(`\n Device tariffs: `, { cemeTariff, cpoTariff });
					tariffOPC = cpoTariff;
					tariffCEME = cemeTariff;
				}
				fees = await this.useVatServiceToGetFees(this.charger, null)
			}else{
				const results = await Promise.all([
					getTariffOPCRemoteStart(this.charger, plug, userId, this.req.body.evOwner),
					getTariffCEMERemoteStart(ceme, this.req.body.clientName, this.isHubjectNetwork),
					this.useVatServiceToGetFees(this.charger, this.req.body?.userIdToBilling)
				]);
				tariffOPC = results[0] || {};
				tariffCEME = results[1] || {};
				fees = results[2] || {};
			}

			let {
				userIdInfo,
				userIdWillPayInfo,
				userIdToBillingInfo
			} = userPromiseResult;

			if (!this.isHubjectNetwork) {
				const { endpoint, responseUrl, platformToken } = findPlatformData(this.version, platform, this.authorization_reference, this.reject);
				this.endpoint = endpoint;
				this.responseUrl = responseUrl;
				this.platformToken = platformToken;
			}

			const currency = tariffOPC?.currency ? tariffOPC.currency : "EUR";

			const data = {
				userId,
				evId,
				token_type,
				paymentType,
				invoiceType,
				invoiceCommunication,
				currency,
				tariffOPC,
				tariffCEME,
				tariffADHOC,
				fees,
				timeZone,
				plugPower,
				plugVoltage,
				userIdInfo,
				cdr_token,
				userIdWillPayInfo,
				userIdToBillingInfo,
				auth_method,
				operator: this.charger.partyId,
				source: this.charger.source,
				country_code: this.charger.countryCode,
				party_id: this.charger.partyId,
				chargeOwnerId: this.charger.partyId,
				token_uid: idTag,
				paymentStatus: "UNPAID",
				paymentMethod: this.req.body.paymentMethod,
				chargerType: this.req.body.chargerType,
				paymentMethodId: this.req.body.paymentMethodId,
				walletAmount: this.req.body.walletAmount,
				reservedAmount: this.req.body.reservedAmount,
				clientName: this.req.body.clientName,
				confirmationAmount: this.req.body.confirmationAmount,
				userIdWillPay: this.req.body.userIdWillPay,
				adyenReference: this.adyenReference,
				transactionId: this.transactionId,
				evOwner: this.req.body.evOwner,
				userIdToBilling: this.req.body.userIdToBilling,
				location_id: this.hwId,
				evse_uid: this.evse_uid,
				connector_id: plugId,
				voltageLevel: this.charger.voltageLevel,
				status: Enums.SessionStatusesTextTypes.PENDING,
				message: 'session_preparing',
				command: "START_SESSION",
				autoStop: this.req.body.autoStop,
				last_updated: new Date().toISOString(),
				authorization_reference: this.authorization_reference,
				cdrId: "-1",
				viesVAT: this.req.body.viesVAT,
				address: this.charger.address,
				cpoCountryCode: this.charger.cpoCountryCode,
				billingPeriod: billingPeriod,
				createdWay:  this.getCreatedWay(),
				plafondId: this.req.body.plafondId,
				cardNumber: this.req.body.cardNumber,
				evDetails: ev,
				fleetDetails: fleet,
				updateKMs: false,
				acceptKMs: false,
				deviceIdentifier: deviceIdentifier ? deviceIdentifier : ""
			};

			if (this.version === '2.2') {
				const {
					tariffTAR,
					TAR_Schedule
				} = await Utils.getCEMEandTar(
					tariffCEME?._id || '', 
					timeZone, 
					this.charger.source, 
					this.isDeviceSession?.isDevice ? 'EVIO_ad_hoc' : this.req.body.clientName
				);

				data.tariffTAR = tariffTAR;
				data.schedulesCEME = TAR_Schedule;
			}

			if (this.isHubjectNetwork && plug.co2Emissions) {
				data.roamingCO2 = plug.co2Emissions
			}


			if (ev) {
				if (ev.acceptKMs) data.acceptKMs = ev.acceptKMs
				if (ev.updateKMs) data.updateKMs = ev.updateKMs
			}

			const userCoordinates = getUserCoordinates(this.req.body);
			if (userCoordinates) {
				data.userCoordinates = userCoordinates
			}

			this.session = await createSession(data, this.reject);
			this.currentStatus = this.session.status;

			this.reject.setField('sessionId', this.session._id)

			this.tokenObj = {
				...cdr_token,
				country_code: token.country_code,
				valid: token.valid,
				whitelist: token.whitelist,
				party_id: token.party_id,
				issuer: token.issuer,
				last_updated: token.last_updated,
				energy_contract: {
					supplier_name: token?.energy_contract?.supplier_name,
					contract_id: token?.energy_contract?.contract_id
				}
			}

			this.reject.setField('responseAlreadySended', true)
				.setField('stage', 'Create session object')
				.setField('status', Enums.SessionFlowLogsStatus.SUCCESS)
				.saveLogs();

			this.reject.setField('upsertLogs', true);
			return {
				auth: 'true',
				code: "",
				message: 'Session created successfully, attempting to start command start',
				sessionId: this.session._id,
				hwId: this.hwId,
				userId: userId,
				authorization_reference: this.authorization_reference
			};
		} catch (error) {
			if (error?.message) {
				console.error("[Service - remoteStartSession] Error:", error.message);
				this.reject.setField('code', 'server_error_remote_start_failed')
					.setField('message', error.message || "Error starting remote session")
					.setField('statusCode', 400);
			}
			throw this.reject.throwError();
		}
	}

	/**
	 * Retrieves VAT fees for a given charger using the vatService.
	 *
	 * @async
	 * @param {Object} charger - The charger object for which to fetch VAT fees.
	 * @param {?string} [userIdToBilling=null] - Optional user ID for billing purposes.
	 * @returns {Promise<Object>} The VAT fees data returned by the vatService.
	 * @throws {Error} Throws an error if fetching VAT fees fails. Error details are set in the `reject` object.
	 */
	async useVatServiceToGetFees(charger, userIdToBilling = null) {
		try {
			return await vatService.getFees(charger, userIdToBilling)
		} catch (error) {
			if (error.code) {
				this.reject.setField('code', error.code || 'server_error_vat_fees')
					.setField('internalLog', JSON.stringify(error))
					.setField('errorType', Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR)
					.setField('message', error?.message || "Error fetching VAT fees");
			} else {
				this.reject.setField('code', 'server_error')
					.setField('internalLog', JSON.stringify(error))
					.setField('errorType', Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR)
					.setField('message', "Error fetching VAT fees");
			}
			throw new Error();
		}
	}

	/**
	 * Attempts to send start session commands to a remote device, retrying as necessary until a response is accepted
	 * or the allowed time expires. Handles command delays, updates session and charger info on failure, and throws
	 * an error if the session could not be started successfully.
	 *
	 * @async
	 * @throws {Error} Throws an error if the session start flow fails after all attempts.
	 */
	async attemptToCommands() {
		const commandFunction = this.isHubjectNetwork ? 'sendStartSessionCommandHubject' : 'sendStartSessionCommand';
		while (this.getTimeLeft() > 0) {
			console.log(`\nStarting command attempts for ${commandFunction}...`);
			try {
				if (this.isNecessaryCommandDelayStatus()) {
					await updateSessionCommandResponse({
						_id: this.session._id,
						status: Enums.SessionStatusesTextTypes.PENDING_DELAY,
						message: 'session_keep_waiting',
						displayTextMessage: this.commandResponse.message || "Waiting for command response",
					});
				}
				console.log('Sending START_SESSION command...');

				await this[commandFunction]();

				if (!this.commandResponse?.accept) {
					this.firstCommandAttemptReject++;
					this.reject.pushAttempts({
						retryAttempt: this.attemptCount,
						commandResponseStatus: this.commandResponse?.result || Enums.SessionCommandResponseType.ERROR_UNKNOWN_RESPONSE,
						message: `Command response rejected, command message: ${this.commandResponse?.message || "No command response message"}`
					});
					console.log('Command response not accepted or missing. Retrying...');
					await sleep(RETRY_INTERVAL_MS);
					continue;
				}

				this.reject.pushAttempts({
					retryAttempt: this.attemptCount,
					commandResponseStatus: this.commandResponse?.result,
					message: `Command response accepted, command message: ${this.commandResponse?.message || "No command response message"}`
				});
				// If command response is accepted, update session command response
				if(!this.restartCommunication){
					if(this.isHubjectNetwork){
						await updateSessionByQuery({ _id: this.session._id }, this.hubjectNetworkSessionData);
					}else {
						await updateSessionCommandResponse({
							_id: this.session._id,
							displayTextMessage: this.commandResponse.message,
							responseTimeout: this.commandResponse.timeout,
							status: Enums.SessionStatusesTextTypes.PENDING_START,
							message: 'session_connect_plug',
							commandResponseDate: new Date()
						});
					}
				}

				console.log('\nWaiting for Command Result...');
				await this.checkCommandResult();

				if(this.stopProcess){
					console.log('\nStopping process EVSE not operable.');
					await this.invalidateTransaction();
					return;
				}

				if (this.commandResult?.accept) {
					console.log('Commands accepted, waiting for put session...');
					break;
				}

				console.log('Command result not received or not accepted. Retrying...');
				await sleep(RETRY_INTERVAL_MS);
			} catch (err) {
				console.error('Error in session start flow:', err.message);
				await sleep(RETRY_INTERVAL_MS);
			}
		}

		if (!this?.commandResponse?.accept || (this.commandResult?.result && !this.commandResult?.accept)) {
			await this.invalidateTransaction();
			return;
		}

		// Restart the timer for checking the put session
		console.log('\nSession start flow completed, starting timer for put session...');
		console.log(`Restart timer`);
		this.startTime = Date.now();
		await this.checkPutSession();

	}

	/**
	 * Sends a remote start session command to the Hubject (OICP) platform.
	 *
	 * Attempts to initiate a charging session remotely via the OICP client. Handles both success and failure responses,
	 * updating the session status and preparing a command response accordingly. In case of errors, sets appropriate
	 * rejection fields and command response details.
	 *
	 * @async
	 * @returns {Promise<void>} Resolves when the command has been processed and session updated or rejected.
	 *
	 * @throws {Error} If an unexpected error occurs during the OICP service call.
	 */
	async sendStartSessionCommandHubject(){
		try {
			console.log(`\nSending START_SESSION command to OICP Service...`);
			const result = await this.oicpClient.sendStart(this.session);
			if (!result.status) {
				const message = result.message || "Error starting remote session via OICP";
				this.reject.setField('code', 'server_error_remote_start_failed')
					.setField('internalLog', message)
					.setField('message', message);

				this.commandResponse = {
					accept: result.status,
					message: message,
					result: Enums.SessionCommandResponseType.ERROR_UNKNOWN_RESPONSE,
					timeout: -1
				};
				return;
			}
			this.reject.setField('externalId', result.sessionId)
			this.commandResponse = {
				accept: result.status,
				message: 'Remote Start accepted',
				timeout: 70,
				result: Enums.SessionCommandResponseType.ACCEPTED
			};

			this.hubjectNetworkSessionData = {
				id: result.sessionId,
				roamingTransactionID: result.sessionId,
				roamingOperatorID: this.charger.partyId,
				status: Enums.SessionStatusesTextTypes.PENDING_START,
				message: 'session_connect_plug',
				displayText: { language: "EN", text: 'Remote Start accepted' },
				responseTimeout: 70
			}

			console.log(`Command response accepted: ${JSON.stringify(this.commandResponse)}`);
			return;
		} catch (error) {
			this.reject.setField('stage', '[Catch] Call OICP Service')
			.setField('code', 'server_error_remote_start_failed')
			.setField('internalLog', JSON.stringify(error))
			.setField('message', `Error during call OICP Service: ${error.message || "Unknown error"}`);

			this.commandResponse = {
				accept: false,
				message: `Error during call OICP Service: ${error.message || "Unknown error"}`,
				timeout: -1,
				result: Enums.SessionCommandResponseType.INTERNAL_ERROR
			};
			return;
		}
	}

	tryToGetMessageCommandResponse(response) {
		if (
			response?.data?.message &&
			Array.isArray(response.data.message) &&
			response.data.message.length > 0 &&
			response.data.message[0]?.text
		) {
			return response.data.message[0].text;
		}
		return "Command accepted without message";
	}

	/**
	 * Sends a remote start session command to the platform service.
	 *
	 * This method attempts to initiate a charging session by calling the platform service
	 * with the required parameters. It handles various response scenarios, including:
	 * - No response from the platform service
	 * - Missing or invalid status codes
	 * - Unsuccessful or rejected responses
	 * - Successful session start
	 * - Errors thrown during the request
	 *
	 * The method sets `this.commandResponse` with the result of the operation and updates
	 * the rejection object (`this.reject`) with relevant error information when needed.
	 *
	 * @async
	 * @returns {Promise<void>} Resolves when the command has been processed and the response is set.
	 */
	async sendStartSessionCommand() {
		try {
			console.log(`\nSending START_SESSION command to Platform Service...`);
			this.attemptCount++;
			const response = await this.platformClient.call(
				this.endpoint,
				this.platformToken,
				{
					response_url: this.responseUrl,
					token: this.tokenObj,
					location_id: this.hwId,
					evse_uid: this.evse_uid,
					authorization_reference: this.authorization_reference
				},
				this.reject
			);
			let code = "server_error_remote_start_failed";
			let message = "Error: ";
			this.reject.setField('stage', 'Call Platform Service');
			if (!response) {
				message += "No response from Platform Service";
				this.reject.setField('code', code)
					.setField('internalLog', message)
					.setField('message', message);

				this.commandResponse = {
					accept: false,
					message: message,
					result: Enums.SessionCommandResponseType.ERROR_UNKNOWN_RESPONSE,
					timeout: -1
				};
				return;
			} else if (!response?.status_code) {
				message += "No response status_code from Platform Service";
				this.reject.setField('code', code)
					.setField('internalLog', `${message} ${JSON.stringify(response)}`)
					.setField('message', `${message} ${JSON.stringify(response)}`);

				this.commandResponse = {
					accept: false,
					message: message,
					result: Enums.SessionCommandResponseType.ERROR_UNKNOWN_RESPONSE,
					timeout: -1
				};
				return;
			}

			const isValidStatus = (Math.round(response.status_code / 1000)) == 1;

			if (!isValidStatus || response.data.result !== Enums.SessionCommandResponseType.ACCEPTED) {
				if (response?.data?.message?.length > 0) {
					message += this.tryToGetMessageCommandResponse(response);
					if (message.includes('offline')) {
						code = "server_error_remote_start_failed_offline_charger";
					}
				}
				this.reject.setField('code', code)
					.setField('internalLog', `${message} ${JSON.stringify(response.data)}`)
					.setField('message', `${message} ${JSON.stringify(response.data)}`);

				this.commandResponse = {
					accept: false,
					message: message,
					timeout: -1,
					result: response.data.result || Enums.SessionCommandResponseType.ERROR_UNKNOWN_RESPONSE
				};
			}

			this.commandResponse = {
				accept: response.data.result === Enums.SessionCommandResponseType.ACCEPTED,
				message: this.tryToGetMessageCommandResponse(response) || "Command accepted without message",
				timeout: response.data.timeout,
				result: response.data.result
			};
			console.log(`Command response accepted: ${JSON.stringify(this.commandResponse)}`);
			return;

		} catch (e) {
			console.error(`[Catch][Service V2 - sendStartSessionCommand] Error during call Platform Service: ${e.message || "Unknown error"}`);
			this.reject.setField('stage', '[Catch] Call Platform Service');
			const status_code = e?.response?.data?.status_code || null;
			const response = e?.response || {};
			const result = e?.response?.data?.result || null;
			if (status_code && (Math.round(status_code / 1000)) == 1 && result === Enums.SessionCommandResponseType.ACCEPTED) {
				this.commandResponse = {
					accept: response.data.result === Enums.SessionCommandResponseType.ACCEPTED,
					message: this.tryToGetMessageCommandResponse(response),
					timeout: response.data.timeout,
					result,
				};
				console.log(`[Catch] Command response accepted: ${JSON.stringify(this.commandResponse)}`);
				return;
			} else {
				this.handleErrorCommandResponse(e);
				return;
			}
		}

	}

	/**
	 * Continuously checks the result of a remote start command for a session until a timeout is reached.
	 *
	 * - If a command delay is necessary, updates the session status to `PENDING_DELAY`.
	 * - Periodically fetches the session to verify if the command result is available.
	 * - If the session status becomes `ACTIVE` or `PENDING_START`, sets the command result as accepted and returns.
	 * - If the command result is not accepted, updates the session to restart attempts and sets the command result as failed.
	 * - Retries the check at a fixed interval until the timeout expires.
	 * - Handles and logs errors during the process, retrying on failure.
	 *
	 * @async
	 * @returns {Promise<void>} Resolves when the command result is determined or the timeout is reached.
	 */
	async checkCommandResult() {
		while (this.getTimeLeft() > 0) {
			this.attemptCount++;
			try {
				console.log('\nGet session to verify command result...');

				const session = await findSession({ _id: this.session._id }, { status: 1, commandResultStart: 1, displayText: 1, message: 1, id: 1 });

				// If we receive put session before command result
				if (session.status === Enums.SessionStatusesTextTypes.ACTIVE && session.id) {
					console.log('Session command result accepted, returning command result...');
					this.commandResult = {
						accept: true,
						result: session.commandResultStart || Enums.SessionCommandResultType.ACCEPTED,
						message: session.displayText?.text || "Command result accepted without message"
					};
					return;
				}

				if(session.commandResultStart === Enums.SessionCommandResultType.ACCEPTED && session.status !== Enums.SessionStatusesTextTypes.ACTIVE) {
					console.log('Session command result accepted, returning command result...');
					this.commandResult = {
						accept: true,
						result: Enums.SessionCommandResultType.ACCEPTED,
						message: session.displayText?.text || "Command result accepted without message"
					};
					this.reject.pushAttempts({
						retryAttempt: this.attemptCount,
						commandResponseStatus: this.commandResponse?.result || Enums.SessionCommandResponseType.ERROR_UNKNOWN_RESPONSE,
						commandResultStatus: this.commandResult?.result || Enums.SessionCommandResultType.ACCEPTED,
						message: `Command result accepted, command message: ${this.commandResult?.message}`
					});
					await updateSessionByQuery({ _id: this.session._id }, {
						message: 'session_connect_plug',
						status: Enums.SessionStatusesTextTypes.PENDING_START,
					});
					return;
				}

				// If the session command result is not accepted, we need to retry all attempts flow
				if (session.commandResultStart && session.commandResultStart != Enums.SessionCommandResultType.ACCEPTED
					&& !this.resultToStopProcess.includes(session.commandResultStart)
				) {
					console.log('\nCommand result not accepted, restarting session attempts flow...\n');
					this.commandResult = {
						accept: false,
						result: session.commandResultStart || Enums.SessionCommandResultType.FAILED,
						message: session.displayText?.text || "Command result not accepted without message"
					};
					this.authorization_reference = Utils.generateToken(24);
					this.restartCommunication = true;
					await updateSessionByQuery({ _id: this.session._id }, {
						authorization_reference: this.authorization_reference,
						message: 'session_restarting_attempts',
						errorType: 'RestartCommunication'
					});

					this.reject.pushAttempts({
						retryAttempt: this.attemptCount,
						commandResponseStatus: this.commandResponse?.result || Enums.SessionCommandResponseType.ERROR_UNKNOWN_RESPONSE,
						commandResultStatus: this.commandResult?.result || Enums.SessionCommandResultType.ERROR_UNKNOWN_RESULT,
						message: `Command result not accepted, command message: ${this.commandResult?.message}`
					});
					return;
				}else if(session.commandResultStart && this.resultToStopProcess.includes(session.commandResultStart)) {
					this.stopProcess = true;
					console.log('\nSession is stopped by command result');
					this.commandResult = {
						accept: false,
						result: session.commandResultStart,
						message: session.displayText?.text || "Command result not accepted without message"
					};
					return;
				}

				await sleep(RETRY_INTERVAL_MS);
			} catch (err) {
				console.error('Error in session start flow:', err.message);
				await sleep(RETRY_INTERVAL_MS);
			}
		}
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
				const session = await findSession({ _id: this.session._id }, { status: 1, commandResultStart: 1, displayText: 1 });
				if (session.status === Enums.SessionStatusesTextTypes.ACTIVE) {
					console.log('\nSession is already active');
					this.reject.setField('stage', 'Put session received, session is active')
						.setField('status', Enums.SessionFlowLogsStatus.SUCCESS)
						.saveLogs();
					return;
				}else if(session.status === Enums.SessionStatusesTextTypes.INVALID) {
					console.log('\nSession is invalid by command result');
					this.commandResult = {
						accept: false,
						result: session.commandResultStart || Enums.SessionCommandResultType.FAILED,
						message: session.displayText?.text || "Command result not accepted without message"
					};
					break;
				}
				if(session.commandResultStart && session.commandResultStart !== Enums.SessionCommandResultType.ACCEPTED) {
					console.log('\nSession is invalid by command result');
					this.commandResult = {
						accept: false,
						result: session.commandResultStart || Enums.SessionCommandResultType.FAILED,
						message: session.displayText?.text || "Command result not accepted without message"
					};
					break;
				}
				await sleep(RETRY_INTERVAL_MS);
			} catch (err) {
				console.error('Error in session start flow:', err.message);
				await sleep(RETRY_INTERVAL_MS);
			}
		}

		console.error('\nSession start flow timed out, invalidating session');
		this.reject.setField('code', 'server_error_remote_start_failed')
			.setField('internalLog', 'Session start flow timed out, invalidating session')
			.setField('message', 'Session start flow timed out, put session not received, invalidating session')
			.setField('errorType', Enums.SessionFlowLogsErrorTypes.TIMEOUT_ERROR);

		await this.invalidateTransaction();
	}
};


module.exports = {
	RemoteStartSession
};

