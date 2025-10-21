const Utils = require('../../../utils')

module.exports = {
    send: (req,res) => sendRemoteStart(req,res)
};

async function sendRemoteStart(req,res) {
    let context = "Function sendRemoteStart";
    try {
        if (validateFields(req.body,req.headers['isadmin'])) return res.status(400).send(validateFields(req.body,req.headers['isadmin']))
        let cpoUserId = req.headers['isadmin'] ? req.body.ownerId : req.headers['userid']
        req.body.userId = cpoUserId
        req.body.freeStartTransaction = true
        let host = process.env.HostOCPP16 + process.env.PathSendRemoteStart
        let response = await Utils.postRequest(host , req.body)
        if (response.success) {
            return res.status(200).send(response.data)
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
            "plugId",
            "ownerId",
            "notes"
        ]
        if (!charger) {
            return { auth: false, code: 'server_charger_required', message: 'Charger data is required' }
        } else if (!charger.hwId) {
            return { auth: false, code: 'server_hwId_required', message: 'hwId is required' }
        } else if (!charger.plugId) {
            return { auth: false, code: 'server_plugId_required', message: 'plugId is required' }
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
