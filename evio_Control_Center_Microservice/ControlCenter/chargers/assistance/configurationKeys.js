const Utils = require('../../../utils')

module.exports = {
    getKeys: (req,res) => getConfigurationKeysDiff(req,res),
    getLists: (req,res) => getConfigurationLists(req,res),
    updateKeys: (req,res) => updateConfigurationLists(req,res),
};

async function getConfigurationLists(req,res) {
    let context = "Function getConfigurationLists";
    try {
        let host = process.env.HostOCPP16 + process.env.PathGetConfigurationLists
        let response = await Utils.postRequest(host , {})
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

async function getConfigurationKeysDiff(req,res) {
    let context = "Function getConfigurationKeysDiff";
    try {
        if (validateFieldsGet(req.query)) return res.status(400).send(validateFieldsGet(req.query))
        let { hwId , evioKeysId , reload} = req.query
        let host = process.env.HostOCPP16 + process.env.PathGetConfigurationKeysDiff
        let response = await Utils.postRequest(host , {hwId , evioKeysId , reload : reload === "true"})
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

function validateFieldsGet(charger) {
    const context = "Function validateFieldsGet"
    try {
        let validFields = [
            "hwId",
            "evioKeysId",
            "reload",
        ]
        if (!charger) {
            return { auth: false, code: 'server_charger_required', message: 'Charger data is required' }
        } else if (!charger.hwId) {
            return { auth: false, code: 'server_hwId_required', message: 'hwId is required' }
        } else if (!charger.evioKeysId) {
            return { auth: false, code: 'server_evioKeysId_required', message: 'evioKeysId is required' }
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

async function updateConfigurationLists(req,res) {
    let context = "Function updateConfigurationLists";
    try {
        if (validateFieldsUpdate(req.body)) return res.status(400).send(validateFieldsUpdate(req.body))
        let host = process.env.HostOCPP16 + process.env.PathUpdateConfigurationKeys
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

function validateFieldsUpdate(charger) {
    const context = "Function validateFieldsUpdate"
    try {
        let validFields = [
            "hwId",
            "configuration",
        ]
        if (!charger) {
            return { auth: false, code: 'server_charger_required', message: 'Charger data is required' }
        } else if (!charger.hwId) {
            return { auth: false, code: 'server_hwId_required', message: 'hwId is required' }
        } else if (!charger.configuration ) {
            return { auth: false, code: 'server_configuration_required', message: 'configuration is required' }
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