const OcppJsonCall = require("../OcppJsonCall")
const global = require('../global');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const Utils = require('../utils');
const trigger = global.triggeredByCS

module.exports = {
    handle: function (req, res, wss, eventEmitter) {

        const context = "[Get Diagnostics]";
        const action = 'GetDiagnostics';
        
        const {hwId , retries , retryInterval , startTime , stopTime } = req.body;
        if (!hwId){
            return res.status(400).send({ auth: 'true', code: "server_hwid_required", message: 'HwId required' });
        }
        // if (!location){
        //     return res.status(400).send({ auth: 'true', code: "server_location_required", message: 'Location URI to upload file required' });
        // }

        const location = uploadPath()

        try {
            const clients = Array.from(wss.clients);
            const client = clients.filter(a => a.id == hwId)[0];

            if (client) {
                if (client.readyState === WebSocket.OPEN) {

                    const messageId = uuidv4();
                    let data = new Object;
                    data = {...data , location , retries , retryInterval , startTime , stopTime}
                    const call = [global.callRequest, messageId , action, data];
                    console.log(JSON.stringify(call))

                    console.log(`Message sent to ${client.id}, ${action}`)
                    client.send(JSON.stringify(call), function (result, err) {

                        eventEmitter.on(messageId, function (data) {
                            Utils.saveLog(hwId, call[3] , data , true , 'GetDiagnostics' , 'GetDiagnostics command' , 0 , trigger)
                            if (data.fileName) {
                                return res.status(200).send(location + data.fileName);
                            } else {
                                return res.status(200).send(location);
                            }
                        });
                    });

                }
            }
            else {
                const message = `${context} Communication not established between the CS and the charging station ${hwId}`;
                console.error(message);
                Utils.saveLog(hwId, req.body , {} , false , 'GetDiagnostics' , `Communication not established between the CS and the charging station ${hwId}` , 0 , trigger)
                return res.status(500).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
            }

        } catch (error) {
            const message = `${context} Communication not established between the CS and the charging station ${hwId}`;
            console.error(message);
            Utils.saveLog(hwId, req.body , {} , false , 'GetDiagnostics' , `Communication not established between the CS and the charging station ${hwId}` , 0 , trigger)
            return res.status(500).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
        }
        
    }
}

function uploadPath() {
    try {
        let path = ``;
        if (process.env.NODE_ENV === 'production') {
            path = `${process.env.HostProd}/controlcenter/diagnostics/`; // For PROD server
        }
        else if (process.env.NODE_ENV === 'pre-production') {
            path = `${process.env.HostPreProd}/controlcenter/diagnostics/`; // For Pre PROD server
        }
        else {
            // path = `${process.env.HostLocal}/controlcenter/diagnostics//`; // For local host
            path = `${process.env.HostQA}/controlcenter/diagnostics/`;// For QA server
        };
        return path
    } catch (error) {
        return null
    }
}