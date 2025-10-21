const BootNotification = require('./bootNotification');
const Heartbeat = require('./heartbeat');
const StatusNotification = require('./statusNotification');
const Authorize = require('./authorize');
const DataTransfer = require('./dataTransfer');
const DiagnosticsStatusNotification = require('./diagnosticsStatusNotification');
const FirmwareStatusNotification= require('./firmwareStatusNotification');
const MeterValues = require('./meterValues');
const StartTransaction= require('./startTransaction');
const StopTransaction= require('./stopTransaction');

module.exports = {
    BootNotification: BootNotification,
    Heartbeat: Heartbeat,
    StatusNotification: StatusNotification,
    Authorize: Authorize,
    DataTransfer: DataTransfer,
    DiagnosticsStatusNotification: DiagnosticsStatusNotification,
    FirmwareStatusNotification: FirmwareStatusNotification,
    MeterValues: MeterValues,
    StartTransaction:StartTransaction,
    StopTransaction:StopTransaction
}