
const User = require('../../models/user')
const axios = require('axios');
const Utils = require('../../utils')
module.exports = {
    updateUserPermissionModules: async function (req, res) {
        const context = "Function updateUserPermissionModules"
        try {
            let body = req.body
            let updatedUser = await User.findOneAndUpdate({_id : body.userId} , {$set : { permissionModules : body.permissionModules}} , {new : true})
            return res.status(200).send(updatedUser);
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return res.status(500).send(error.message);
        }   
        
    },
    updateAllDefaultPermissionModules: async function (req, res) {
        const context = "Function updateAllDefaultPermissionModules"
        try {
            let updatedUsers = await User.updateMany({} , {$set : { permissionModules : {}}} , {new : true}).lean()
            return res.status(200).send(updatedUsers);
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return res.status(500).send(error.message);
        }   
        
    },
    updateOperatorIdIdentity: async function (req, res) {
        const context = "Function updateOperatorIdIdentity"
        try {
            let host = process.env.HostUser + process.env.PathUpdateUserOperatorId
            let resp = await patchRequest(host,req.body)
            return res.status(200).send(resp);
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return res.status(500).send(error.message);
        }   
        
    },
    updateDefaultCpoDetails: async function (req, res) {
        const context = "Function updateDefaultCpoDetails"
        try {
            let cpoDetails = Utils.defaultCpoDetails()
            let updatedUsers = await User.updateMany({} , {$set : { cpoDetails }} , {new : true}).lean()
            return res.status(200).send(updatedUsers);
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return res.status(500).send(error.message);
        }   
        
    },
    updateNetworkPartyId: async function (req, res) {
        const context = "Function updateNetworkPartyId"
        try {
            let {partyId , network , _id} = req.body
            let updatedUsers = await User.findOneAndUpdate({_id , "cpoDetails.network" : network} , {$set : { "cpoDetails.$.party_id" : partyId}} , {new : true}).lean()
            return res.status(200).send(updatedUsers);
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return res.status(500).send(error.message);
        }   
        
    },
    addExistingClients: async function (req, res) {
        const context = "Function addExistingClients"
        try {
            let host = process.env.HostUser + process.env.PathUpdateUserOperatorId
            let updatedUsers = await patchRequest(host,req.body)
            updateChargersAndInfrastructures(req.body.userId ,req.body.operatorId  )
            return res.status(200).send(updatedUsers);
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return res.status(500).send(error.message);
        }   
        
    }
}

async function patchRequest(host,data) {
    const context = "Function patchRequest";
    try {
        let resp = await axios.patch(host, data)
        if (resp.data) {
            return resp.data
        } else {
            return null
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null;
    }
}

async function updateChargersAndInfrastructures(users , operatorId) {
    const context = "Function updateChargersAndInfrastructures";
    try {
        for (let userId of users) {
            let infrastructures = await Utils.getInfrastructureInfo(userId)
            for (let infrastructure of infrastructures) {
                
                // Update infrastructure with operatorId
                let hostInfrastructure = process.env.HostChargers + process.env.PathUpdateInfrastructureOperatorId
                let updatedInfrastructure = await patchRequest(hostInfrastructure,{ infrastructureId : infrastructure.infrastructureId, operatorId})

                // Update chargers with operatorId
                let hostChargerInfrastructure = process.env.HostChargers + process.env.PathUpdateOperatorByInfrastructure
                let updatedChargers = await patchRequest(hostChargerInfrastructure,{ infrastructure : infrastructure.infrastructureId, operatorId})
            }
            addUserClientToList(operatorId , userId , userId)
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null;
    }
}

async function addUserClientToList(cpoUserId , userClientId , userControlCenterId) {
    const context = "Function addUserClientToList"
    try {
        let query = {
            _id : cpoUserId,
            clients: {
                $elemMatch: { 
                    userId: userClientId, 
                    controlCenterUserId : userControlCenterId,
                }
            }
        };
        let foundUser = await User.findOne(query)
        if (!foundUser) {
            // await User.findOneAndUpdate({clients: { $elemMatch: { userId: userClientId, controlCenterUserId : userControlCenterId}}}, {$pull: { clients : {userId : userClientId , controlCenterUserId : userControlCenterId} }}).lean()
            await User.findOneAndUpdate({_id : cpoUserId} , {$push : { clients : {userId : userClientId , controlCenterUserId : userControlCenterId} }}).lean()
        } else {
            console.log("Client already exists in client list")
        }
    } catch(error) {
        console.error(`[${context}] Error `, error.message);
    }
}