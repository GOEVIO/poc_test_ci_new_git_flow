const Utils = require('../../../utils')
var User = require('../../../models/user');

module.exports = {
    updateEndpoint: (req,res) => updateCpoEndpoint(req,res),
    updateCredentials: (req,res) => updateCpoCredentials(req,res),
    deleteCredentials: (req,res) => deleteCpoCredentials(req,res),
};

async function updateCpoEndpoint(req,res) {
    let context = "Function updateCpoEndpoint";
    try {
        if (validateFieldsUpdateEndpoint(req.body,req.headers['isadmin'])) return res.status(400).send(validateFieldsUpdateEndpoint(req.body,req.headers['isadmin']))
        let cpoUserId = req.headers['isadmin'] ? req.body.ownerId : req.headers['userid']
        let network = req.body.network
        let foundUser = await User.findOne({_id : cpoUserId}).lean()
        let foundUserDetail = foundUser.cpoDetails.find(details => (details.network === network && details.certified && details.handshake ))
        if (foundUserDetail) {
            let cpo = foundUserDetail.party_id.toUpperCase()
            let platform = await Utils.findOnePlatform({cpo , platformCode : network})
            let credentials = getCredentialsSenderMethods(platform.platformId)
            req.body.cpo = cpo
            req.body.platformCode = network
            credentials.updateCpoEndpoint(req)
            .then(result => {
                return res.status(200).send(result)
            })
            .catch(error => {
                return res.status(400).send(error)
            })
        } else {
            return res.status(400).send({ auth: false, code: '', message: 'User not certified yet' })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

function validateFieldsUpdateEndpoint(request , isAdmin) {
    const context = "Function validateFieldsUpdateEndpoint"
    try {
        let validFields = [
            "ownerId",
            "network",
            "newEndpoint",
        ]
        if (isAdmin && !request.ownerId) {
            return { auth: false, code: 'server_ownerId_required', message: 'ownerId is required' }
        } else if (!request.network) {
            return { auth: false, code: 'server_network_required', message: 'network is required' }
        } else if (!request.newEndpoint) {
            return { auth: false, code: 'server_newEndpoint_required', message: 'newEndpoint is required' }
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



function getCredentialsSenderMethods(platformId) {
    const context = "Function validateFieldsUpdateEndpoint"
    try {
        return require(`../../../${platformId.toLowerCase()}/sender/versions/platformVersions`)
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return {}
    }
}


async function updateCpoCredentials(req,res) {
    let context = "Function updateCpoCredentials";
    try {
        if (validateFieldsUpdateCredentials(req.body,req.headers['isadmin'])) return res.status(400).send(validateFieldsUpdateCredentials(req.body,req.headers['isadmin']))
        let cpoUserId = req.headers['isadmin'] ? req.body.ownerId : req.headers['userid']
        let network = req.body.network
        let foundUser = await User.findOne({_id : cpoUserId}).lean()
        let foundUserDetail = foundUser.cpoDetails.find(details => (details.network === network && details.certified && details.handshake))
        if (foundUserDetail) {
            let cpo = foundUserDetail.party_id.toUpperCase()
            let platform = await Utils.findOnePlatform({cpo , platformCode : network})
            let credentials = getCredentialsSenderMethods(platform.platformId)
            req.body.cpo = cpo
            req.body.platformCode = network
            credentials.updateCpoCredentials(req)
            .then(result => {
                return res.status(200).send(result)
            })
            .catch(error => {
                return res.status(400).send(error)
            })
        } else {
            return res.status(400).send({ auth: false, code: '', message: 'User not certified yet' })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

function validateFieldsUpdateCredentials(request , isAdmin) {
    const context = "Function validateFieldsUpdateCredentials"
    try {
        let validFields = [
            "ownerId",
            "network",
        ]
        if (isAdmin && !request.ownerId) {
            return { auth: false, code: 'server_ownerId_required', message: 'ownerId is required' }
        } else if (!request.network) {
            return { auth: false, code: 'server_network_required', message: 'network is required' }
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

async function deleteCpoCredentials(req,res) {
    let context = "Function deleteCpoCredentials";
    try {
        if (validateFieldsUpdateCredentials(req.query,req.headers['isadmin'])) return res.status(400).send(validateFieldsUpdateCredentials(req.query,req.headers['isadmin']))
        let cpoUserId = req.headers['isadmin'] ? req.query.ownerId : req.headers['userid']
        let network = req.query.network
        let foundUser = await User.findOne({_id : cpoUserId}).lean()
        let foundUserDetail = foundUser.cpoDetails.find(details => (details.network === network && details.certified && details.handshake))
        if (foundUserDetail) {
            let cpo = foundUserDetail.party_id.toUpperCase()
            let platform = await Utils.findOnePlatform({cpo , platformCode : network})
            let credentials = getCredentialsSenderMethods(platform.platformId)
            req.body.cpo = cpo
            req.body.platformCode = network
            credentials.deleteCpoCredentials(req)
            .then(result => {
                return res.status(200).send(result)
            })
            .catch(error => {
                return res.status(400).send(error)
            })
        } else {
            return res.status(400).send({ auth: false, code: '', message: 'User not certified yet' })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}