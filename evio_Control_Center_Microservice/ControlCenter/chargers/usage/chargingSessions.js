const Utils = require('../../../utils')

module.exports = {
    get: (req,res) => getChargingSessions(req,res),
};

async function getChargingSessions(req,res) {
    let context = "Function getChargingSessions";
    try {
        if (validateFields(req.query,req.headers['isadmin'])) return res.status(400).send(validateFields(req.query,req.headers['isadmin']))
        let userId = req.headers['isadmin'] ? req.query.ownerId : req.headers['userid']
        let hwId = req.query.hwId
        let host = process.env.HostChargers + process.env.PathGetChargingSessions
        let response = await Utils.getRequest(host , {hwId,userId , createdWay : process.env.createdWayControlCenter}) 
        if (response.success) {
            let operatorSessions = response.data.map(session => operatorSession(session))
            return res.status(200).send(operatorSessions)
        } else {
            return res.status(500).send({ auth: true, code: '', message: response.error })
        }
        

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

function validateFields(charger , isAdmin) {
    const context = "Function validateFields"
    try {
        let validFields = [
            "hwId",
            "ownerId",
        ]
        if (!charger) {
            return { auth: false, code: 'server_charger_required', message: 'Charger data is required' }
        } else if (!charger.hwId) {
            return { auth: false, code: 'server_hwId_required', message: 'hwId is required' }
        } else if (isAdmin && !charger.ownerId) {
            return { auth: false, code: 'server_ownerId_required', message: 'ownerId is required' }
        } else {
            let notAllowedKey = Object.keys(charger).find(key => !validFields.includes(key))
            if (notAllowedKey) {
                return { auth: false, code: `server_${notAllowedKey}_invalid`, message: `${notAllowedKey} can't be sent` }
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { auth: false, code: '', message: error.message}
    }
};

function operatorSession(session) {
    const context = "Function operatorSession"
    try {
        return {
            sessionId : session.sessionId,
            address : session.address,
            plugId : session.plugId,
            status : session.status,
            startDateTime : new Date(session.startDate).toISOString(),
            stopDateTime : new Date(session.stopDate).toISOString(),
            timeCharged : session.timeCharged,
            totalPower : session.totalPower,
            notes : session.notes ? session.notes : "",
        }

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return session
    }
}
