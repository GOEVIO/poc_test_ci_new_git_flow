const Promise = require('promise');
const moment = require('moment');
const global = require('../global');
const Utils = require('../utils');
const diagnosticStatusStore = require('../store/diagnosticStatusStore');
const trigger = global.triggeredByCP

module.exports = {
    handle: function (data, payload) {
        return new Promise(async function (resolve, reject) {
            const context = "[DiagnosticsStatusNotification] ";

            const DiagnosticsStatusNotificationResponse = [global.callResult, data.messageId, {}];
            const status = payload.status;

            try {
                console.log(`${context}` , status)
                await diagnosticStatusStore.setStatus(data.chargeBoxIdentity, status);

                Utils.saveLog(data.chargeBoxIdentity , payload , DiagnosticsStatusNotificationResponse[2] , diagnosticStatusSuccess(status) , 'DiagnosticsStatusNotification' , 'Diagnostic Status' , 0 , trigger)
                resolve(DiagnosticsStatusNotificationResponse)
            } catch (error) {
                console.error(`${context} error ` + error.message);
                Utils.saveLog(data.chargeBoxIdentity , payload , DiagnosticsStatusNotificationResponse[2] , diagnosticStatusSuccess(status) , 'DiagnosticsStatusNotification' , `${error.message}` , 0 , trigger)
                resolve(DiagnosticsStatusNotificationResponse)
            }
        });
    }
}

function diagnosticStatusSuccess(status) {
    const context = "Function diagnosticStatusSuccess"
    try {
        if (status === process.env.diagnosticStatusIdle) {
            return false
        } else if (status === process.env.diagnosticStatusUploaded) {
            return true
        } else if (status === process.env.diagnosticStatusUploadFailed) {
            return false
        } else if (status === process.env.diagnosticStatusUploading) {
            return true
        } else {
            return false
        }
    } catch (error) {
        console.error(`Error [${context}]` , error.message)
        return false
    }
}
