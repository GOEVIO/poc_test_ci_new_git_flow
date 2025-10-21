const Utils = require('../../../utils')

module.exports = {
    get: (req,res) => getWhitelist(req,res)
};

async function getWhitelist(req,res) {
    let context = "Function getWhitelist";
    try {
        if (validateFields(req.query)) return res.status(400).send(validateFields(req.query))
        let host = process.env.HostOCPP16 + process.env.PathGetWhitelist
        let response = await Utils.postRequest(host , req.query)
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

function validateFields(charger) {
    const context = "Function validateFields"
    try {
        let validFields = [
            "hwId",
        ]
        if (!charger) {
            return { auth: false, code: 'server_charger_required', message: 'charger data is required' }
        } else if (!charger.hwId) {
            return { auth: false, code: 'server_hwId_required', message: 'hwId is required' }
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
