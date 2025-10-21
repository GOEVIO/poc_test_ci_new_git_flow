const Promise = require('promise');
const moment = require('moment');
const global = require('../global');
const Utils = require('../utils');
// var Notification = require('../notifications');
const trigger = global.triggeredByCP
const handleBootConfiguration = require('../utils/handleBootConfiguration');
const getConfigurationFromChargerAndStore = require('../utils/getConfigurationFromChargerAndStore');
const toggle = require('evio-toggle').default;

const host = global.charger_microservice_host;
const chargerServiceProxy = `${host}/api/private/chargers/status`;
const chargerServiceUpdateProxy = `${host}/api/private/chargers`;
const chargerHeartBeatServiceProxy = `${host}/api/private/chargers/heartBeat`;
const { markChargerAsInactive } = require('../utils/autoHandleOcppKeys');

module.exports = {
    handle: async function (data, payload, wss, eventEmitter) {
        return new Promise(function (resolve, reject) {
            try {
                console.log(`[BootNotification][${data.chargeBoxIdentity}] Received (messageId=${data.messageId})`);

                const message = data.chargeBoxIdentity + ' connection available';

                const params = {
                    hwId: data.chargeBoxIdentity
                };

                console.log(`[BootNotification][${data.chargeBoxIdentity}] Checking charger existence...`);
                Utils.chekIfChargerExists(chargerServiceProxy, params).then((charger) => {
                    let heartBeatInterval = global.defaultHeartBeatInterval;
                    if (charger) {
                        const chargerId = charger._id;
                        console.log(`[BootNotification][${charger.hwId}] Found charger. opStatus=${charger.operationalStatus}`);

                        const body = {
                            _id: chargerId,
                            endpoint: data.endpoint,
                            model: payload.chargePointModel,
                            chargePointSerialNumber: payload.chargePointSerialNumber,
                            vendor: payload.chargePointVendor,
                            firmwareVersion: payload.firmwareVersion,
                            iccid: payload.iccid,
                            imsi: payload.imsi,
                            meterSerialNumber: payload.meterSerialNumber,
                            meterType: payload.meterType,
                            chargerType: global.OCPPJ_16_DeviceType,
                            stationIdentifier:data.chargeBoxIdentity,
                            manufacturer:payload.chargePointVendor,
                            active: true
                        }

                        if (typeof charger.heartBeatInterval !== 'undefined') {
                            heartBeatInterval = charger.heartBeatInterval;
                        }

                        console.log(`[BootNotification][${charger.hwId}] Sending intelligent heartbeat...`);
                        Utils.inteligentHeartBeat(chargerHeartBeatServiceProxy, charger.hwId , true);

                        /////////////////////////////////////////////////////////////////////////////
                        //If charger exists, update relevant info such as: endpoint, vendor, model...
                        console.log(`[BootNotification][${charger.hwId}] Updating charger data...`);
                        Utils.updateChargerData(chargerServiceUpdateProxy, body).then(async (result) => {

                            console.log(`[BootNotification][${charger.hwId}] updateChargerData result=${!!result}`);
                            if (!result) {
                                const bootNotificationResponse = [global.callResult, data.messageId, {
                                    status: global.bootNotificationStatusRejected,
                                    currentTime: new Date().toISOString(),
                                    interval: heartBeatInterval
                                }];
                                Utils.saveLog(data.chargeBoxIdentity, payload, bootNotificationResponse[2], false, 'BootNotification', 'Failed to update charger data', 0, trigger)

                                resolve(bootNotificationResponse);
                            } else {
                                const bootNotificationResponse = [global.callResult, data.messageId, {
                                    status: global.bootNotificationStatusAccepted,
                                    currentTime: new Date().toISOString(),
                                    interval: heartBeatInterval
                                }];
                                console.log(`[BootNotification][${charger.hwId}] BootNotification ACCEPTED`);

                                Utils.sendPatchLocationOnConnection(charger);
                                Utils.saveLog(data.chargeBoxIdentity, payload, bootNotificationResponse[2], true, 'BootNotification', message, 0, trigger);

                                const isFeatureEnabled = await toggle.isEnable('charge-506-automated-ocpp-keys');
                                console.log(`[BootNotification][${charger.hwId}] charger.operationalStatus=${charger.operationalStatus}`);
                                console.log(`[BootNotification][${charger.hwId}] Feature flag "charge-506-automated-ocpp-keys" = ${isFeatureEnabled}`);

                                if (isFeatureEnabled && charger.operationalStatus !== "APPROVED"){
                                    console.log(`[BootNotification][${charger.hwId}] Entering config-flow setImmediate...`);
                                    setImmediate(async () => {
                                        const clients = Array.from(wss.clients);
                                        console.log(`[BootNotification][${charger.hwId}] Looking for WS client in wss.clients (total=${clients.length})`);
                                        const client = clients.find(a => a.id === charger.hwId);
                                        console.log(`[BootNotification][${charger.hwId}] WS client ${client ? 'FOUND' : 'NOT FOUND'}`);

                                        if (!client) return;

                                        console.log(`[BootNotification][${charger.hwId}] getConfigurationFromChargerAndStore -> start`);
                                        const configSuccess = await getConfigurationFromChargerAndStore(charger.hwId, client, eventEmitter);
                                        console.log(`[BootNotification] getConfigurationFromChargerAndStore returned: ${configSuccess}`);

                                        if (!configSuccess) {
                                            console.error(`[BootNotification] Config fetch failed for ${charger.hwId}`);
                                            await markChargerAsInactive(charger._id);
                                            return;
                                        }

                                        console.log(`[BootNotification][${charger.hwId}] handleBootConfiguration -> start`);
                                        const configResult = await handleBootConfiguration(payload, charger, client, eventEmitter);
                                        if (!configResult?.accepted) {
                                            console.error(`[BootNotification] Config validation failed for ${charger.hwId}: ${configResult.reason}`);
                                            await markChargerAsInactive(charger._id);
                                        }
                                    });
                                }

                                resolve(bootNotificationResponse);
                            }
                        });
                    }
                    else {
                        console.error(`[BootNotification] Error:  Charger ${data.chargeBoxIdentity} does not exists.`);
                        const bootNotificationResponse = [global.callResult, data.messageId, {
                            status: global.bootNotificationStatusRejected,
                            currentTime: new Date().toISOString(),
                            interval: heartBeatInterval
                        }];

                        Utils.saveLog(data.chargeBoxIdentity , payload , bootNotificationResponse[2] , false , 'BootNotification' , `Charger ${data.chargeBoxIdentity} does not exist` , 0 , trigger)

                        resolve(bootNotificationResponse);
                    }
                });
            } catch (error) {
                console.error(`[BootNotification] Error: ${error.message}`);
                const bootNotificationResponse = [global.callResult, data.messageId, {
                    status: global.bootNotificationStatusRejected,
                    currentTime: new Date().toISOString(),
                    interval: heartBeatInterval
                }];

                Utils.saveLog(data.chargeBoxIdentity, payload, bootNotificationResponse[2], false, 'BootNotification', `Error occurred: ${error.message}`, 0, trigger);

                resolve(bootNotificationResponse);
            }
        });

    }
}
