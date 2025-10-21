const express = require('express');
const router = express.Router();
require("dotenv-safe").load();

//Controllers
const switchBoardController = require('../controllers/switchBoardController');

//DB
const SwitchBoards = require('../models/switchBoards');
const TranslationKeys = require('../models/translationKeys');
const ObjectID = require("mongodb").ObjectId
// utils
const translationUtils = require('../utils/translations');

router.get('/api/private/switchboards/mySwitchboards', async (req, res, next) => {
    const context = "GET /api/private/mySwitchboards";
    try {
        const userId = req.headers['userid'];
        const switchBoardId = req.headers['switchboardid']
        if (!userId || switchBoardId && !ObjectID.isValid(switchBoardId)) {
            console.error(`${context} Error - Missing input`);
            return res.status(400).send({ auth: false, code: 'server_user_id_required', message: 'User id is required' });
        }
        let query = {}
        if (switchBoardId) {
            query = {
                createUserId: userId,
                _id: switchBoardId
            }
        } else {
            query = { createUserId: userId };
        }
        let [listSwitchBoards, chargingModes] = await Promise.all([getListSwitchBoards(query), translationUtils.getTranslationKeys(process.env.TranslationChargingMode)])
        if (!chargingModes) return res.status(500).send({ auth: false, code: 'missing_translations', message: "Missing translations keys" });

        if (!listSwitchBoards || listSwitchBoards.length < 1) return res.status(200).send({ chargingModes, 'switchBoardList': [] });

        const switchBoardList = await switchBoardController.formatSwitchboardForMySwitchboards(listSwitchBoards)
        return res.status(200).send({ chargingModes, switchBoardList });
    } catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send({ auth: false, code: 'server_error', message: error.message });
    }
})

// External API call to get all switchboards
router.get('/evioapi/switchboard', switchBoardController.getSwitchboardsExternalAPI)

router.patch('/evioapi/switchboard/:switchBoardId', switchBoardController.patchSwitchboardExternalAPI)
//TODO: This endpoint will need to be deperecated to a new one that allow to change more than the charging mode
router.patch('/api/private/switchboards/updateChargingMode', async (req, res, next) => {
    const context = "PATCH /api/private/switchboards/updateChargingMode";
    try {
        const userId = req.headers['userid'];
        const switchBoardId = req.body.switchBoardId;
        const chargingMode = req.body.chargingMode;

        if (!userId) {
            console.error(`${context} Error - User id is required ${userId}`);
            return res.status(400).send({ auth: false, code: 'server_user_id_required', message: 'User id is required' });
        }

        if (!ObjectID.isValid(switchBoardId)) {
            console.error(`${context} Error - SwitchBoard id is required ${switchBoardId} ${ObjectID.isValid(switchBoardId)}`);
            return res.status(400).send({ auth: false, code: 'server_switchboard_id_required', message: 'SwitchBoard id is required' });
        }

        const [checkSwitchBoard, chargingModes] = await Promise.all([SwitchBoards.findOne({ _id: switchBoardId, createUserId: userId }), translationUtils.getTranslationKeys(process.env.TranslationChargingMode)]);
        if (!checkSwitchBoard) return res.status(400).send({ auth: false, code: 'unknown_switchboard_id', message: 'unknown SwitchBoard' });

        if (!chargingMode || !checkSwitchBoard.allowChargingModes?.includes(chargingMode)) {
            console.error(`${context} Error - Invalid charging mode`);
            return res.status(400).send({
                auth: false,
                code: 'server_charging_mode_required',
                message: 'Charging Mode is missing or invalid'
            });
        }

        if (!chargingModes) return res.status(500).send({ auth: false, code: 'missing_translations', message: "Missing translations keys" });
        if (checkSwitchBoard.chargingMode === chargingMode) {
            const returnObject = await switchBoardController.formatSwitchboardForMySwitchboards([checkSwitchBoard])
            return res.status(200).send({ auth: true, switchBoard: returnObject })
        }

        const switchBoard = await updateChargingMode(switchBoardId, chargingMode, userId);
        if (!switchBoard) return res.status(400).send({ auth: false, code: 'update_invalid_ChargingMode', message: 'Invalid charging mode' });

        //update comms
        if (!(await switchBoardController.updateControllerChargingMode(chargingMode, switchBoard.locationId, switchBoard.deviceId))) {
            console.error(`${context} Error - Fail to update charging mode on Comms`);
            return res.status(500).send({ auth: false, code: 'server_error', message: 'Internal server error' });
        }
        const switchBoardOutput = await switchBoardController.formatSwitchboardForMySwitchboards([switchBoard])
        return res.status(200).send({ auth: true, switchBoard: switchBoardOutput });
    } catch (error) {
        console.error(`[${context}] Error `);
        return res.status(500).send({ code: 'server_error', message: 'Internal server error' });
    }
});


async function updateChargingMode(switchBoardId, chargingMode, createUserId) {
    const context = "[route Switchboards updateChargingMode]";
    try {
        if (!ObjectID.isValid(switchBoardId) || !chargingMode || !ObjectID.isValid(createUserId)) {
            console.error(`${context} Error - Missing input `, switchBoardId, chargingMode, createUserId);
            throw new Error('Missing input')
        }
        return await SwitchBoards.findOneAndUpdate(
            { '_id': switchBoardId, createUserId },
            { chargingMode: chargingMode },
            { new: true }
        );
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        throw error;
    }
}


async function getListSwitchBoards(query) {
    const context = "[route Switchboards getListSwitchBoards]";
    try {
        if (!query) {
            console.error(`[${context}] Error - Missing input query`, query);
            throw new Error(`Missing input query`)
        }
        return await SwitchBoards.find(query)
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        throw error
    }
}
module.exports = router;