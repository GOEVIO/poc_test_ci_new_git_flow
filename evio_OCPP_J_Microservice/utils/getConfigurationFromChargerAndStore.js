const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const WebSocket = require('ws');
const ConfigurationKey = require('../models/configurationKeys');
const Utils = require('../utils');
const global = require('../global');
const trigger = global.triggeredByCS;

async function getConfigurationFromChargerAndStore(hwId, client, eventEmitter) {
    const context = '[GetConfigurationFromChargerAndStore]';
    const messageId = uuidv4();
    const action = 'GetConfiguration';

    return new Promise((resolve) => {
        if (!client || client.readyState !== WebSocket.OPEN) {
            console.error(`${context} WebSocket not open for hwId ${hwId}`);
            return resolve(false);
        }

        const call = [global.callRequest, messageId, action, {}];
        client.send(JSON.stringify(call), (err) => {
            if (err) {
                console.error(`${context} Error sending call to charger`, err);
                return resolve(false);
            }

            eventEmitter.once(messageId, async (data) => {
                try {
                    const lastUpdated = moment().utc();
                    const values = {
                        keys: data.configurationKey,
                        lastUpdated,
                        lastReadDate: lastUpdated.format()
                    };

                    await ConfigurationKey.upsertChargerConfigurationKeys({ hwId }, values);
                    Utils.saveLog(hwId, {}, data, true, action, 'Auto fetch after boot', 0, trigger);
                    console.log(`${context} Successfully stored configuration keys for ${hwId}`);
                    resolve(true);
                } catch (error) {
                    console.error(`${context} Error storing configuration keys for ${hwId}`, error);
                    resolve(false);
                }
            });
        });
    });
}

module.exports = getConfigurationFromChargerAndStore;
