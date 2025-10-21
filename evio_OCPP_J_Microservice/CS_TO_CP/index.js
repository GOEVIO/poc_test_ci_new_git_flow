const remoteStartTransaction = require('./remoteStartTransaction');
const changeConfiguration = require('./changeConfiguration');
const remoteStopTransaction = require('./remoteStopTransaction');
const reset = require('./reset');
const unlockConnector = require('./unlockConnector');
const getConfiguration = require('./getConfiguration');
const getConfigurationKeysDiff = require('./getConfigurationKeysDiff');
const updateToEvioKeys = require('./updateToEvioKeys');
const getEvioKeys = require('./getEvioKeys');
const changeAvailability = require('./changeAvailability');
const sendLocalList = require('./sendLocalList');
const getLocalListVersion = require('./getLocalListVersion');
const clearChargingProfile = require('./clearChargingProfile');
const setChargingProfile = require('./setChargingProfile');
const getCompositeSchedule = require('./getCompositeSchedule');
const cancelReservation = require('./cancelReservation');
const reserveNow = require('./reserveNow');
const triggerMessage = require('./triggerMessage');
const getDiagnostics = require('./getDiagnostics');
const updateFirmware = require('./updateFirmware');
const clearCache = require('./clearCache');
const getWhitelist = require('./getWhitelist');
const getLogs = require('./getLogs');
const unlockConnectorOCPI = require('./unlockConnectorOCPI');
const remoteStartTransactionOCPI = require('./remoteStartTransactionOCPI');
const remoteStopTransactionOCPI = require('./remoteStopTransactionOCPI');
const changeConfigurationv2 = require('./changeConfigurationV2');

module.exports = {
   getConfiguration: getConfiguration,
   getConfigurationKeysDiff: getConfigurationKeysDiff,
   updateToEvioKeys: updateToEvioKeys,
   getEvioKeys: getEvioKeys,
   remoteStartTransaction: remoteStartTransaction,
   remoteStopTransaction: remoteStopTransaction,
   changeConfiguration: changeConfiguration,
   reset: reset,
   changeAvailability: changeAvailability,
   unlockConnector: unlockConnector,
   sendLocalList : sendLocalList,
   getLocalListVersion : getLocalListVersion,
   clearChargingProfile : clearChargingProfile,
   setChargingProfile : setChargingProfile,
   getCompositeSchedule : getCompositeSchedule,
   cancelReservation : cancelReservation,
   reserveNow : reserveNow,
   triggerMessage : triggerMessage,
   getDiagnostics : getDiagnostics,
   updateFirmware : updateFirmware,
   clearCache : clearCache,
   getWhitelist : getWhitelist,
   getLogs : getLogs,
   unlockConnectorOCPI: unlockConnectorOCPI,
   remoteStartTransactionOCPI: remoteStartTransactionOCPI,
   remoteStopTransactionOCPI: remoteStopTransactionOCPI,
   changeConfigurationv2: changeConfigurationv2,
}
