const mongoose = require('mongoose');
const { Enums, Constants } = require('evio-library-commons').default;

const sessionFlowLogSchema = new mongoose.Schema({
	userId: {
		type: String,
		index: true,
	},
	hwId: {
		type: String,
		index: true,
	},
	plugId: {
		type: String,
	},
	service: {
		type: String,
	},
	stage: {
		type: String,
	},
	action: {
		type: String,
	},
	status: {
		type: String,
		enum: Object.values(Enums.SessionFlowLogsStatus),
	},
	errorType: {
		type: String,
		enum: Object.values(Enums.SessionFlowLogsErrorTypes)
	},
	errorMessage: {
		type: String,
	},
	payload: {
		type: JSON,
	},
	sessionId: {
		type: String,
	},
	externalSessionId: {
		type: String,
	},
	retries: {
		type: [{
			retryAttempt: {
				type: Number,
				default: 0
			},
			timestamp: {
				type: Date,
				default: Date.now
			},
			commandResponseStatus: {
				type: String,
				default: null
			},
			commandResultStatus: {
				type: String,
				default: null
			},
			message: {
				type: String,
				default: null
			}
		}],
		default: []
	}
},
	{
		timestamps: true
	}
);

const SessionFlowLog = mongoose.model(
	Constants.CollectionNames.OCPI.SessionFlowLogs,
	sessionFlowLogSchema
);
module.exports = SessionFlowLog;