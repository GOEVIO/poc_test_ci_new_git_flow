const OcppJsonCall = require("../OcppJsonCall")
const global = require('../global');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const Utils = require('../utils');
const ConfigurationKey = require('../models/configurationKeys')
const moment = require('moment')
const axios = require("axios");
const EvioKey = require('../models/evioKeys')

const host = global.charger_microservice_host;
const chargerServiceUpdateProxy = `${host}/api/private/chargers`;
const chargerServiceProxy = `${host}/api/private/chargers/status`;

module.exports = {
    handle: function (req, res, wss, eventEmitter) {
        const context = "[Change Configuration]";
        const action = 'ChangeConfiguration';

        const hwId = req.body.hwId;
        if (!hwId)
            return res.status(400).send({ auth: 'true', code: "server_hw_id_required", message: 'Hardware ID required' });
        
        const evioKeysCode = req.body.evioKeysCode;
        if (!evioKeysCode)
            return res.status(400).send({ auth: 'true', code: "server_evioKeysCode_required", message: 'evioKeysCode required' });

        const chargerId = hwId;

        /////////////////////////////////////////////////////////////////////////////
        //Check if charger exists on EVIO Network and get data of charger
        const params = {
            hwId: hwId
        };

        const clients = Array.from(wss.clients);
        const client = clients.filter(a => a.id == hwId)[0];


        if (client) {
            if (client.readyState === WebSocket.OPEN) {
                Utils.chekIfChargerExists(chargerServiceProxy, params).then(async (charger) => {

                    if (charger) {
                        console.log(`${context} Trying changing configuration to evio Keys: ChargerId: ${hwId}; Endpoint: ${charger.endpoint} `);
                        let evioKeys = await EvioKey.findOneEvioKeys({code : evioKeysCode})
                        let evioKeysList = evioKeys ? evioKeys.keys : []
                        Utils.updateManyConfigurationKeys(evioKeysList , charger, client , eventEmitter , action , res)
                    }
                    else {
                        return res.status(500).send({ auth: true, status: false, message: `Charger ${hwId} does not exists` });
                    }
                });

            }

        } else {
            const message = `${context} Communication not established between the CS and the charging station ${chargerId}`;
            console.error(message);
            return res.status(500).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
        }
    }
}
