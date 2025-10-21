const Utils = require('../../../utils')

module.exports = {
    send: (req,res) => changeAvailability(req,res)
};

async function changeAvailability(req,res) {
    let context = "Function changeAvailability";
    try {
        if (validateFields(req.body)) return res.status(400).send(validateFields(req.body))

        let host = process.env.HostOCPP16 + process.env.PathSendChangeAvailability
        let response = await Utils.postRequest(host , req.body)
        if (response.success) {
            updatePlugActiveStatus(req.body)
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
            "chargerId",
            "hwId",
            "plugId",
            "availability",
        ]
        if (!charger) {
            return { auth: false, code: 'server_charger_required', message: 'Charger data is required' }
        } else if (!charger.chargerId) {
            return { auth: false, code: 'server_chargerId_required', message: 'chargerId is required' }
        } else if (!charger.hwId) {
            return { auth: false, code: 'server_hwId_required', message: 'hwId is required' }
        } else if (!charger.plugId) {
            return { auth: false, code: "server_plug_id_required", message: 'Plug ID required' }
        } else if (!charger.availability) {
            return { auth: false, code: "server_availability_key_required", message: 'Availability Type required' }
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

async function updatePlugActiveStatus(body) {
    try {
        let {chargerId , plugId , availability} = body
        let active = availability === "Operative" ? true  : false
        let host = process.env.HostChargers + process.env.PathUpdateChargerPlugs
        Utils.patchRequest(host , {chargerId , plugId , active })
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}