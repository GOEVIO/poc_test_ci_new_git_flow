const OcppJsonCall = require("../OcppJsonCall")
const global = require('../global');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const Utils = require('../utils');
const trigger = global.triggeredByCS

module.exports = {
    handle: function (req, res, wss, eventEmitter) {
        const context = "[Update Firmware]";
        const action = 'UpdateFirmware';

        const validUrlRegex = /^(ftp|http|https):\/\/[^\s/$.?#].[^\s]*$/;

        const {hwId , location , retries, retryInterval } = req.body;
        let { retrieveDate } = req.body;

        if (!hwId){
            return res.status(400).send({ auth: 'true', code: "server_hwid_required", message: 'HwId required' });
        }

        if (!location || !validUrlRegex.test(location)) {
            return res.status(400).send({
                auth: 'true',
                code: 'server_location_required',
                message: 'A valid Location URI to upload the file is required'
            });
        }

        if (retries !== undefined && (!Number.isInteger(retries) || retries < 0)) {
            return res.status(400).send({ auth: 'true', code: 'invalid_retries', message: 'Retries must be a non-negative integer' });
        }

        if (retrieveDate) {
            if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(retrieveDate)) {
                return res.status(400).send({ auth: 'true', code: 'invalid_retrieveDate', message: 'Invalid format for retrieveDate' });
            }
        } else {
            retrieveDate = new Date().toISOString();
        }

        if (retryInterval !== undefined && (!Number.isInteger(retryInterval) || retryInterval < 0)) {
            return res.status(400).send({ auth: 'true', code: 'invalid_retryInterval', message: 'retryInterval must be a non-negative integer' });
        }

        try {
            const clients = Array.from(wss.clients);
            const client = clients.filter(a => a.id == hwId)[0];

            if (client) {
                if (client.readyState === WebSocket.OPEN) {

                    const messageId = uuidv4();
                    let data = new Object;
                    data = {...data , location , retries , retrieveDate , retryInterval}
                    const call = [global.callRequest, messageId , action, data];
                    console.log(JSON.stringify(call))

                    console.log(`Message sent to ${client.id}, ${action}`)
                    client.send(JSON.stringify(call), function (result, err) {

                        eventEmitter.on(messageId, function (data) {
                            Utils.saveLog(hwId, call[3] , data , true , 'UpdateFirmware' , `UpdateFirmware command` , 0 , trigger)
                            return res.status(200).send(data);
                        });
                    });

                }
            }
            else {
                const message = `${context} Communication not established between the CS and the charging station ${hwId}`;
                console.error(message);
                Utils.saveLog(hwId, req.body , {} , false , 'UpdateFirmware' , `Communication not established between the CS and the charging station ${hwId}` , 0 , trigger)
                return res.status(500).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
            }

        } catch (error) {
            const message = `${context} Communication not established between the CS and the charging station ${hwId}`;
            console.error(message);
            Utils.saveLog(hwId, req.body , {} , false , 'UpdateFirmware' , `Communication not established between the CS and the charging station ${hwId}` , 0 , trigger)
            return res.status(500).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
        }
    }
}
