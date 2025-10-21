const global = require('../global');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const LocalAuthorizationList = require('../models/localAuthorizationLists');

const moment = require('moment')

module.exports = {
    handle: async function (req, res, wss, eventEmitter) {
        const context = "[Get Whitelist]";

        try {
            let whitelist = await LocalAuthorizationList.findOne({hwId : req.body.hwId} , {__v : 0 }).lean()
            if (whitelist) {
                return res.status(200).send(whitelist);
            } else {
                return res.status(200).send(buildNullWhitelist(req.body.hwId));
            }
        } catch (error) {
            console.error(`[${context}] Error ${error.message}` )
            return res.status(500).send(error.message);      
        }
    }
}

function buildNullWhitelist(hwId) {
    const context = "Function buildNullWhitelist";
    try {
        return {
            "hwId": hwId,
            "lastUpdated": new Date().toISOString(),
            "listVersion": 0,
            "localAuthorizationList": []
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return {}
    }
}