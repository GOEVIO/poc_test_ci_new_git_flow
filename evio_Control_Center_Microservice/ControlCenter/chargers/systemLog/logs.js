const Utils = require('../../../utils')

module.exports = {
    get: (req,res) => getSystemLogs(req,res),
    filters: (req,res) => getFilters(req,res),
};

async function getSystemLogs(req,res) {
    let context = "Function getSystemLogs";
    try {
        if (validateFields(req.query)) return res.status(400).send(validateFields(req.query))
        let host = process.env.HostOCPP16 + process.env.PathGetLogs
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
async function getFilters(req,res) {
    let context = "Function getFilters";
    try {
        if (validateFields(req.query)) return res.status(400).send(validateFields(req.query))
        let host = process.env.HostOCPP16 + process.env.PathGetLogs
        let response = await Utils.postRequest(host , req.query)
        if (response.success) {
            return res.status(200).send(buildFilters(response.data))
        } else {
            return res.status(500).send({ auth: true, code: '', message: response.error })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

function buildFilters(data) {
    const context = "FUnction buildFilters"
    try {
        let filters = {
            success : [],
            type : [],
            plugId : [],
            trigger : [],
        }
        data.forEach(log => {
            //Check success
            if (!filters.success.includes(log.success)) {
                filters.success.push(log.success)
            }

            //Check type
            if (!filters.type.includes(log.type)) {
                filters.type.push(log.type)
                }

            //Check plugId
            if (!filters.plugId.includes(log.plugId)) {
                filters.plugId.push(log.plugId)
            }

            //Check trigger
            if (!filters.trigger.includes(log.trigger)) {
                filters.trigger.push(log.trigger)
            }

        })
        return filters

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return {
            success : [],
            trigger : [],
            plugId : [],
        }
    }
}

function validateFields(charger) {
    const context = "Function validateFields"
    try {
        let validFields = [
            "hwId",
            "startDate",
            "stopDate",
            "type",
            "plugId",
            "success",
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



