const { Enums: {
    SessionStatusesNumberTypes,
    SessionFlowLogsErrorTypes,
    SessionCommandResponseType,
    ChargerCommandResultType,
    SessionFlowLogsStatus,
    OcppWebSocketTypes,
    DeviceTypes,
    CreateWaySessionsType
} } = require('evio-library-commons').default;

const constants = {
    TOTAL_TIMEOUT_MS: process.env.TOTAL_TIMEOUT_MS || 60_000,
    RETRY_INTERVAL_MS: process.env.RETRY_INTERVAL_MS || 5_000,
    MAX_RETRIES_BEFORE_PENDING_DELAY: process.env.MAX_RETRIES_BEFORE_PENDING_DELAY || 3,
    MIN_MS_BEFORE_PENDING_DELAY: process.env.MIN_MS_BEFORE_PENDING_DELAY || 20_000,
    MAX_MS_BEFORE_PENDING_DELAY: process.env.MAX_MS_BEFORE_PENDING_DELAY || 30_000,
    MAX_MS_WAIT_PUT_SESSION: process.env.MAX_MS_WAIT_PUT_SESSION || 63_000,
    ChargerAccessFreeCharge: process.env.ChargerAccessFreeCharge,
    PaymentMethodNotPay: process.env.PaymentMethodNotPay,
    StartCommand: process.env.StartCommand,
    OCPPJ_16_DeviceType: '008',
    HostChargers: process.env.HostChargers || 'http://chargers:3002',
    createdWayControlCenter: process.env.createdWayControlCenter || 'CONTROLCENTER',
    SessionStatusesNumberTypes,
    SessionFlowLogsErrorTypes,
    SessionCommandResponseType,
    ChargerCommandResultType,
    SessionFlowLogsStatus,
    OcppWebSocketTypes,
    DeviceTypes,
    CreateWaySessionsType
};

module.exports = constants;
