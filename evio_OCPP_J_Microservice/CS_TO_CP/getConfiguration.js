const OcppJsonCall = require("../OcppJsonCall")
const global = require('../global');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const ConfigurationKey = require('../models/configurationKeys')
const moment = require('moment')
const Utils = require('../utils');
const trigger = global.triggeredByCS

module.exports = {
    handle: function (req, res, wss, eventEmitter) {
        const context = "[Get Configuration]";
        const action = 'GetConfiguration';

        const chargerId = req.body.hwId;

        const clients = Array.from(wss.clients);
        const client = clients.filter(a => a.id == chargerId)[0];

        if (client) {
            if (client.readyState === WebSocket.OPEN) {

                const messageId = uuidv4();

                //const call = new OcppJsonCall(messageId, global.callRequest, action, {});
                const call = [global.callRequest, messageId , action, {}];
                console.log(JSON.stringify(call))

                console.log(`Message sent to ${client.id}, ${action}`)
                client.send(JSON.stringify(call), function (result, err) {

                    //console.log("[GetConfiguration] result", result);
                    //console.log("[GetConfiguration] err: ", err);
                    eventEmitter.on(messageId, function (data) {
                        upsertConfigurationKeys(chargerId,data)
                        Utils.saveLog(chargerId, {} , data , true , 'GetConfiguration' , 'GetConfiguration command' , 0 , trigger)
                        return res.status(200).send(data);
                    });
                });

            }
        }
        else {
            const message = `${context} Communication not established between the CS and the charging station ${chargerId}`;
            console.error(message);
            Utils.saveLog(chargerId, req.body , {} , false , 'GetConfiguration' , `Communication not established between the CS and the charging station ${chargerId}` , 0 , trigger)
            return res.status(500).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
        }
    }
}

const upsertConfigurationKeys = async (chargerId,data) => {
    const lastUpdated = moment(new Date().toISOString()).utc()
    const filter = {
        hwId : chargerId
    }
    const values = {
        keys : data.configurationKey,
        lastUpdated,
        lastReadDate : lastUpdated.format()
    }
    ConfigurationKey.upsertChargerConfigurationKeys(filter, values)
    .then((res) => {
        console.log(`[Get Configuration] Updated the configuration keys of the charging station ${chargerId}`)
    })
    .catch((err) => {
        console.error(`[Get Configuration] Error updating the configuration keys of the charging station ${chargerId}`)
    })
}