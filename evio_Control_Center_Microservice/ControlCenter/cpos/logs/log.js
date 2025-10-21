var User = require('../../../models/user');
var OcpiLog = require('../../../models/ocpiLog');


module.exports = {
    get: (req,res) => getOcpiLogs(req,res),
};

async function getOcpiLogs(req,res) {
    let context = "Function getOcpiLogs";
    try {
        if (validateFields(req.query,req.headers['isadmin'])) return res.status(400).send(validateFields(req.query,req.headers['isadmin']))
        let cpoUserId = req.headers['isadmin'] ? req.query.ownerId : req.headers['userid']
        let network = req.query.network
        let module = req.query.module
        let trigger = req.query.trigger
        let startDate = req.query.startDate
        let stopDate = req.query.stopDate
        let httpCode = req.query.httpCode
        let success = req.query.success
        let foundUser = await User.findOne({_id : cpoUserId}).lean()
        let foundUserDetail = foundUser.cpoDetails.find(details => (details.network === network && details.certified && details.handshake))
        if (foundUserDetail) {
            let cpo = foundUserDetail.party_id.toUpperCase()
            return res.status(200).send(await getCpoLogs(cpo , network , module , trigger , startDate , stopDate , httpCode , success))
        } else {
            console.log('User not certified yet')
            return res.status(200).send([])
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

function validateFields(request , isAdmin) {
    const context = "Function validateFields"
    try {
        let validFields = [
            "ownerId",
            "network",
            "cpo",
            "module",
            "trigger",
            "startDate",
            "stopDate",
            "httpCode",
            "success",
        ]
        if (!request.network) {
            return { auth: false, code: 'server_network_required', message: 'network is required' }
        } else if (isAdmin && !request.ownerId) {
            return { auth: false, code: 'server_ownerId_required', message: 'ownerId is required' }
        } else {
            let notAllowedKey = Object.keys(request).find(key => !validFields.includes(key))
            if (notAllowedKey) {
                return { auth: false, code: `server_${notAllowedKey}_invalid`, message: `${notAllowedKey} can't be sent` }
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { auth: false, code: '', message: error.message}
    }
};

async function getCpoLogs(cpo , platformCode , module , trigger , startDate , stopDate , httpCode , success) {
    const context = "Function getCpoLogs"
    try {
        let query = {
            $and : [
                cpo ? {cpo} : {},
                platformCode ? {platformCode} : {},
                module ? {module} : {},
                trigger ? {trigger} : {},
                httpCode ? {httpCode} : {},
                success !== null && success !== undefined ? {success : success === "true" } : {},
                startDate ? { createdAt: { $gte: startDate } } : {},
                stopDate ? { createdAt: { $lte: stopDate } } : {},
            ]
        }
        let foundLogs = await OcpiLog.find(query , {__v : 0 , updatedAt : 0}).lean()
        return foundLogs
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return []
    }
}

