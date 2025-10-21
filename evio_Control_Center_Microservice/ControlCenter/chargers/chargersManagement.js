var User = require('../../models/user');
const Utils = require('../../utils')
const axios = require('axios');
var LocationsQueue = require('../../models/locationsQueue');
var Tariff = require('../../models/tariff');
// Disable node-cron by mocking for an easy turn-back 
// const cron = require('node-cron'); 
const cron = {
    schedule: ()=>({
     start: ()=>{},
     stop: ()=>{},   
     validate: ()=>{},
     status: '',
    })
};
const { findOneGroupCSUser } = require('evio-library-identity').default;

module.exports = {
    get : (req,res) => getChargers(req,res),
    getNetworks : (req,res) => getChargerNetworks(req,res),
    getDetails : (req,res) => getChargerDetails(req,res),
    createInfrastructure : (req,res) => createInfrastructure(req,res),
    getInfrastructure : (req,res) => getInfrastructure(req,res),
    updateInfrastructure : (req,res) => updateInfrastructure(req,res),
    deleteInfrastructure : (req,res) => deleteInfrastructure(req,res),
    create : (req,res) => createCharger(req,res),
    update : (req,res) => updateCharger(req,res),
    updatePlugs : (req,res) => updateChargerPlugs(req,res),
    getPlugs : (req,res) => getChargerPlugs(req,res),
    delete : (req,res) => removeCharger(req,res),
    networkActivation : (req,res) => networkActivation(req,res),
    toOcpi : (req,res) => forceJobProcess(req,res),
    getNetworkChargerTariffs : (req,res) => networkChargerTariffs(req,res),
}

cron.schedule('*/3 * * * * *', () => {
    sendLocationsToOcpi()
});

async function getChargers(req,res) {
    const context = "GET /api/private/controlcenter/allInfrastructures - Function getChargers"
    try {
        let cpoUserId = req.headers['userid']
        let ownerId = req.query.ownerId
        let userId = req.query.userId
        let infrastructureId = req.query.infrastructureId
        let searchName = req.query.searchName
        let userClientsListArray = await getUserClientsList(cpoUserId , req.headers['isadmin'] , ownerId , userId)
        getUserChargers(userClientsListArray , searchName , infrastructureId , res) 
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

async function getUserClientsList(cpoUserId , isAdmin , ownerId , userId) {
    const context = "Function getUserClientsList"
    try {
        let usersFound = await User.find(!isAdmin ? {_id : cpoUserId , active : true} : ( ownerId ? {_id : ownerId , active : true} : { active : true} ) , {_id : 1 , "clients" : 1 , name : 1 , imageContent : 1}).lean()
        return usersFound.map(user => cpoClients(user , userId))
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return {clientsList : [] , owner : "" , _id : "" }
    }
}

function cpoClients(user , userId) {
    const context = "Function cpoClients"
    try {
        return {
            clientsList : userId ? user.clients.map(client => client.userId).filter(userIdString => userIdString === userId) : user.clients.map(client => client.userId), 
            owner : user.name , 
            _id : user._id , 
            ownerImageContent : user.imageContent
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return {clientsList : [], owner : user.name , _id : user._id}
    }
}

async function getUserChargers(userClientsListArray , searchName , infrastructureId , res) {
    const context = "Function getUserChargers";
    try {
        let host = process.env.HostUser + process.env.PathGetControlCenterClientsChargers
        let data = {
            _id : {$in : userClientsListArray.map(user => user.clientsList).flat(1)},
            active : true,
        }
        let resp = await axios.get(host, {data})
        if (resp.data) {

            let userChargerInfo = []
            await Promise.all(resp.data.map(async (client ) => { 

                let infrastructures = await getInfrastructureInfo(client.userId , infrastructureId)

                let owner = getCpoObject(userClientsListArray , client).owner
                let ownerId = getCpoObject(userClientsListArray , client)._id
                let ownerImageContent = getCpoObject(userClientsListArray , client).ownerImageContent 

                if (searchName) {
                    infrastructures = infrastructures.filter(infrastructure => filterInfrastructureCharger(infrastructure , searchName))

                    let nTotalInfrastructures = infrastructures.length

                    let equalLineIndex = userChargerInfo.findIndex(obj => obj.ownerId == ownerId)
                    if (equalLineIndex > -1) {
                        if (infrastructures.length > 0) {
                            userChargerInfo[equalLineIndex].userClients.push({
                                name : client.name,
                                imageContent : client.imageContent,
                                userId : client.userId,
                                blocked : client.blocked,
                                infrastructures,
                                nTotalInfrastructures
                            })
                        }
                    } else {

                        if (infrastructures.length > 0) {
                            userChargerInfo.push({
                                owner,
                                ownerId,
                                ownerImageContent,
                                userClients : [
                                    {
                                        name : client.name,
                                        imageContent : client.imageContent,
                                        userId : client.userId,
                                        blocked : client.blocked,
                                        infrastructures,
                                        nTotalInfrastructures
                                    }
                                ]
                            });
                        }
                    }
                } else {
                    let nTotalInfrastructures = infrastructures.length

                    let equalLineIndex = userChargerInfo.findIndex(obj => obj.ownerId == ownerId)
                    if (equalLineIndex > -1) {
                        userChargerInfo[equalLineIndex].userClients.push({
                            name : client.name,
                            imageContent : client.imageContent,
                            userId : client.userId,
                            blocked : client.blocked,
                            infrastructures,
                            nTotalInfrastructures
                        })
                    } else {
                        userChargerInfo.push({
                            owner,
                            ownerId,
                            ownerImageContent,
                            userClients : [
                                {
                                    name : client.name,
                                    imageContent : client.imageContent,
                                    userId : client.userId,
                                    blocked : client.blocked,
                                    infrastructures,
                                    nTotalInfrastructures
                                }
                            ]
                        });
                    }
                }
                return {
                    ...client, 
                    owner, 
                    ownerId,
                    ownerImageContent,
                    infrastructures,
                }
            }))
            
            return res.status(200).send(userChargerInfo);
        } else {
            return res.status(200).send([]);
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

function getCpoObject(userClientsListArray , client) {
    const context = "Function getCpoObject"
    try {
        return userClientsListArray.find(user => user.clientsList.find(userId => userId === client.userId) )
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return {}
    }
}

async function getInfrastructureInfo(userId , infrastructureId) {
    const context = "Function getInfrastructureInfo";
    try {
        let host = process.env.HostChargers + process.env.PathGetMyInfrastructure
        let params = { userId , infrastructureId };
        let resp = await axios.get(host, {params})
        if (resp.data) {
            return resp.data
        } else {
            return null
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    }
}

function filterInfrastructureCharger(infrastructure , searchName) {
    // return infrastructure.name.includes(searchName) || 
    return infrastructure.listChargers.find(charger => charger.name.toUpperCase().includes(searchName.toUpperCase())) ||
    infrastructure.listChargers.find(charger => charger.hwId.toUpperCase().includes(searchName.toUpperCase()))
}


async function createInfrastructure(req,res) {
    const context = "POST /api/private/controlcenter/infrastructure - Function createInfrastructure"
    try {
        let cpoUserId = req.headers['isadmin'] ? req.body.ownerId : req.headers['userid']
        let userId = req.body.userId ? req.body.userId : ""
        let resp = await postInfrastructure(req.body , {'userid' : userId , 'clientname' : "EVIO" , 'ownerid' : cpoUserId})
        if (resp.success) {
            return res.status(200).send(resp.data)
        } else {
            return res.status(400).send({ auth: false, code: resp.code, message: resp.error })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}


async function postInfrastructure(data , headers ) {
    const context = "Function postInfrastructure";
    let response = {success : true , data : {} , error : "" , code : ""}
    try {
        let host = process.env.HostChargers + process.env.PathCreateInfrastructure
        let resp = await axios.post(host, data, {headers})
        if (resp.data) {
            return {...response , data : resp.data}
        } else {
            return { ...response , success : false, error: 'Infrastructure not created' }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        if (error.response) {
            if (error.response.data) {
                return { ...response , success : false, error: error.response.data.message , code : error.response.data.code}
            }
            return { ...response , success : false, error: error.message }
        }
        return { ...response , success : false, error: error.message }
    }
}

async function getInfrastructure(req,res) {
    const context = "GET /api/private/controlcenter/infrastructure - Function getInfrastructure"
    try {
        let cpoUserId = req.headers['userid']
        let infrastructureId = req.query.infrastructureId
        let host = process.env.HostChargers + process.env.PathGetInfrastructure
        let resp = await getRequest(host , {infrastructureId})
        if (resp.success) {
            let userFound = await Utils.getUserInfo(resp.data.userId)
            return res.status(200).send({...resp.data , clientName : userFound.name })
        } else {
            return res.status(400).send({ auth: false, code: resp.code, message: resp.error })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

async function getRequest(host , params) {
    const context = "Function getRequest";
    let response = {success : true , data : {} , error : "" , code : ""}
    try {
        let resp = await axios.get(host, {params})
        if (resp.data) {
            return {...response , data : resp.data}
        } else {
            return { ...response , success : false, error: 'No content found' }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        if (error.response) {
            if (error.response.data) {
                return { ...response , success : false, error: error.response.data.message , code : error.response.data.code}
            }
            return { ...response , success : false, error: error.message }
        }
        return { ...response , success : false, error: error.message }
    }
}

// async function patchRequest(host,data) {
//     const context = "Function patchRequest";
//     let response = {success : true , data : {} , error : "" , code : ""}
//     try {
//         let resp = await axios.patch(host, data)
//         if (resp.data) {
//             return {...response , data : resp.data}
//         } else {
//             return { ...response , success : false, error: 'Not updated' }
//         }
//     } catch (error) {
//         console.error(`[${context}] Error `, error.message);
//         if (error.response) {
//             if (error.response.data) {
//                 return { ...response , success : false, error: error.response.data.message , code : error.response.data.code}
//             }
//             return { ...response , success : false, error: error.message }
//         }
//         return { ...response , success : false, error: error.message }
//     }
// }

async function updateInfrastructure(req,res) {
    const context = "PATCH /api/private/controlcenter/infrastructure - Function updateInfrastructure"
    try {
        let cpoUserId = req.headers['userid']
        if (validateUpdateFields(req.body)) return res.status(400).send(validateUpdateFields(req.body))
        let host = process.env.HostChargers + process.env.PathUpdateInfrastructure
        let resp = await Utils.patchRequest(host,req.body)
        if (resp.success) {
            return res.status(200).send(resp.data)
        } else {
            return res.status(400).send({ auth: false, code: resp.code, message: resp.error })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

function validateUpdateFields(infrastructure) {
    const context = "Function validateUpdateFields"
    try {
        let validFields = [
            "name",
            "CPE",
            "imageContent",
            "infrastructureId",
            "address",
        ]
        if (!infrastructure) {
            return { auth: false, code: 'server_user_required', message: 'User data is required' }
        } else if (!infrastructure.infrastructureId) {
            return { auth: false, code: 'server_infrastructureId_required', message: 'infrastructureId is required' }
        } else if (!infrastructure.name) {
            return { auth: false, code: 'server_name_required', message: 'Name is required' }
        } else {
            let notAllowedKey = Object.keys(infrastructure).find(key => !validFields.includes(key))
            if (notAllowedKey) {
                return { auth: false, code: `server_${notAllowedKey}_invalid`, message: `${notAllowedKey} can't be updated` }
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { auth: false, code: '', message: error.message}
    }
};

async function deleteInfrastructure(req,res) {
    const context = "DELETE /api/private/controlcenter/infrastructure - Function deleteInfrastructure"
    try {
        let cpoUserId = req.headers['userid']
        let host = process.env.HostChargers + process.env.PathDeleteInfrastructure
        let resp = await deleteRequest(host,req.body)
        if (resp.success) {
            return res.status(200).send(resp.data)
        } else {
            return res.status(400).send({ auth: false, code: resp.code, message: resp.error })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

async function deleteRequest(host,data) {
    const context = "Function deleteRequest";
    let response = {success : true , data : {} , error : "" , code : ""}
    try {
        let resp = await axios.delete(host, {data})
        if (resp.data) {
            return {...response , data : resp.data}
        } else {
            return { ...response , success : false, error: 'Not deleted' }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        if (error.response) {
            if (error.response.data) {
                return { ...response , success : false, error: error.response.data.message , code : error.response.data.code}
            }
            return { ...response , success : false, error: error.message }
        }
        return { ...response , success : false, error: error.message }
    }
}

async function getChargerDetails(req,res) {
    const context = "POST /api/private/controlcenter/charger/details - Function getChargerDetails"
    try {
        let cpoUserId = req.headers['userid']
        if (validateChargerDetailsFields(req.query)) return res.status(400).send(validateChargerDetailsFields(req.query))
        let host = process.env.HostChargers + process.env.PathGetChargerDetails
        let resp = await getRequest(host , req.query)
        if (resp.success) {
            return res.status(200).send(resp.data)
        } else {
            return res.status(400).send({ auth: false, code: resp.code, message: resp.error })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

function validateChargerDetailsFields(charger) {
    const context = "Function validateChargerDetailsFields"
    try {
        let validFields = [
            "chargerId",
            "userId",
        ]
        if (!charger) {
            return { auth: false, code: 'server_user_required', message: 'User data is required' }
        } else if (!charger.chargerId) {
            return { auth: false, code: 'server_chargerId_required', message: 'chargerId is required' }
        } else if (!charger.userId) {
            return { auth: false, code: 'server_userId_required', message: 'userId is required' }
        } else {
            let notAllowedKey = Object.keys(charger).find(key => !validFields.includes(key))
            if (notAllowedKey) {
                return { auth: false, code: `server_${notAllowedKey}_invalid`, message: `${notAllowedKey} can't be updated` }
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { auth: false, code: '', message: error.message}
    }
};

async function createCharger(req,res) {
    const context = "POST /api/private/controlcenter/charger - Function createCharger"
    try {
        if (validateCreateChargerFields(req.body,req.headers['isadmin'])) return res.status(400).send(validateCreateChargerFields(req.body,req.headers['isadmin']))
        let cpoUserId = req.headers['isadmin'] ? req.body.ownerId : req.headers['userid']
        let userId = req.body.userId ? req.body.userId : ""
        let resp = await postCharger(req.body , {'userid' : userId , 'clientname' : "EVIO" , 'ownerid' : cpoUserId})
        if (resp.success) {
            return res.status(200).send(resp.data)
        } else {
            return res.status(400).send({ auth: false, code: resp.code, message: resp.error })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

async function postCharger(data , headers ) {
    const context = "Function postCharger";
    let response = {success : true , data : {} , error : "" , code : ""}
    try {
        let host = process.env.HostChargers + process.env.PathCreateCharger
        let resp = await axios.post(host, data, {headers})
        if (resp.data) {
            return {...response , data : resp.data}
        } else {
            return { ...response , success : false, error: 'Charger not created' }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        if (error.response) {
            if (error.response.data) {
                return { ...response , success : false, error: error.response.data.message , code : error.response.data.code}
            }
            return { ...response , success : false, error: error.message }
        }
        return { ...response , success : false, error: error.message }
    }
}

function validateCreateChargerFields(charger , isAdmin) {
    const context = "Function validateCreateChargerFields"
    try {
        let validFields = [
            "userId",
            "hasInfrastructure",
            "infrastructureId",
            "hwId",
            "serialNumber",
            "name",
            "address",
            "geometry",
            "CPE",
            "instantBooking",
            "allowRFID",
            "requireConfirmation",
            "parkingType",
            "vehiclesType",
            "defaultImage",
            "imageContent",
            "infoPoints",
            "internalInfo",
            "offlineNotification",
            "offlineEmailNotification",
            "chargingDistance",
            "ownerId",
            "locationType",
            "energyOwner",
            "CSE",
            "voltageLevel",
            "energyNotes",
            "supplyDate",
            "installationDate",
            "goLiveDate",
            "warranty",
            "expiration",
            "preCheck",
            "generateAction",
            "acquisitionNotes",
            "expectedLife",
            "MTBF",
            "workedHours",
            "lifeCycleStatus",
            "notify",
            "lifeCycleNotes",
            "siteLicense",
            "legalLicenseDate",
            "legalLicenseExpiry",
            "legalSiteReminder",
            "legalSiteNotes",
            "inspection",
            "lastInspection",
            "nextInspection",
            "legalInspectionReminder",
            "legalInspectionNotes",
        ]
        if (!charger) {
            return { auth: false, code: 'server_charger_required', message: 'Charger data is required' }
        } else if (!charger.name) {
            return { auth: false, code: 'server_name_required', message: 'name is required' }
        } else if (!charger.chargingDistance) {
            return { auth: false, code: 'server_chargingDistance_required', message: 'chargingDistance is required' }
        } else if (!charger.locationType) {
            return { auth: false, code: 'server_locationType_required', message: 'locationType is required' }
        } else if (Utils.isEmptyObject(charger.address)) {
            return { auth: false, code: 'server_address_required', message: 'address is required' }
        } else if (!charger.address.street) {
            return { auth: false, code: 'server_address_street_required', message: 'street address is required' }
        } else if (!charger.address.number) {
            return { auth: false, code: 'server_address_number_required', message: 'number address is required' }
        } else if (!charger.address.zipCode) {
            return { auth: false, code: 'server_address_zipCode_required', message: 'zipCode address is required' }
        } else if (!charger.address.country) {
            return { auth: false, code: 'server_address_country_required', message: 'country address is required' }
        } else if (!charger.address.city) {
            return { auth: false, code: 'server_address_city_required', message: 'city address is required' }
        } else if (!charger.address.state) {
            return { auth: false, code: 'server_address_state_required', message: 'state address is required' }
        } else if (!charger.imageContent) {
            return { auth: false, code: 'server_imageContent_required', message: 'imageContent is required' }
        } else if (charger.imageContent.length < 1) {
            return { auth: false, code: 'server_imageContent_required', message: 'imageContent is required to have at least one image' }
        } else if (!charger.parkingType) {
            return { auth: false, code: 'server_parkingType_required', message: 'parkingType is required' }
        } else if (!charger.vehiclesType) {
            return { auth: false, code: 'server_vehiclesType_required', message: 'vehiclesType is required' }
        } else if (Utils.isEmptyObject(charger.geometry)) {
            return { auth: false, code: 'server_geometry_required', message: 'geometry is required' }
        } else if (!charger.geometry.coordinates) {
            return { auth: false, code: 'server_geometry_coordinates_required', message: 'Geometry coordinates is required' }
        } else if (charger.geometry.coordinates.length !== 2) {
            return { auth: false, code: 'server_geometry_coordinates_required', message: 'Geometry coordinates must have 2 coordinates' }
        } else if (!charger.userId) {
            return { auth: false, code: 'server_userId_required', message: 'userId is required' }
        } else if (isAdmin && !charger.ownerId) {
            return { auth: false, code: 'server_ownerId_required', message: 'ownerId is required' }
        } else if (!charger.infrastructureId) {
            return { auth: false, code: 'server_infrastructureId_required', message: 'infrastructureId is required' }
        } else if (!charger.hwId) {
            return { auth: false, code: 'server_hwid_required', message: 'Charger Hardware Id is required' }
        } else if (charger.offlineNotification && !charger.offlineEmailNotification) {
            return { auth: false, code: 'server_offlineEmailNotification_required', message: 'offlineEmailNotification is required' }
        } else if (!charger.supplyDate) {
            return { auth: false, code: 'server_supplyDate_required', message: 'supplyDate is required' }
        } else if (!charger.installationDate) {
            return { auth: false, code: 'server_installationDate_required', message: 'installationDate is required' }
        } else if (!charger.goLiveDate) {
            return { auth: false, code: 'server_goLiveDate_required', message: 'goLiveDate is required' }
        } else if (!charger.warranty) {
            return { auth: false, code: 'server_warranty_required', message: 'warranty is required' }
        } else if (!charger.expiration) {
            return { auth: false, code: 'server_expiration_required', message: 'expiration is required' }
        } else if (!charger.preCheck) {
            return { auth: false, code: 'server_preCheck_required', message: 'preCheck is required' }
        } else if (!charger.generateAction) {
            return { auth: false, code: 'server_generateAction_required', message: 'generateAction is required' }
        } else if (!charger.expectedLife) {
            return { auth: false, code: 'server_expectedLife_required', message: 'expectedLife is required' }
        } else if (!charger.MTBF) {
            return { auth: false, code: 'server_MTBF_required', message: 'MTBF is required' }
        } else if (!charger.workedHours) {
            return { auth: false, code: 'server_workedHours_required', message: 'workedHours is required' }
        } else if (!charger.lifeCycleStatus) {
            return { auth: false, code: 'server_lifeCycleStatus_required', message: 'lifeCycleStatus is required' }
        } else if (!charger.notify) {
            return { auth: false, code: 'server_notify_required', message: 'notify is required' }
        } else if (!charger.siteLicense) {
            return { auth: false, code: 'server_siteLicense_required', message: 'siteLicense is required' }
        } else if (!charger.legalLicenseDate) {
            return { auth: false, code: 'server_legalLicenseDate_required', message: 'legalLicenseDate is required' }
        } else if (!charger.legalLicenseExpiry) {
            return { auth: false, code: 'server_legalLicenseExpiry_required', message: 'legalLicenseExpiry is required' }
        } else if (!charger.legalSiteReminder) {
            return { auth: false, code: 'server_legalSiteReminder_required', message: 'legalSiteReminder is required' }
        } else if (!charger.inspection) {
            return { auth: false, code: 'server_inspection_required', message: 'inspection is required' }
        } else if (!charger.legalInspectionReminder) {
            return { auth: false, code: 'server_legalInspectionReminder_required', message: 'legalInspectionReminder is required' }
        } else {
            let notAllowedKey = Object.keys(charger).find(key => !validFields.includes(key))
            if (notAllowedKey) {
                return { auth: false, code: `server_${notAllowedKey}_invalid`, message: `${notAllowedKey} can't be created` }
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { auth: false, code: '', message: error.message}
    }
};

async function networkActivation(req,res) {
    const context = "POST /api/private/controlcenter/charger/network - Function networkActivation"
    try {
        if (validateChargerNetworkFields(req.body , req.headers['isadmin'])) return res.status(400).send(validateChargerNetworkFields(req.body , req.headers['isadmin']))
        let {network , ownerId , activationRequest , chargers} = req.body
        let cpoUserId = req.headers['isadmin'] ? ownerId : req.headers['userid']
        let foundUser = await Utils.findUserById(cpoUserId)
        if (foundUser) {
            if (foundUser.cpoDetails.find(details => (details.network === network && details.certified && details.handshake))) {
                networkActivationOCPI(activationRequest , ownerId , network , foundUser , chargers , req.body , res)
            } else if (network === process.env.NetworkEVIO) {
                networkActivationEVIO(activationRequest , ownerId , network , chargers , res)
            } else {
                return res.status(400).send({ auth: false, code: '', message: 'User not valid to activate network' })
            }
        } else {
            return res.status(400).send({ auth: false, code: '', message: 'User does not exist' })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

function validateChargerNetworkFields(charger , isAdmin) {
    const context = "Function validateChargerNetworkFields"
    try {
        let validFields = [
            "chargers",
            "network",
            "activationRequest",
            "ownerId"
        ]
        if (!charger) {
            return { auth: false, code: 'server_user_required', message: 'User data is required' }
        } else if (!charger.chargers) {
            return { auth: false, code: 'server_chargers_required', message: 'chargers is required' }
        } else if (!(charger.chargers.length > 0 )) {
            return { auth: false, code: 'server_chargerId_required', message: 'Chargers array does not have any chargerId' }
        } else if (!charger.chargers.every(charger => charger.chargerId)) {
            return { auth: false, code: 'server_chargerId_required', message: 'At least one chargerId is missing from chargers array' }
        } else if (!charger.network) {
            return { auth: false, code: 'server_network_required', message: 'network is required' }
        } else if (charger.activationRequest === null || charger.activationRequest === undefined) {
            return { auth: false, code: 'server_activationRequest_required', message: 'activationRequest is required' }
        } else if (!charger.ownerId) {
            return { auth: false, code: 'server_ownerId_required', message: 'ownerId is required' }
        } else {
            let notAllowedKey = Object.keys(charger).find(key => !validFields.includes(key))
            if (notAllowedKey) {
                return { auth: false, code: `server_${notAllowedKey}_invalid`, message: `${notAllowedKey} can't be updated` }
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { auth: false, code: '', message: error.message}
    }
};

async function patchChargerNetwork(data) {
    const context = "Function patchChargerNetwork";
    let response = {success : true , data : {} , error : "" , code : ""}
    try {
        let host = process.env.HostChargers + process.env.PathNetworkActivation
        let resp = await axios.patch(host, data)
        if (resp.data) {
            return {...response , data : resp.data}
        } else {
            return { ...response , success : false, error: 'Network not updated' }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        if (error.response) {
            if (error.response.data) {
                return { ...response , success : false, error: error.response.data.message , code : error.response.data.code}
            }
            return { ...response , success : false, error: error.message }
        }
        return { ...response , success : false, error: error.message }
    }
}

async function updateCharger(req,res) {
    const context = "PATCH /api/private/controlcenter/charger - Function updateCharger"
    try {
        if (validateUpdateChargerFields(req.body,req.headers['isadmin'])) return res.status(400).send(validateUpdateChargerFields(req.body,req.headers['isadmin']))
        let cpoUserId = req.headers['isadmin'] ? req.body.ownerId : req.headers['userid']
        let userId = req.body.userId ? req.body.userId : ""
        let foundCharger = await Utils.findChargerById(req.body.chargerId)
        console.log("body")
        console.log(JSON.stringify(req.body))
        console.log("headers")
        console.log(JSON.stringify(req.headers))
        let resp = await patchCharger(req.body , {'userid' : userId , 'clientname' : "EVIO" , 'ownerid' : cpoUserId})
        if (resp.success) {
            updateChargerToLocationsQueue(cpoUserId , foundCharger , req.body)
            return res.status(200).send(resp.data)
        } else {
            return res.status(400).send({ auth: false, code: resp.code, message: resp.error })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

async function patchCharger(data , headers ) {
    const context = "Function patchCharger";
    let response = {success : true , data : {} , error : "" , code : ""}
    try {
        let host = process.env.HostChargers + process.env.PathUpdateCharger
        let resp = await axios.patch(host, data, {headers})
        if (resp.data) {
            return {...response , data : resp.data}
        } else {
            return { ...response , success : false, error: 'Charger not updated' }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        if (error.response) {
            if (error.response.data) {
                return { ...response , success : false, error: error.response.data.message , code : error.response.data.code}
            }
            return { ...response , success : false, error: error.message }
        }
        return { ...response , success : false, error: error.message }
    }
}

function validateUpdateChargerFields(charger , isAdmin) {
    const context = "Function validateUpdateChargerFields"
    try {
        let validFields = [
            "chargerId",
            "userId",
            "hasInfrastructure",
            "infrastructureId",
            "hwId",
            "name",
            "address",
            "geometry",
            "CPE",
            "instantBooking",
            "allowRFID",
            "requireConfirmation",
            "parkingType",
            "vehiclesType",
            "defaultImage",
            "imageContent",
            "infoPoints",
            "internalInfo",
            "offlineNotification",
            "offlineEmailNotification",
            "chargingDistance",
            "ownerId",
            "locationType",
            "energyOwner",
            "CSE",
            "voltageLevel",
            "energyNotes",
            "supplyDate",
            "installationDate",
            "goLiveDate",
            "warranty",
            "expiration",
            "preCheck",
            "generateAction",
            "acquisitionNotes",
            "expectedLife",
            "MTBF",
            "lifeCycleStatus",
            "notify",
            "lifeCycleNotes",
            "siteLicense",
            "legalLicenseDate",
            "legalLicenseExpiry",
            "legalSiteReminder",
            "legalSiteNotes",
            "inspection",
            "legalInspectionReminder",
            "legalInspectionNotes",
        ]
        if (!charger) {
            return { auth: false, code: 'server_charger_required', message: 'Charger data is required' }
        } else if (isAdmin && !charger.ownerId) {
            return { auth: false, code: 'server_ownerId_required', message: 'ownerId is required' }
        } else if (!charger.chargerId) {
            return { auth: false, code: 'server_chargerId_required', message: 'chargerId is required' }
        } else if (!charger.hwId) {
            return { auth: false, code: 'server_hwid_required', message: 'Charger Hardware Id is required' }
        } else if (!charger.defaultImage) {
            return { auth: false, code: 'server_defaultImage_required', message: 'defaultImage is required' }
        } else {
            let notAllowedKey = Object.keys(charger).find(key => !validFields.includes(key))
            if (notAllowedKey) {
                return { auth: false, code: `server_${notAllowedKey}_invalid`, message: `${notAllowedKey} can't be updated` }
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { auth: false, code: '', message: error.message}
    }
};

async function removeCharger(req,res) {
    const context = "DELETE /api/private/controlcenter/charger - Function removeCharger"
    try {
        if (validateDeleteteChargerFields(req.body,req.headers['isadmin'])) return res.status(400).send(validateDeleteteChargerFields(req.body,req.headers['isadmin']))
        let cpoUserId = req.headers['isadmin'] ? req.body.ownerId : req.headers['userid']
        let foundCharger = await Utils.findChargerById(req.body.chargerId)
        let resp = await deleteCharger(req.body)
        if (resp.success) {
            deleteChargerToLocationsQueue(cpoUserId , foundCharger , req.body)
            return res.status(200).send(resp.data)
        } else {
            return res.status(400).send({ auth: false, code: resp.code, message: resp.error })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

async function deleteCharger(data) {
    const context = "Function patchCharger";
    let response = {success : true , data : {} , error : "" , code : ""}
    try {
        let host = process.env.HostChargers + process.env.PathDeleteCharger
        let resp = await axios.delete(host, {data})
        if (resp.data) {
            return {...response , data : resp.data}
        } else {
            return { ...response , success : false, error: 'Charger not deleted' }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        if (error.response) {
            if (error.response.data) {
                return { ...response , success : false, error: error.response.data.message , code : error.response.data.code}
            }
            return { ...response , success : false, error: error.message }
        }
        return { ...response , success : false, error: error.message }
    }
}

function validateDeleteteChargerFields(charger , isAdmin) {
    const context = "Function validateDeleteteChargerFields"
    try {
        let validFields = [
            "chargerId",
            "ownerId"
        ]
        if (!charger) {
            return { auth: false, code: 'server_charger_required', message: 'Charger data is required' }
        } else if (!charger.chargerId) {
            return { auth: false, code: 'server_chargerId_required', message: 'chargerId is required' }
        } else if (isAdmin && !charger.ownerId) {
            return { auth: false, code: 'server_ownerId_required', message: 'ownerId is required' }
        } else {
            let notAllowedKey = Object.keys(charger).find(key => !validFields.includes(key))
            if (notAllowedKey) {
                return { auth: false, code: `server_${notAllowedKey}_invalid`, message: `${notAllowedKey} can't be updated` }
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { auth: false, code: '', message: error.message}
    }
};

async function getChargerNetworks(req,res) {
    const context = "GET /api/private/controlcenter/chargerNetworks - Function getChargerNetworks"
    try {
        if (validateChargerNetworksFields(req.query)) return res.status(400).send(validateChargerNetworksFields(req.query))
        let cpoUserId = req.headers['userid']
        let ownerId = req.query.ownerId
        let userId = req.query.userId
        let userClientsListArray = await getUserClientsList(cpoUserId , req.headers['isadmin'] , ownerId , userId)
        getUserChargerNetworks(userClientsListArray , res) 
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

function validateChargerNetworksFields(charger) {
    const context = "Function validateChargerNetworksFields"
    try {
        let validFields = [
            "userId",
            "ownerId",
        ]
        if (!charger) {
            return { auth: false, code: 'server_charger_required', message: 'Charger data is required' }
        } else if (!charger.userId) {
            return { auth: false, code: 'server_userId_required', message: 'userId is required' }
        } else {
            let notAllowedKey = Object.keys(charger).find(key => !validFields.includes(key))
            if (notAllowedKey) {
                return { auth: false, code: `server_${notAllowedKey}_invalid`, message: `${notAllowedKey} can't be updated` }
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { auth: false, code: '', message: error.message}
    }
};

async function getUserChargerNetworks(userClientsListArray  , res) {
    const context = "Function getUserChargers";
    try {
        let host = process.env.HostUser + process.env.PathGetControlCenterClientsChargers
        let data = {
            _id : {$in : userClientsListArray.map(user => user.clientsList).flat(1)},
            active : true,
        }
        let resp = await axios.get(host, {data})
        if (resp.data) {

            let userChargerInfo = {}
            await Promise.all(resp.data.map(async (client ) => { 
                let cpoObject = getCpoObject(userClientsListArray , client)
                let infrastructures = await getInfrastructureInfo(client.userId)
                let chargers = []
                for (let infrastructure of infrastructures) {
                    for (let charger of infrastructure.listChargers) {
                        chargers.push({
                            infrastructureId : infrastructure.infrastructureId,
                            infrastructureName : infrastructure.name,
                            infrastructureImageContent : infrastructure.imageContent,
                            chargerId : charger.chargerId,
                            chargerName : charger.name,
                            chargerHwId : charger.hwId,
                            chargerNetworks : charger.networks,
                            // ownerId,
                            // userId : client.userId,
                        })
                    }
                }
                userChargerInfo = {
                    ownerId : cpoObject._id,
                    ownerName : cpoObject.owner,
                    userId : client.userId,
                    userName : client.name,
                    chargers
                }
                
            }))
            
            return res.status(200).send(userChargerInfo);
        } else {
            return res.status(200).send([]);
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

async function updateChargerToLocationsQueue(cpoUserId , foundCharger , requestBody) {
    const context = "Function updateChargerToLocationsQueue";
    try {
        let foundUser = await Utils.findUserById(cpoUserId)
        let newCharger = await Utils.findChargerById(requestBody.chargerId)
        // let cpoCountryCode = Utils.getCountryCodeWithCountry(foundUser.country)
        await Promise.all(foundUser.cpoDetails.map(async (details) => {
            if (details.certified && details.handshake) {
                let network = details.network 
                let partyId = details.party_id.toUpperCase()
                let active = newCharger.networks.find(details => details.network === network).activationRequest
                if (active && foundCharger.accessType === process.env.ChargerAccessPublic) {
                    let platform = await Utils.findOnePlatform({cpo : partyId , platformCode : network})
                    let cpoCountryCode = platform.cpoRoles.find( roleObj => roleObj.role === process.env.cpoRole).country_code
                    let locationObj = await Utils.transformLocationObject(network , newCharger , cpoCountryCode , partyId , platform , active , "")
                    Utils.addToLocationQueue(locationObj , process.env.ChargerUpdateCommand ,network , cpoCountryCode , partyId , cpoUserId , newCharger._id , platform._id , process.env.IntegrationStatusOpen , foundCharger , requestBody , undefined , undefined)
                } else {
                    console.log(`[${context}]`, `${details.network} not active`);
                }   
            } else {
                console.log(`[${context}]`, `${details.network} not certified`);
            }
        }))
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

async function deleteChargerToLocationsQueue(cpoUserId , foundCharger , requestBody) {
    const context = "Function deleteChargerToLocationsQueue";
    try {
        let foundUser = await Utils.findUserById(cpoUserId)
        // let cpoCountryCode = Utils.getCountryCodeWithCountry(foundUser.country)
        await Promise.all(foundUser.cpoDetails.map(async (details) => {
            if (details.certified && details.handshake) {
                let network = details.network 
                let partyId = details.party_id.toUpperCase()
                let active = foundCharger.networks.find(details => details.network === network).activationRequest
                if (active && foundCharger.accessType === process.env.ChargerAccessPublic) {
                    let platform = await Utils.findOnePlatform({cpo : partyId , platformCode : network})
                    let cpoCountryCode = platform.cpoRoles.find( roleObj => roleObj.role === process.env.cpoRole).country_code
                    let locationObj = await Utils.transformLocationObject(network , foundCharger , cpoCountryCode , partyId , platform , active , process.env.evseStatusRemoved)
                    addRemovedEvsesToQueue(locationObj , process.env.ChargerRemoveCommand , network , cpoCountryCode , partyId , cpoUserId , foundCharger._id , platform._id , process.env.IntegrationStatusOpen , foundCharger , requestBody)
                } else {
                    console.log(`[${context}]`, `${details.network} not active`);
                }   
            } else {
                console.log(`[${context}]`, `${details.network} not certified`);
            }
        }))
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

async function addRemovedEvsesToQueue(charger , command , network , country_code , party_id , operatorId , chargerId , platformId , status , evioChargerBeforeChanges , requestBody) {
    const context = "Function addRemovedEvsesToQueue";
    try {
        for (let evse of charger.evses) {
            Utils.addToLocationQueue(charger , command , network , country_code , party_id , operatorId , chargerId , platformId , status , evioChargerBeforeChanges , requestBody , evse , undefined)
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

async function sendLocationsToOcpi() {
    const context = "Function sendLocationsToOcpi"
    try {
        let query = {
            $or : [
                { "integrationStatus.status" : process.env.IntegrationStatusOpen },
                {
                    $and : [
                        { "integrationStatus.status" : process.env.IntegrationStatusFailed },
                        { "integrationStatus.failedCount" : { $lt : 3} },
                    ]
                }
            ]
        }
        let locationsToSend = await LocationsQueue.find(query).lean()
        for (let location of locationsToSend) {
            sendLocation(location)
        }   
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

async function sendLocation(location) {
    const context = "Function sendLocation"
    try {
        let platform = await Utils.findOnePlatform({_id : location.platformId})
        let platformDetails = platform.platformDetails.find(details => details.version === platform.cpoActiveCredentialsToken[0].version)
        let locationsEndpoint = Utils.getPlatformSenderEndpoint(location.network , platformDetails , process.env.moduleLocations , process.env.roleReceiver)
        if (location.command === process.env.NetworkActivationCommand  || location.command === process.env.NetworkInactivationCommand || location.command === process.env.ChargerUpdateCommand ) {
            locationsEndpoint = locationsEndpoint + `/${location.country_code}/${location.party_id}/${location.charger.id}`
            await putLocation(locationsEndpoint , location , platform , location.charger)
        } else if (location.command === process.env.ChargerRemoveCommand || location.command === process.env.ChargerUpdateEvseStatus) {
            locationsEndpoint = locationsEndpoint + `/${location.country_code}/${location.party_id}/${location.charger.id}/${location.evse.uid}`
            let data = updatedEvseData(location)
            await patchEvse(locationsEndpoint , location , platform , data)
        } else if (location.command === process.env.ChargerUpdateLocation) {
            locationsEndpoint = locationsEndpoint + `/${location.country_code}/${location.party_id}/${location.charger.id}`
            await patchEvse(locationsEndpoint , location , platform , { last_updated : location.charger.last_updated })
        } else if (location.command === process.env.ChargerUpdateTariffIdCommand) {
            locationsEndpoint = locationsEndpoint + `/${location.country_code}/${location.party_id}/${location.charger.id}/${location.evse.uid}/${location.connector.id}`
            let data = updatedTariffId(location)
            await patchEvse(locationsEndpoint , location , platform , data)
        }
    } catch (error) {
        // Error handling
        console.error(`[${context}] Error `, error.message);
        let responseData = error
        let responseMessage = error.message
        if (error.response) {
            if (error.response.data) {
                responseData = error.response.data
                responseMessage = error.response.data.message
            }
        }
        let newValues = {
            'integrationStatus.failedCount' : ++location.integrationStatus.failedCount,
            'integrationStatus.status' : process.env.IntegrationStatusFailed,
            'integrationStatus.response' : JSON.stringify(responseData),
            'integrationStatus.errorDescription' : responseMessage,
        }
        await LocationsQueue.updateOne({_id : location._id} , {$set : newValues})
    }
}

function getHttpMethod(charger , command , network) {
    const context = "Function getHttpMethod"
    try {
        if (command === process.env.NetworkStatusUpdateCommand) {
            return charger.networks.find(networkObj => networkObj.network === network).id ? "PATCH" : "PUT"
        } else if (command === process.env.ChargerUpdateCommand) {
            return "PUT"
        } else if (command === process.env.ChargerRemoveCommand) {
            return "PATCH"
        } else {
            return "PUT"
        }   
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return "PUT"
    }
}

function updatedEvseData(location) {
    const context = "Function updatedEvseData"
    try {
        if (location.network === process.env.MobiePlatformCode) {
            return {
                status : location.evse.status,
                last_updated : location.command === process.env.ChargerRemoveCommand ? new Date().toISOString() : location.evse.last_updated
            }
        } else if (location.network === process.env.GirevePlatformCode) {
            return {
                status : location.evse.status,
            }
        } else {
            return {}
        }  
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return {}
    }
}

function updatedTariffId(location) {
    const context = "Function updatedTariffId"
    try {
        if (location.network === process.env.MobiePlatformCode) {
            return {
                tariff_ids : location.connector.tariff_ids,
                last_updated : location.command === process.env.ChargerRemoveCommand ? new Date().toISOString() : location.connector.last_updated
            }
        } else if (location.network === process.env.GirevePlatformCode) {
            return {
                tariff_id : location.connector.tariff_id,
            }
        } else {
            return {}
        }  
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return {}
    }
}

async function putRequest(host,data,headers) {
    const context = "Function putRequest";
    let response = {success : true , data : {} , error : "" , code : ""}
    try {
        let resp = await axios.put(host, data , {headers})
        if (resp.data) {
            return {...response , data : resp.data , status : Utils.getHttpStatus(resp)}
        } else {
            return { ...response , success : false, error: 'Not updated' , status : Utils.getHttpStatus(resp) }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        if (error.response) {
            if (error.response.data) {
                return { ...response , success : false, error: error.response.data.message , code : error.response.data.code , status : Utils.getHttpStatus(error.response) , data : error.response.data}
            }
            return { ...response , success : false, error: error.message , status : Utils.getHttpStatus(error.response)}
        }
        return { ...response , success : false, error: error.message , status : Utils.getHttpStatus(error.response)}
    }
}

async function patchRequest(host,data,headers) {
    const context = "Function patchRequest";
    let response = {success : true , data : {} , error : "" , code : ""}
    try {
        let resp = await axios.patch(host, data , {headers})
        if (resp.data) {
            return {...response , data : resp.data , status : Utils.getHttpStatus(resp)}
        } else {
            return { ...response , success : false, error: 'Not updated' , status : Utils.getHttpStatus(resp) }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        if (error.response) {
            if (error.response.data) {
                return { ...response , success : false, error: error.response.data.message , code : error.response.data.code , status : Utils.getHttpStatus(error.response) , data : error.response.data }
            }
            return { ...response , success : false, error: error.message , status : Utils.getHttpStatus(error.response)}
        }
        return { ...response , success : false, error: error.message , status : Utils.getHttpStatus(error.response)}
    }
}

async function networkActivationQueue(foundUser ,foundCharger ,activationRequest , network , command , ownerId , requestBody) {
    const context = "Function networkActivationQueue";
    try {
        // let cpoCountryCode = Utils.getCountryCodeWithCountry(foundUser.country)
        let partyId = foundUser.cpoDetails.find(details => details.network === network).party_id.toUpperCase()
        let platform = await Utils.findOnePlatform({cpo : partyId , platformCode : network})
        let cpoCountryCode = platform.cpoRoles.find( roleObj => roleObj.role === process.env.cpoRole).country_code
        let locationObj = await Utils.transformLocationObject(network , foundCharger , cpoCountryCode , partyId , platform , activationRequest)
        let pendingStatus = activationRequest ? process.env.NetworkInactivationCommand : process.env.NetworkActivationCommand

        let pendingEntry = await LocationsQueue.find({chargerId : foundCharger._id, command : pendingStatus , 'integrationStatus.status' : process.env.IntegrationStatusOpen})
        if (pendingEntry.length > 0) {
            await LocationsQueue.updateMany({_id : {$in : pendingEntry.map(entry => entry._id)}} , {$set : {'integrationStatus.status' : process.env.IntegrationStatusCanceledByUser}})
            Utils.addToLocationQueue(locationObj , command ,network , cpoCountryCode , partyId , ownerId , foundCharger._id , platform._id , process.env.IntegrationStatusClosed , foundCharger , requestBody , undefined , undefined)
            let status = command === process.env.NetworkActivationCommand ? process.env.ChargerNetworkStatusActive : process.env.ChargerNetworkStatusInactive
            patchChargerNetwork({ status, ownerId , network , chargerId : foundCharger._id , party_id : partyId , country_code : cpoCountryCode})
        } else {
            Utils.addToLocationQueue(locationObj , command ,network , cpoCountryCode , partyId , ownerId , foundCharger._id , platform._id , process.env.IntegrationStatusOpen , foundCharger , requestBody , undefined , undefined)
        }

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

function updateNetworkStatus(location , success) {
    const context = "Function updateNetworkStatus";
    try {
        if (location.command === process.env.NetworkActivationCommand || location.command === process.env.NetworkInactivationCommand) {
            if (success) {
                let status = location.command === process.env.NetworkActivationCommand ? process.env.ChargerNetworkStatusActive : process.env.ChargerNetworkStatusInactive
                patchChargerNetwork({ status, ownerId : location.operatorId , network : location.network , chargerId : location.chargerId , party_id : location.party_id , country_code : location.country_code})
            } else {
                let status = location.command === process.env.NetworkActivationCommand ? process.env.ChargerNetworkStatusFailedIntegration : process.env.ChargerNetworkStatusFailedCancelingIntegration
                patchChargerNetwork({ status, ownerId : location.operatorId , network : location.network , chargerId : location.chargerId , party_id : location.party_id , country_code : location.country_code})
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

async function networkActivationEVIO(activationRequest , ownerId , network , chargers , res) {
    const context = "Function networkActivationEVIO";
    try {
        let status = activationRequest ? process.env.ChargerNetworkStatusActive : process.env.ChargerNetworkStatusInactive
        let chargerIds = chargers.map(charger => charger.chargerId)
        let host = process.env.HostChargers + process.env.PathManyNetworkActivation
        let resp = await Utils.patchRequest(host , { activationRequest , status, ownerId , network , chargerIds})
        if (resp.success) {
            if (resp.data.ok) {
                return res.status(200).send({ auth: true, code: '', message: 'Network change requested!' })
            } else {
                return res.status(500).send({ auth: true, code: '', message: 'Failed to update networks activation!' })
            }
        } else {
            console.log("Failed to update all networks")
            return res.status(500).send({ auth: true, code: '', message: 'Failed to update networks activation!' })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send({ auth: true, code: '', message: 'Failed to update networks activation!' })
    }
}

async function networkActivationOCPI(activationRequest , ownerId , network ,  foundUser , chargers , requestBody , res) {
    const context = "Function networkActivationOCPI";
    try {
        let status = activationRequest ? process.env.ChargerNetworkStatusToActivate : process.env.ChargerNetworkStatusToInactivate
        let command = activationRequest ? process.env.NetworkActivationCommand : process.env.NetworkInactivationCommand
        let chargerIds = chargers.map(charger => charger.chargerId)
        let host = process.env.HostChargers + process.env.PathManyNetworkActivation
        let resp = await Utils.patchRequest(host , { activationRequest , status, ownerId , network , chargerIds})
        if (resp.success) {
            if (resp.data.ok) {
                if (resp.data.nModified) {
                    sendManyActivationNetworkToQueue(chargers ,foundUser , activationRequest , network , command , ownerId ,requestBody )
                }
                return res.status(200).send({ auth: true, code: '', message: 'Network change requested!' })
            } else {
                console.log("Failed to update all networks")
                return res.status(500).send({ auth: true, code: '', message: 'Failed to update networks activation!' })
            }
        } else {
            console.log("Failed to update all networks")
            return res.status(500).send({ auth: true, code: '', message: 'Failed to update networks activation!' })
        }
        // for (let charger of chargers) {
        //     let chargerId = charger.chargerId
        //     let foundCharger = await Utils.findChargerById(chargerId)
        //     if (foundCharger && foundCharger.plugs.length > 0) {
        //         let currentRequest = foundCharger.networks.find(details => details.network === network).activationRequest
        //         if (currentRequest !== activationRequest) {
        //             let resp = await patchChargerNetwork({ activationRequest , status, ownerId , network , chargerId})
        //             if (resp.success) {
        //                 //Add entry in locationsQueue
        //                 networkActivationQueue(foundUser ,foundCharger , activationRequest , network , command , ownerId ,requestBody )
        //             } else {
        //                 console.log(`[${context}] Error `, resp.error)
        //             }
        //         } else {
        //             console.log(`[${context}] Error `, `activationRequest is already ${activationRequest}` )
        //         }
        //     } else {
        //         console.log(`[${context}] Error `, `Charger ${charger.hwId} not valid to activate network`)
        //     }
        // }       
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send({ auth: true, code: '', message: 'Failed to update networks activation!' })
    }
}

async function sendManyActivationNetworkToQueue(chargers ,foundUser , activationRequest , network , command , ownerId ,requestBody ) {
    const context = "Function sendManyActivationNetworkToQueue";
    try {
        for (let charger of chargers) {
            let chargerId = charger.chargerId
            let foundCharger = await Utils.findChargerById(chargerId)
            if (foundCharger && foundCharger.plugs.length > 0) {
                //Add entry in locationsQueue
                networkActivationQueue(foundUser ,foundCharger , activationRequest , network , command , ownerId ,requestBody )
            } else {
                console.log(`[${context}] Error `, `Charger ${foundCharger.hwId} not valid to activate network`)
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

async function forceJobProcess(req,res) {
    const context = "Function forceJobProcess";
    try {
        sendLocationsToOcpi()
        return res.status(200).send({ auth: true, code: '', message: 'Process running!' })
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send({ auth: true, code: '', message: error.message })
    }
}

async function updateChargerPlugs(req,res) {
    const context = "PATCH /api/private/controlcenter/charger/plugs - Function updateChargerPlugs"
    try {
        if (validateUpdateChargerPlugsFields(req.body , req.headers['isadmin'])) return res.status(400).send(validateUpdateChargerPlugsFields(req.body , req.headers['isadmin']))
        let cpoUserId = req.headers['isadmin'] ? req.body.ownerId : req.headers['userid']
        let foundCharger = await Utils.findChargerById(req.body.chargerId)
        let resp = await patchChargerPlugs(req.body)
        if (resp.success) {
            updateChargerToLocationsQueue(cpoUserId , foundCharger , req.body)
            return res.status(200).send(resp.data)
        } else {
            return res.status(400).send({ auth: false, code: resp.code, message: resp.error })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

function validateUpdateChargerPlugsFields(charger , isAdmin) {
    const context = "Function validateUpdateChargerPlugsFields"
    try {
        let validFields = [
            "chargerId",
            "plugId",
            "connectorType",
            "amperage",
            "voltage",
            "power",
            "active",
            "ownerId",
            // "lastUsed",
            "internalRef",
            "connectorFormat",
            "powerType",
        ]
        if (!charger) {
            return { auth: false, code: 'server_charger_required', message: 'Charger data is required' }
        } else if (isAdmin && !charger.ownerId) {
            return { auth: false, code: 'server_ownerId_required', message: 'ownerId is required' }
        } else if (!charger.chargerId) {
            return { auth: false, code: 'server_chargerId_required', message: 'chargerId is required' }
        } else if (!charger.plugId) {
            return { auth: false, code: "server_plug_id_required", message: 'Plug ID required' }
        } else if (!charger.connectorType) {
            return { auth: false, code: 'server_connectorType_required', message: 'connectorType is required' }
        } else if (!charger.amperage) {
            return { auth: false, code: 'server_amperage_required', message: 'amperage is required' }
        } else if (!charger.voltage) {
            return { auth: false, code: 'server_voltage_required', message: 'voltage is required' }
        } else if (!charger.power) {
            return { auth: false, code: 'server_power_required', message: 'power is required' }
        } else if (charger.active === null || charger.active === undefined) {
            return { auth: false, code: 'server_active_required', message: 'active is required' }
        } else if (!charger.internalRef) {
            return { auth: false, code: 'server_internalRef_required', message: 'internalRef is required' }
        } else if (!charger.connectorFormat) {
            return { auth: false, code: 'server_connectorFormat_required', message: 'connectorFormat is required' }
        } else if (!charger.powerType) {
            return { auth: false, code: 'server_powerType_required', message: 'powerType is required' }
        } else {
            let notAllowedKey = Object.keys(charger).find(key => !validFields.includes(key))
            if (notAllowedKey) {
                return { auth: false, code: `server_${notAllowedKey}_invalid`, message: `${notAllowedKey} can't be updated` }
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { auth: false, code: '', message: error.message}
    }
};

async function patchChargerPlugs(data) {
    const context = "Function patchChargerPlugs";
    let response = {success : true , data : {} , error : "" , code : ""}
    try {
        let host = process.env.HostChargers + process.env.PathUpdateChargerPlugs
        let resp = await axios.patch(host, data)
        if (resp.data) {
            return {...response , data : resp.data}
        } else {
            return { ...response , success : false, error: 'Charger plugs not updated' }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        if (error.response) {
            if (error.response.data) {
                return { ...response , success : false, error: error.response.data.message , code : error.response.data.code}
            }
            return { ...response , success : false, error: error.message }
        }
        return { ...response , success : false, error: error.message }
    }
}

async function networkChargerTariffs(req,res) {
    const context = "GET /api/private/controlcenter/charger/tariffs - Function networkChargerTariffs"
    try {
        if (validateChargerNetworksTariffsFields(req.query,req.headers['isadmin'])) return res.status(400).send(validateChargerNetworksTariffsFields(req.query,req.headers['isadmin']))
        let ownerId = req.query.ownerId
        let cpoUserId = req.headers['isadmin'] ? ownerId : req.headers['userid']
        let foundUser = await Utils.findUserById(cpoUserId)
        let foundCharger = await Utils.findChargerById(req.query.chargerId)
        if (foundUser) {
            if (foundCharger) {
                let data = await Promise.all(foundCharger.networks.map(async network => await getChargerTariffs(foundCharger , foundUser , network)))
                return res.status(200).send(data);
            } else {
                return res.status(400).send({ auth: false, code: '', message: 'Charger does not exist' })
            }
        } else {
            return res.status(400).send({ auth: false, code: '', message: 'User does not exist' })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

function validateChargerNetworksTariffsFields(query , isAdmin) {
    const context = "Function validateChargerNetworksTariffsFields"
    try {
        if (!query) {
            return { auth: false, code: 'server_query_required', message: 'query data is required' }
        } else if (!query.chargerId) {
            return { auth: false, code: 'server_chargerId_required', message: 'chargerId is required' }
        } else if (isAdmin && !query.ownerId) {
            return { auth: false, code: 'server_ownerId_required', message: 'ownerId is required' }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { auth: false, code: '', message: error.message}
    }
};

async function getChargerTariffs(foundCharger , foundUser , networkObj) {
    const context = "Function getChargerTariffs"

    try {
        let network = networkObj.network
        let activationRequest = networkObj.activationRequest
        let certified = foundUser.cpoDetails.find(details => (details.network === network && details.certified && details.handshake))

        if (certified && activationRequest) {
            let tariffs = await getCpoTariffs(foundCharger , network)
            return { network, certified : certified.certified , activationRequest ,tariffs}
        } else if (network === process.env.NetworkEVIO && activationRequest) {
                let tariffs = await getTariffPlug(foundCharger)
                return { network, certified : true , activationRequest , tariffs }
                // if (charger.listOfGroups.length != 0) {
                //     let response = await getListOfGroups(charger)
                //     return { network, certified , activationRequest , tariffs : response }
                // }
                // else {
                //     return { network, certified , activationRequest , tariffs : charger }
                // }
           
        } else {
            return { network, certified : certified ? certified.certified : false , activationRequest ,tariffs : []}
        }

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { network : networkObj.network, certified : false , activationRequest : false , tariffs : []}
    }
}

async function getCpoTariffs(charger , network) {
    const context = "Function getCpoTariffs"
    try {
        let data = await Promise.all(charger.plugs.map(async plug => await getTariffOPC(plug , network)))
        return data

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return []
    }
}

async function getTariffOPC(plug , network) {
    const context = "Function getTariffOPC"
    try {
        let tariffIdObj = plug.tariffIds.find(tariff => tariff.network === network)
        if (tariffIdObj) {
            if (tariffIdObj.tariffId) {
                let foundTariff = await Tariff.findOne({id : tariffIdObj.tariffId}).lean()
                if (foundTariff) {
                    let response = Utils.tariffResponseBody(foundTariff)
                    return {plugId : plug.plugId , id : foundTariff.id , name : foundTariff.name , tariff : [response.detailedTariff]}
                } else {
                    return {plugId : plug.plugId , id : "", name : "" , tariff : []}
                }
            } else {
                console.log(`[${context}] No tariffId on network ${network}`);
                return {plugId : plug.plugId , id : "", name : "" , tariff : []}
            }
        } else {
            console.log(`[${context}] No tariff object on network ${network}`);
            return {plugId : plug.plugId , id : "", name : "" , tariff : []}
        }


    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return {plugId : plug.plugId , id : "", name : "" , tariff : []}
    }

};


function getTariffPlug(chargerFound) {
    var context = "Funciton getTariffPlug";
    return new Promise((resolve, reject) => {
        chargerFound = JSON.parse(JSON.stringify(chargerFound));
        const getTariffPlug = (plug) => {
            return new Promise((resolve, reject) => {
                if (plug.tariff.length != 0) {
                    Promise.all(
                        plug.tariff.map(tariff => {
                            return new Promise((resolve, reject) => {
                                if ((tariff.tariffId == undefined) || (tariff.tariffId == "")) {
                                    if ((tariff.groupName == process.env.ChargerAccessPublic) || (tariff.groupName == process.env.ChargerAccessPrivate) || (tariff.groupName == process.env.ChargerAccessFreeCharge)) {
                                        resolve(true);
                                    }
                                    else {
                                        const query = {
                                            _id: tariff.groupId
                                        };
                                        findOneGroupCSUser(query)
                                            .then((groupCSUsers) => {
                                                if (groupCSUsers?.imageContent)
                                                    tariff.imageContent = groupCSUsers.imageContent;
                                                resolve(true);
                                            })
                                            .catch((error) => {
                                                console.error(`[${context}][axios.get] Error `, error.message);
                                                reject(error);
                                            });
                                    };
                                }
                                else {
                                    if (tariff.groupName == process.env.ChargerAccessPrivate || tariff.groupName == process.env.ChargerAccessFreeCharge) {
                                        resolve(true);
                                    }
                                    else if (tariff.groupName == process.env.ChargerAccessPublic) {

                                        var host = process.env.HostTariffs + process.env.PathGetTariff;
                                        var data = {
                                            _id: tariff.tariffId
                                        };
                                        axios.get(host, { data })
                                            .then((value) => {
                                                var tariffFound = JSON.parse(JSON.stringify(value.data));
                                                tariff.name = tariffFound.name;
                                                tariff.tariffType = tariffFound.tariffType;
                                                tariff.tariff = tariffFound.tariff;
                                                resolve(true);
                                            })
                                            .catch((error) => {
                                                console.error(`[${context}][axios.get] Error `, error.message);
                                                reject(error);
                                            });
                                    }
                                    else {
                                        if (tariff.groupId) {
                                            const query = {
                                                _id: tariff.groupId
                                            };
                                            findOneGroupCSUser(query)
                                                .then((groupCSUsers) => {
                                                    if (groupCSUsers?.imageContent)
                                                        tariff.imageContent = groupCSUsers.imageContent;
                                                    var host = process.env.HostTariffs + process.env.PathGetTariff;
                                                    var data = {
                                                        _id: tariff.tariffId
                                                    };
                                                    axios.get(host, { data })
                                                        .then((value) => {
                                                            var tariffFound = JSON.parse(JSON.stringify(value.data));
                                                            tariff.name = tariffFound.name;
                                                            tariff.tariffType = tariffFound.tariffType;
                                                            tariff.tariff = tariffFound.tariff;
                                                            resolve(true);
                                                        })
                                                        .catch((error) => {
                                                            console.error(`[${context}][axios.get] Error `, error.message);
                                                            reject(error);
                                                        });
                                                })
                                                .catch((error) => {
                                                    console.error(`[${context}][axios.get] Error `, error.message);
                                                    reject(error);
                                                });
                                        } else if (tariff.fleetId) {

                                            var host = process.env.HostEvs + process.env.PathFleetById;
                                            var params = {
                                                _id: tariff.fleetId
                                            };
                                            axios.get(host, { params })
                                                .then((value) => {
                                                    var fleet = JSON.parse(JSON.stringify(value.data));
                                                    tariff.imageContent = fleet.imageContent;
                                                    var host = process.env.HostTariffs + process.env.PathGetTariff;
                                                    var data = {
                                                        _id: tariff.tariffId
                                                    };
                                                    axios.get(host, { data })
                                                        .then((value) => {
                                                            var tariffFound = JSON.parse(JSON.stringify(value.data));
                                                            tariff.name = tariffFound.name;
                                                            tariff.tariffType = tariffFound.tariffType;
                                                            tariff.tariff = tariffFound.tariff;
                                                            resolve(true);
                                                        })
                                                        .catch((error) => {
                                                            console.error(`[${context}][axios.get] Error `, error.message);
                                                            reject(error);
                                                        });
                                                })
                                                .catch((error) => {
                                                    console.error(`[${context}][axios.get] Error `, error.message);
                                                    reject(error);
                                                });
                                        } else {
                                            var host = process.env.HostTariffs + process.env.PathGetTariff;
                                            var data = {
                                                _id: tariff.tariffId
                                            };
                                            axios.get(host, { data })
                                                .then((value) => {
                                                    var tariffFound = JSON.parse(JSON.stringify(value.data));
                                                    tariff.name = tariffFound.name;
                                                    tariff.tariffType = tariffFound.tariffType;
                                                    tariff.tariff = tariffFound.tariff;
                                                    resolve(true);
                                                })
                                                .catch((error) => {
                                                    console.error(`[${context}][axios.get] Error `, error.message);
                                                    reject(error);
                                                });
                                        }
                                    };
                                };
                            });
                        })
                    ).then(() => {
                        resolve(true);
                    }).catch((error) => {
                        console.error(`[${context}] Promise.all] Error `, error.message);
                        reject(error);
                    })
                }
                else {
                    resolve(true);
                };
            });
        };
        Promise.all(
            chargerFound.plugs.map(plug => getTariffPlug(plug))
        ).then((result) => {
            resolve(chargerFound.plugs.map(plug => { return {plugId : plug.plugId , tariff : plug.tariff} } ));
        }).catch((error) => {
            console.error(`[${context}] Promise.all] Error `, error.message);
            reject(error);
        });
    });
};

async function getChargerPlugs(req,res) {
    const context = "GET /api/private/controlcenter/charger/plugs - Function getChargerPlugs"
    try {
        if (validateGetChargerPlugsFields(req.query)) return res.status(400).send(validateGetChargerPlugsFields(req.query))
        let host = process.env.HostChargers + process.env.PathGetChargerPlugs
        let resp = await Utils.getRequest(host , req.query)
        if (resp.success) {
            return res.status(200).send(resp.data)
        } else {
            return res.status(400).send({ auth: false, code: resp.code, message: resp.error })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

function validateGetChargerPlugsFields(charger) {
    const context = "Function validateGetChargerPlugsFields"
    try {
        let validFields = [
            "chargerId",
        ]
        if (!charger) {
            return { auth: false, code: 'server_charger_required', message: 'Charger data is required' }
        } else if (!charger.chargerId) {
            return { auth: false, code: 'server_chargerId_required', message: 'chargerId is required' }
        } else {
            let notAllowedKey = Object.keys(charger).find(key => !validFields.includes(key))
            if (notAllowedKey) {
                return { auth: false, code: `server_${notAllowedKey}_invalid`, message: `${notAllowedKey} can't be fetched` }
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { auth: false, code: '', message: error.message}
    }
};

async function patchEvse(locationsEndpoint , location , platform , data) {
    const context = "Function patchEvse"
    try {
        let resp = await patchRequest(locationsEndpoint,data,{ 'Authorization': `Token ${platform.platformActiveCredentialsToken[0].token}` })
        if (resp.success) {
            let result = resp.data
            if (result.status_code) {
                if ((Math.round(result.status_code / 1000)) == 1) {
                    // Update integration Status and dependencies
                    let newValues = {
                        'integrationStatus.status' : process.env.IntegrationStatusClosed,
                        'integrationStatus.response' : JSON.stringify(result),
                        endpoint : locationsEndpoint,
                        data : data,
                        token : platform.platformActiveCredentialsToken[0].token,
                        requestType : "PATCH",
                        httpStatus : resp.status
                    }
                    await LocationsQueue.updateOne({_id : location._id} , {$set : newValues})
                    Utils.saveLog(newValues.requestType , data , result , locationsEndpoint , newValues.token , platform.platformCode , platform.platformName , newValues.httpStatus , process.env.triggerCPO , process.env.moduleLocations , platform.cpo)
                } else {
                    console.log('Unable to use the client’s API Details', result);
                    // Error handling
                    let message = 'Unable to use the client’s API Details'
                    if (result.data) {
                        if (result.data.message) {
                            if (result.data.message.length > 0) {
                                if (result.data.message[0].text) {
                                    message = result.data.message[0].text
                                }
                            }   
                        }
                    }
                    let newValues = {
                        'integrationStatus.failedCount' : ++location.integrationStatus.failedCount,
                        'integrationStatus.status' : process.env.IntegrationStatusFailed,
                        'integrationStatus.response' : JSON.stringify(result),
                        'integrationStatus.errorDescription' : message,
                        endpoint : locationsEndpoint,
                        data : data,
                        token : platform.platformActiveCredentialsToken[0].token,
                        requestType : "PATCH",
                        httpStatus : resp.status
                    }
                    await LocationsQueue.updateOne({_id : location._id} , {$set : newValues})
                    Utils.saveLog(newValues.requestType , data , result , locationsEndpoint , newValues.token , platform.platformCode , platform.platformName , newValues.httpStatus , process.env.triggerCPO , process.env.moduleLocations , platform.cpo)
                }
            } else {
                // Error handling
                console.log('Unable to use the client’s API Details. Unable to retrieve status_code', result);
                let message = "Unable to use the client’s API Details. Unable to retrieve status_code"
                if (result.data) {
                    if (result.data.message) {
                        if (result.data.message.length > 0) {
                            if (result.data.message[0].text) {
                                message = result.data.message[0].text
                            }
                        }   
                    }
                }
                let newValues = {
                    'integrationStatus.failedCount' : ++location.integrationStatus.failedCount,
                    'integrationStatus.status' : process.env.IntegrationStatusFailed,
                    'integrationStatus.response' : JSON.stringify(result),
                    'integrationStatus.errorDescription' : message,
                    endpoint : locationsEndpoint,
                    data : data,
                    token : platform.platformActiveCredentialsToken[0].token,
                    requestType : "PATCH",
                    httpStatus : resp.status
                }
                await LocationsQueue.updateOne({_id : location._id} , {$set : newValues})
                Utils.saveLog(newValues.requestType , data , result , locationsEndpoint , newValues.token , platform.platformCode , platform.platformName , newValues.httpStatus , process.env.triggerCPO , process.env.moduleLocations , platform.cpo)

            }
        } else {
            // Error handling
            console.log('Unable to use the client’s API Details.', resp.error);
            let newValues = {
                'integrationStatus.failedCount' : ++location.integrationStatus.failedCount,
                'integrationStatus.status' : process.env.IntegrationStatusFailed,
                'integrationStatus.response' : JSON.stringify(resp.error),
                'integrationStatus.errorDescription' : 'Unable to use the client’s API Details.',
                endpoint : locationsEndpoint,
                data : data,
                token : platform.platformActiveCredentialsToken[0].token,
                requestType : "PATCH",
                httpStatus : resp.status
            }
            await LocationsQueue.updateOne({_id : location._id} , {$set : newValues})
            let responseData = resp.data 
            if (typeof resp.data === 'string' || resp.data instanceof String) {
                responseData = {message : resp.data}
            }
            Utils.saveLog(newValues.requestType , data , responseData , locationsEndpoint , newValues.token , platform.platformCode , platform.platformName , newValues.httpStatus , process.env.triggerCPO , process.env.moduleLocations , platform.cpo)
        }
        
    } catch (error) {
        // Error handling
        console.error(`[${context}] Error `, error.message);
        let responseData = error
        let responseMessage = error.message
        if (error.response) {
            if (error.response.data) {
                responseData = error.response.data
                responseMessage = error.response.data.message
            }
        }
        let newValues = {
            'integrationStatus.failedCount' : ++location.integrationStatus.failedCount,
            'integrationStatus.status' : process.env.IntegrationStatusFailed,
            'integrationStatus.response' : JSON.stringify(responseData),
            'integrationStatus.errorDescription' : responseMessage,
            endpoint : locationsEndpoint,
            data : data,
            token : platform.platformActiveCredentialsToken[0].token,
            requestType : "PATCH",
        }
        await LocationsQueue.updateOne({_id : location._id} , {$set : newValues})
        
    }
}

async function putLocation(locationsEndpoint , location , platform , data) {
    const context = "Function putLocation"
    try {
        let resp = await putRequest(locationsEndpoint,data,{ 'Authorization': `Token ${platform.platformActiveCredentialsToken[0].token}` })
        if (resp.success) {
            let result = resp.data
            if (result.status_code) {
                if ((Math.round(result.status_code / 1000)) == 1) {
                    // Update integration Status and dependencies
                    let newValues = {
                        'integrationStatus.status' : process.env.IntegrationStatusClosed,
                        'integrationStatus.response' : JSON.stringify(result),
                        endpoint : locationsEndpoint,
                        data : data,
                        token : platform.platformActiveCredentialsToken[0].token,
                        requestType : "PUT",
                        httpStatus : resp.status
                    }
                    await LocationsQueue.updateOne({_id : location._id} , {$set : newValues})
                    updateNetworkStatus(location , true)
                    Utils.saveLog(newValues.requestType , data , result , locationsEndpoint , newValues.token , platform.platformCode , platform.platformName , newValues.httpStatus , process.env.triggerCPO , process.env.moduleLocations , platform.cpo)

                } else {
                    console.log('Unable to use the client’s API Details', result);
                    // Error handling
                    let message = 'Unable to use the client’s API Details'
                    if (result.data) {
                        if (result.data.message) {
                            if (result.data.message.length > 0) {
                                if (result.data.message[0].text) {
                                    message = result.data.message[0].text
                                }
                            }   
                        }
                    }
                    let newValues = {
                        'integrationStatus.failedCount' : ++location.integrationStatus.failedCount,
                        'integrationStatus.status' : process.env.IntegrationStatusFailed,
                        'integrationStatus.response' : JSON.stringify(result),
                        'integrationStatus.errorDescription' : message,
                        endpoint : locationsEndpoint,
                        data : data,
                        token : platform.platformActiveCredentialsToken[0].token,
                        requestType : "PUT",
                        httpStatus : resp.status
                    }
                    await LocationsQueue.updateOne({_id : location._id} , {$set : newValues})
                    updateNetworkStatus(location , false)
                    Utils.saveLog(newValues.requestType , data , result , locationsEndpoint , newValues.token , platform.platformCode , platform.platformName , newValues.httpStatus , process.env.triggerCPO , process.env.moduleLocations , platform.cpo)
                }
            } else {
                // Error handling
                console.log('Unable to use the client’s API Details. Unable to retrieve status_code', result);
                let message = "Unable to use the client’s API Details. Unable to retrieve status_code"
                if (result.data) {
                    if (result.data.message) {
                        if (result.data.message.length > 0) {
                            if (result.data.message[0].text) {
                                message = result.data.message[0].text
                            }
                        }   
                    }
                }
                let newValues = {
                    'integrationStatus.failedCount' : ++location.integrationStatus.failedCount,
                    'integrationStatus.status' : process.env.IntegrationStatusFailed,
                    'integrationStatus.response' : JSON.stringify(result),
                    'integrationStatus.errorDescription' : message,
                    endpoint : locationsEndpoint,
                    data : data,
                    token : platform.platformActiveCredentialsToken[0].token,
                    requestType : "PUT",
                    httpStatus : resp.status
                }
                await LocationsQueue.updateOne({_id : location._id} , {$set : newValues})
                updateNetworkStatus(location , false)
                Utils.saveLog(newValues.requestType , data , result , locationsEndpoint , newValues.token , platform.platformCode , platform.platformName , newValues.httpStatus , process.env.triggerCPO , process.env.moduleLocations , platform.cpo)
            }
        } else {
            // Error handling
            console.log('Unable to use the client’s API Details.', resp.error);
            let newValues = {
                'integrationStatus.failedCount' : ++location.integrationStatus.failedCount,
                'integrationStatus.status' : process.env.IntegrationStatusFailed,
                'integrationStatus.response' : JSON.stringify(resp.error),
                'integrationStatus.errorDescription' : 'Unable to use the client’s API Details.',
                endpoint : locationsEndpoint,
                data : data,
                token : platform.platformActiveCredentialsToken[0].token,
                requestType : "PUT",
                httpStatus : resp.status
            }
            await LocationsQueue.updateOne({_id : location._id} , {$set : newValues})
            let responseData = resp.data 
            if (typeof resp.data === 'string' || resp.data instanceof String) {
                responseData = {message : resp.data}
            }
            updateNetworkStatus(location , false)
            Utils.saveLog(newValues.requestType , data , responseData , locationsEndpoint , newValues.token , platform.platformCode , platform.platformName , newValues.httpStatus , process.env.triggerCPO , process.env.moduleLocations , platform.cpo)
        }
        
    } catch (error) {
        // Error handling
        console.error(`[${context}] Error `, error.message);
        let responseData = error
        let responseMessage = error.message
        if (error.response) {
            if (error.response.data) {
                responseData = error.response.data
                responseMessage = error.response.data.message
            }
        }
        let newValues = {
            'integrationStatus.failedCount' : ++location.integrationStatus.failedCount,
            'integrationStatus.status' : process.env.IntegrationStatusFailed,
            'integrationStatus.response' : JSON.stringify(responseData),
            'integrationStatus.errorDescription' : responseMessage,
            endpoint : locationsEndpoint,
            data : data,
            token : platform.platformActiveCredentialsToken[0].token,
            requestType : "PUT",
        }
        await LocationsQueue.updateOne({_id : location._id} , {$set : newValues})
        updateNetworkStatus(location , false)
        
    }
}
