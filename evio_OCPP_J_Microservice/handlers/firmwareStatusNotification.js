const Promise = require('promise');
const moment = require('moment');
const global = require('../global');
const Utils = require('../utils');
const trigger = global.triggeredByCP
const firmwareStatusStore = require('../store/firmwareStatusStore');

module.exports = {
    handle: function (data , payload) {
        return new Promise(function (resolve, reject) {
            const context = "[FirmwareStatusNotification] ";

            const FirmwareStatusNotificationResponse = [global.callResult, data.messageId, {}];
            const status = payload.status;

            try {
                console.log(`${context}` , status)
                Utils.saveLog(data.chargeBoxIdentity , payload , FirmwareStatusNotificationResponse[2] , firmwareStatusSuccess(status) , 'FirmwareStatusNotification' , 'Firmware Status' , 0 , trigger)
                firmwareStatusStore.setStatus(data.chargeBoxIdentity, status);
                resolve(FirmwareStatusNotificationResponse)
            } catch (error) {
                console.error(`${context} error ` + error.message);
                Utils.saveLog(data.chargeBoxIdentity , payload , FirmwareStatusNotificationResponse[2] , firmwareStatusSuccess(status) , 'FirmwareStatusNotification' , `${error.message}` , 0 , trigger)
                firmwareStatusStore.setStatus(data.chargeBoxIdentity, status);
                resolve(FirmwareStatusNotificationResponse)
            }
        });
    }
}

function firmwareStatusSuccess(status) {
    const context = "Function firmwareStatusSuccess"
    try {
        if (status === process.env.firmwareStatusDownloaded) {
            return false
        } else if (status === process.env.firmwareStatusDownloadFailed) {
            return true
        } else if (status === process.env.firmwareStatusDownloading) {
            return false
        } else if (status === process.env.firmwareStatusIdle) {
            return true
        } else if (status === process.env.firmwareStatusInstallationFailed) {
            return true
        } else if (status === process.env.firmwareStatusInstalling) {
            return true
        } else if (status === process.env.firmwareStatusInstalled) {
            return true
        } else {
            return false
        }
    } catch (error) {
        console.error(`Error [${context}]` , error.message)
        return false
    }
}
