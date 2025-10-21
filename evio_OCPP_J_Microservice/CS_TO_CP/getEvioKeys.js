const global = require('../global');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const EvioKey = require('../models/evioKeys')
const moment = require('moment')

module.exports = {
    handle: async function (req, res, wss, eventEmitter) {
        
        const context = "[Get EVIO Keys ]";
        let evioKeys = await EvioKey.find({} , {__v : 0 , keys : 0}).lean()
        return res.status(200).send(evioKeys);
    }
}
