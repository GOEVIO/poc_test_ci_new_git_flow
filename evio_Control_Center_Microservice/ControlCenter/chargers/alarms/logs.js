const Utils = require('../../../utils')

module.exports = {
    get: (req,res) => getAlarmLogs(req,res),
};

async function getAlarmLogs(req,res) {
    let context = "Function getAlarmLogs";
    try {
        if (validateFields(req.query)) return res.status(400).send(validateFields(req.query))
        let host = process.env.HostOCPP16 + process.env.PathGetLogs
        // We only want status notification logs here
        req.query.type = "StatusNotification"
        let response = await Utils.postRequest(host , req.query)
        if (response.success) {
            return res.status(200).send(filterLogs(response.data , req.query.filter))
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
            "startDate",
            "stopDate",
            "filter"
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


function filterLogs(logs , filter) {
    const context = "Function filterLogs"
    try {
        let alarmLogs = logs.filter(log => log.data.status === "Faulted")
        if (filter) {
            return alarmLogs.filter(log => 
                log.data.errorCode.toUpperCase().includes(filter.toUpperCase()) ||
                (log.data.info && log.data.info.toUpperCase().includes(filter.toUpperCase())) ||
                (log.data.vendorErrorCode && log.data.vendorErrorCode.toUpperCase().includes(filter.toUpperCase()))
            )
        }
        return alarmLogs
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return logs
    }
}
