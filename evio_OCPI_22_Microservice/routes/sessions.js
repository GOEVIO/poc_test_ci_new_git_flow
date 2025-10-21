require("dotenv-safe").load();
const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');
const sessionFlowLogsController = require('../controllers/session-flow-logs.controller');
const {getSessionByStatus} = require('../controllers/v2/getSessionByStatus.controller');
const Session = require('../models/sessions')

router.get('/api/private/ocpi/sessions', (req, res) => {
    const context = "GET /api/private/ocpi/sessions";
    try {
        let sessionID = req.query.sessionID

        if (!sessionID) {
            console.log(` ${context} Error - Missing input variable`)
        }
        let query = {
            id: sessionID
        }
        Session.findOne(query, (err, session) => {
            if (err) {
                console.log(`${context} findOne Error- `, err)
                return res.status(500).send(err.message)
            }
            return res.status(200).send(session)

        })
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/ocpi/sessions/byUserId', sessionController.getSessionByUserId);
router.get('/api/private/ocpi/sessions/byTransactionId', sessionController.getSessionByTransactionId);
router.get('/api/private/ocpi/sessions/byId', sessionController.getSessionById);

router.patch('/api/private/ocpi/sessions', (req, res) => {
    let context = "PATCH /api/private/ocpi/sessions";
    try {
        const updateObject = req.body.updateObject
        const sessionID = req.body.sessionID

        if (!sessionID || !updateObject) {
            console.log(`[${context}] Error - Missing input information`,);
            return res.status(400).send("Missing input information");
        }
        let query = {
            id: sessionID
        }
        Session.findOneAndUpdate(query, { $set: updateObject }, { new: true }).then(function (UpdatedSession) {
            return res.status(200).send(UpdatedSession);
        }).catch(function (error) {
            console.log(`[${context}] Error `, error.message);
            return res.status(400).send(error.message);
        })

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

router.patch('/api/private/ocpi/sessions/ev/acceptKMs', (req, res) => {
    let context = "PATCH /api/private/ocpi/sessions/ev/acceptKMs";
    try {
        let arrayEvID = req.body.evID
        let acceptKMs = req.body.acceptKMs

        if (!Array.isArray(arrayEvID) || typeof acceptKMs !== "boolean") {
            console.log("Missing input variables")
            return res.status(400).send("Missing input variables");
        }

        let query = null
        if (arrayEvID.length > 1) {
            let ids = []
            for (let evID of arrayEvID) {
                ids.push({ evId: evID })
            }
            query = { $or: ids }
        } else {
            query = {
                evId: arrayEvID[0]
            }
        }
        Session.updateMany(query, { $set: { acceptKMs: acceptKMs } }).then(function (result) {
            return res.status(200).send(true);
        }).catch(function (error) {
            console.log(`[${context}] Error `, error.message);
            return res.status(400).send(error.message);
        })

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
})

router.patch('/api/private/ocpi/sessions/ev/updateKMs', async (req, res) => {
    const context = "PATCH /api/private/ocpi/sessions/ev/updateKMs";
    try {
        const arrayEvID = req.body.evID
        const updateKMs = req.body.updateKMs

        if (!Array.isArray(arrayEvID) || typeof updateKMs !== "boolean" || arrayEvID.length < 1) {
            console.log("Missing input variables")
            return res.status(400).send("Missing input variables");
        }

        let query = {
            evId: { $in: arrayEvID }
        }
        if (updateKMs) query.evKms = { $exists: false };

        const result = await Session.updateMany(query, { $set: { updateKMs: updateKMs } });
        if (!result) {
            console.log(`[${context}] Error - Fail to update updateKMs to ev's `, arrayEvID);
            return res.status(500).send('Fail to update updateKMs to ev');
        }
        return res.status(200).send(true);

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
})

router.get('/api/private/ocpi/sessions/flow-logs', sessionFlowLogsController.getLogsByUserId);

router.get('/api/private/ocpi/sessions/v2/status', getSessionByStatus);

module.exports = router;
