const Utils = require('../../../utils')

module.exports = {
    send: (req,res) => sendUnlockConnector(req,res)
};

async function sendUnlockConnector(req,res) {
    let context = "Function sendUnlockConnector";
    try {
        if (validateFields(req.body)) return res.status(400).send(validateFields(req.body))

        let host = process.env.HostOCPP16 + process.env.PathSendUnlockConnector
        let response = await Utils.postRequest(host , req.body)
        if (response.success) {
            return res.status(200).send({ auth: true, code: '', message: response.data})
        } else {
            return res.status(500).send({ auth: true, code: '', message: response.error })
        }

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

function validateFields(charger) {
    const context = "Function validateFields"
    try {
        let validFields = [
            "hwId",
            "plugId",
        ]
        if (!charger) {
            return { auth: false, code: 'server_charger_required', message: 'Charger data is required' }
        } else if (!charger.hwId) {
            return { auth: false, code: 'server_hwId_required', message: 'hwId is required' }
        } else if (!charger.plugId) {
            return { auth: false, code: "server_plug_id_required", message: 'Plug ID required' }
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
