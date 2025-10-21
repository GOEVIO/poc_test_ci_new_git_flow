const Utils = require('../../../utils')
var User = require('../../../models/user');

module.exports = {
    get: (req,res) => getPlatformInfo(req,res),
};

async function getPlatformInfo(req,res) {
    let context = "Function getPlatformInfo";
    try {
        if (validateFields(req.query,req.headers['isadmin'])) return res.status(400).send(validateFields(req.query,req.headers['isadmin']))
        let cpoUserId = req.headers['isadmin'] ? req.query.ownerId : req.headers['userid']
        let network = req.query.network
        let foundUser = await User.findOne({_id : cpoUserId}).lean()
        let foundUserDetail = foundUser.cpoDetails.find(details => (details.network === network && details.certified && details.handshake))
        if (foundUserDetail) {
            let platform = await Utils.findOnePlatform({cpo : foundUserDetail.party_id.toUpperCase() , platformCode : network})
            let platformVersion = platform.cpoActiveCredentialsToken[0].version
            let version = await Utils.findOneVersions({cpo : platform.cpo , platformId : platform.platformId , version : platformVersion})
            let detail = await Utils.findOneDetails({cpo : platform.cpo , platformId : platform.platformId , version : platformVersion})
            let info = getRoleInfo(platform)
            let versions = getVersionsInfo(platform , version)
            let details = getDetailsInfo(platform , detail)
            let certification = getCertificationInfo(foundUserDetail)
            let credentials = getCredentialsInfo(platform)
            return res.status(200).send({info,versions,details,certification,credentials})

        } else {
            return res.status(400).send({ auth: false, code: '', message: 'User not certified yet' })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

function getRoleInfo(platform) {
    const context = "Function getRoleInfo"
    try {
       let role = platform.cpoRoles.find(roleObj => roleObj.role === process.env.cpoRole)
       return {
            partyId : role.party_id,
            name : role.business_details.name,
            logo : role.business_details.logo.url,
            thumbnail : role.business_details.logo.thumbnail,
            logoWidth : role.business_details.logo.width,
            logoHeight : role.business_details.logo.height,
            website : role.business_details.website,
       }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return {}
    }
}

function getVersionsInfo(platform , versionObj) {
    const context = "Function getVersionsInfo"
    try {
       return {
            cpoUrl : platform.cpoURL,
            hubUrl : platform.platformVersionsEndpoint,
            version : versionObj.version,
            cpo : versionObj.cpo,
       }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return {}
    }
}

function getDetailsInfo(platform , detailObj) {
    const context = "Function getDetailsInfo"
    try {
        let platformDetails = platform.platformDetails.find(details => details.version === platform.cpoActiveCredentialsToken[0].version)
       return {
            cpo : detailObj.endpoints,
            hub : platformDetails.endpoints
       }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return {}
    }
}

function getCredentialsInfo(platform) {
    const context = "Function getCredentialsInfo"
    try {
       return {
            cpo : platform.cpoTokensHistory,
            hub : platform.platformTokensHistory
       }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return {}
    }
}

function getCertificationInfo(foundUserDetail) {
    const context = "Function getCertificationInfo"
    try {
       return {
            certified : foundUserDetail.certified,
            status : foundUserDetail.status,
            certificationDate : foundUserDetail.certificationDate,
            handshake : foundUserDetail.handshake,
       }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return {}
    }
}

function validateFields(request , isAdmin) {
    const context = "Function validateFields"
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


