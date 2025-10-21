const crypto = require('crypto');
const Utils = require('../../../utils')
const Tariff = require('../../../models/tariff')
const moment = require('moment');
const axios = require("axios");
const TariffsQueue = require('../../../models/tariffsQueue');
var User = require('../../../models/user');
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

const dimensionMapper = {
    "flat" : "FLAT",
    "energy" : "ENERGY",
    "time" : "TIME",
    "parking" : "PARKING_TIME"
}

module.exports = {
    create: (req,res) => createTariff(req,res),
    read: (req,res) => getTariff(req,res),
    update: (req,res) => updateTariff(req,res),
    delete: (req,res) => removeTariff(req,res),
    toOcpi : (req,res) => forceJobProcess(req,res),
    getApply : (req,res) => getChargers(req,res),
    apply : (req,res) => applyToChargers(req,res),
};

cron.schedule('*/3 * * * * *', () => {
    sendTariffsToOcpi()
});

async function createTariff(req,res) {
    let context = "POST /api/private/controlcenter/cpo/tariff";
    try {
        if (validateFields(req.body,req.headers['isadmin'])) return res.status(400).send(validateFields(req.body,req.headers['isadmin']))
        let cpoUserId = req.headers['isadmin'] ? req.body.ownerId : req.headers['userid']
        let foundUser = await Utils.findUserById(cpoUserId)
        if (foundUser) {
            if (foundUser.cpoDetails.find(details => (details.network === req.body.network && details.certified && details.handshake))) {
                let tariffExists = await Tariff.findOne({name : req.body.name}).lean()
                if (!tariffExists) {
                    let createdTariff = await saveTariff(req.body , foundUser)
                    if (createdTariff) {
                        let userTariffs = await Tariff.find({ownerId : cpoUserId}).lean()
                        addToQueue(req.body.network , process.env.TariffCreateCommand , foundUser , createdTariff , cpoUserId , req.body)
                        return res.status(200).send(buildTariffsResponse(userTariffs))
                    } else {
                        return res.status(400).send({ auth: false, code: '', message: 'Tariff not created' })
                    }
                } else {
                    return res.status(400).send({ auth: false, code: '', message: 'Tariff name already exists' })
                }
            } else {
                return res.status(400).send({ auth: false, code: '', message: 'User not valid to create tariff' })
            }
        } else {
            return res.status(400).send({ auth: false, code: '', message: 'User does not exist' })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

async function saveTariff(tariffBody , foundUser) {
    let context = "Function saveTariff";
    try {
        let cpoCountryCode = foundUser.cpoDetails.find(details => details.network === tariffBody.network).country_code
        cpoCountryCode = cpoCountryCode ? cpoCountryCode : Utils.getCountryCodeWithCountry(foundUser.country)
        let tariff = {
            country_code : cpoCountryCode,
            party_id : foundUser.cpoDetails.find(details => details.network === tariffBody.network).party_id.toUpperCase(),
            id : crypto.randomUUID(),
            currency : tariffBody.currency,
            name : tariffBody.name,
            type : process.env.tariffTypeRegular,
            min_price : { excl_vat : 0, incl_vat : 0},
            elements : await transformDimensionElements(tariffBody.elements , cpoCountryCode),
            last_updated : new Date().toISOString(),
            ownerId : foundUser._id,
            source : tariffBody.network,
            status : process.env.tariffStatusProcessing,
        }
        const newTariff = new Tariff(tariff)
        return await newTariff.save()
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    }
}

async function transformDimensionElements(dimensionElements , countryCode) {
    let context = "Function transformDimensionElements";
    try {
        let ocpiElements = await Promise.all(Object.keys(dimensionElements).map(async dimension => await ocpiElement(dimension , dimensionMapper , dimensionElements , countryCode)))
        return ocpiElements.flat(2)
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return []
    }
}

async function ocpiElement(dimension , dimensionMapper , dimensionElements , countryCode) {
    let context = "Function ocpiElement";
    try {
        return await Promise.all(dimensionElements[dimension].map(async element => await buildOcpiElement(element , dimensionMapper , dimension , countryCode)))
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return []
    }
}

async function buildOcpiElement(element , dimensionMapper , dimension , countryCode) {
    let context = "Function buildOcpiElement";
    try {
        let priceComponents = await buildPriceComponent(element , dimensionMapper , dimension , countryCode)
        return [
            {
                price_components : priceComponents,
                restrictions : element?.restrictions
            }
        ]
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return []
    }
}

async function buildPriceComponent(element , dimensionMapper , dimension , countryCode) {
    let context = "Function buildPriceComponent";
    try {
        let fees = await Utils.getFees({countryCode}) 
        return [
            {
                type : dimensionMapper[dimension],
                price : element.price,
                vat : fees ? fees.IVA * 100 : 23,
                step_size : 1
            }
        ]
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return []
    }
}

function validateFields(tariff , isAdmin) {
    const context = "Function validateFields"
    try {
        let validFields = [
            "ownerId",
            "network",
            "currency",
            "name",
            "elements",
        ]
        if (!tariff) {
            return { auth: false, code: 'server_tariff_required', message: 'tariff data is required' }
        } else if (!tariff.network) {
            return { auth: false, code: 'server_network_required', message: 'network is required' }
        } else if (!tariff.currency) {
            return { auth: false, code: 'server_currency_required', message: 'currency is required' }
        } else if (!tariff.name) {
            return { auth: false, code: 'server_name_required', message: 'name is required' }
        } else if (!tariff.elements) {
            return { auth: false, code: 'server_elements_required', message: 'elements is required' }
        } else if (isAdmin && !tariff.ownerId) {
            return { auth: false, code: 'server_ownerId_required', message: 'ownerId is required' }
        } else {
            let notAllowedKey = Object.keys(tariff).find(key => !validFields.includes(key))
            if (notAllowedKey) {
                return { auth: false, code: `server_${notAllowedKey}_invalid`, message: `${notAllowedKey} can't be sent` }
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { auth: false, code: '', message: error.message}
    }
};

async function getTariff(req,res) {
    let context = "GET /api/private/controlcenter/cpo/tariff";
    try {
        if (validateFieldsGet(req.query,req.headers['isadmin'])) return res.status(400).send(validateFieldsGet(req.query,req.headers['isadmin']))
        let cpoUserId = req.headers['isadmin'] ? req.query.ownerId : req.headers['userid']
        let {id , name , network} = req.query
        let query = {
            $and : [
                cpoUserId ? {ownerId : cpoUserId} : {},
                network ? {source : network} : {},
                id ? {id} : {},
                name ? {name : {'$regex': name,'$options':'i'}} : {},

            ]
        }
        console.log(query)
        let userTariffs = await Tariff.find(query).lean()
        return res.status(200).send(buildTariffsResponse(userTariffs))
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

function buildTariffsResponse(tariffs) {
    let context = "Function buildTariffsResponse";
    try {
        return tariffs.map(tariff => buildTariffBody(tariff))
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return []
    }
}

function buildTariffBody(tariff) {
    let context = "Function buildTariffBody";
    try {
        return {
            id : tariff.id,
            status : tariff.status,
            name : tariff.name,
            currency : tariff.currency,
            creationDate : moment(tariff.createdAt).utc().format(),
            activationDate : tariff.activationDate,
            attributions : getAttributions(tariff.attributions),
            elements : buildElementsResponse(tariff.elements),
            detailedTarif : Utils.tariffResponseBody(tariff).detailedTariff,
            ownerId : tariff.ownerId,
        }

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return {}
    }
}

function getAttributions(attributions) {
    let context = "Function getAttributions";
    try {
        if (attributions) {
            let hwIds = [...new Set(attributions.map(item => item.hwId))]
            let nChargers = hwIds.length
            let nPlugs = attributions.length
            return {
                hwIds,
                nChargers,
                nPlugs,
            }
        } else {
            return {
                hwIds : [],
                nChargers : 0,
                nPlugs : 0,
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return {
            hwIds : [],
            nChargers : 0,
            nPlugs : 0,
        }
    }
}

function buildElementsResponse(tariffElements) {
    let context = "Function buildElementsResponse";
    try {
        let elements = {}
        tariffElements.forEach(element => pushElement(elements , element))
        return elements
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return {}
        
    }
}

function pushElement(elements , element) {
    let context = "Function pushElement";
    try {
        let priceComponents = element.price_components 
        let restrictions = element.restrictions 
        for (let component of priceComponents) {
            pushOrCreate(Utils.getKeyByValue(dimensionMapper,component.type) , elements , component , restrictions)
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

function pushOrCreate(dimension , elements , component , restrictions) {
    let context = "Function pushOrCreate";
    try {
        if (dimension in elements) {
            elements[dimension].push(
                {
                    price : component.price,
                    restrictions
                }
            )
        } else {
            elements[dimension] = []
            elements[dimension].push(
                {
                    price : component.price,
                    restrictions
                }
            )
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

function validateFieldsGet(tariff , isAdmin) {
    const context = "Function validateFieldsGet"
    try {
        let validFields = [
            "ownerId",
            "id",
            "name",
            "network",
        ]
        if (!tariff) {
            return { auth: false, code: 'server_tariff_required', message: 'tariff data is required' }
        } else if (!tariff.network) {
            return { auth: false, code: 'server_network_required', message: 'network is required' }
        } else if (isAdmin && !tariff.ownerId) {
            return { auth: false, code: 'server_ownerId_required', message: 'ownerId is required' }
        } else {
            let notAllowedKey = Object.keys(tariff).find(key => !validFields.includes(key))
            if (notAllowedKey) {
                return { auth: false, code: `server_${notAllowedKey}_invalid`, message: `${notAllowedKey} can't be sent` }
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { auth: false, code: '', message: error.message}
    }
};
async function updateTariff(req,res) {
    let context = "PATCH /api/private/controlcenter/cpo/tariff";
    try {
        if (validateFieldsUpdate(req.body)) return res.status(400).send(validateFieldsUpdate(req.body))
        let foundTariff = await Tariff.findOne({id : req.body.id})
        if (foundTariff) {
            if (req.body.name) {
                let tariffExists = await Tariff.findOne({name : req.body.name , id : {$ne : foundTariff.id} }).lean()
                if (tariffExists) {
                    return res.status(400).send({ auth: false, code: '', message: 'Tariff name already exists' })
                }
            }
            let foundUser = await Utils.findUserById(foundTariff.ownerId)
            if (foundUser) {
                if (foundUser.cpoDetails.find(details => (details.network === foundTariff.source && details.certified && details.handshake))) {
                    let updatedTariff = await changeTariff({...req.body , network : foundTariff.source} , foundUser)
                    if (updatedTariff) {
                        let userTariffs = await Tariff.find({ownerId : foundTariff.ownerId}).lean()
                        addToQueue(foundTariff.source , process.env.TariffUpdateCommand , foundUser , updatedTariff , foundTariff.ownerId , req.body)
                        return res.status(200).send(buildTariffsResponse(userTariffs))
                    } else {
                        return res.status(400).send({ auth: false, code: '', message: 'Tariff not updated' })
                    }
                } else {
                    return res.status(400).send({ auth: false, code: '', message: 'User not valid to udpate tariff' })
                }
            } else {
                return res.status(400).send({ auth: false, code: '', message: 'User does not exist' })
            }
        } else {
            return res.status(400).send({ auth: false, code: '', message: 'Tariff does not exist' })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

async function changeTariff(tariffBody , foundUser) {
    let context = "Function changeTariff";
    try {
        let cpoCountryCode = foundUser.cpoDetails.find(details => details.network === tariffBody.network).country_code
        cpoCountryCode = cpoCountryCode ? cpoCountryCode : Utils.getCountryCodeWithCountry(foundUser.country)
        let newValues = {
            currency : tariffBody.currency,
            name : tariffBody.name,
            elements : await transformDimensionElements(tariffBody.elements , cpoCountryCode),
            last_updated : new Date().toISOString(),
        }
        const updatedTariff = await Tariff.findOneAndUpdate({id : tariffBody.id} , {$set : newValues} , { new : true })
        return updatedTariff
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    }
}

function validateFieldsUpdate(tariff) {
    const context = "Function validateFieldsUpdate"
    try {
        let validFields = [
            "id",
            "currency",
            "name",
            "elements",
        ]
        if (!tariff) {
            return { auth: false, code: 'server_tariff_required', message: 'tariff data is required' }
        } else if (!tariff.id) {
            return { auth: false, code: 'server_id_required', message: 'id is required' }
        } else if (!tariff.currency) {
            return { auth: false, code: 'server_currency_required', message: 'currency is required' }
        } else if (!tariff.name) {
            return { auth: false, code: 'server_name_required', message: 'name is required' }
        } else if (!tariff.elements) {
            return { auth: false, code: 'server_elements_required', message: 'elements is required' }
        } else {
            let notAllowedKey = Object.keys(tariff).find(key => !validFields.includes(key))
            if (notAllowedKey) {
                return { auth: false, code: `server_${notAllowedKey}_invalid`, message: `${notAllowedKey} can't be sent` }
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { auth: false, code: '', message: error.message}
    }
};

async function removeTariff(req,res) {
    let context = "DELETE /api/private/controlcenter/cpo/tariff";
    try {

        if (validateFieldsDelete(req.query)) return res.status(400).send(validateFieldsDelete(req.query))
        let foundTariff = await Tariff.findOne({id : req.query.id})
        if (foundTariff) {
            if (foundTariff.attributions.length === 0) {
                await Tariff.deleteOne({id : req.query.id})
                let userTariffs = await Tariff.find({ownerId : foundTariff.ownerId}).lean()
                addToQueue(foundTariff.source , process.env.TariffRemoveCommand , await Utils.findUserById(foundTariff.ownerId) , foundTariff , foundTariff.ownerId , req.body)
                return res.status(200).send(buildTariffsResponse(userTariffs))
            } else {
                return res.status(400).send({ auth: false, code: '', message: 'Tariff is still referenced in locations' })
            }
        } else {
            return res.status(400).send({ auth: false, code: '', message: 'Tariff does not exist' })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

function validateFieldsDelete(tariff) {
    const context = "Function validateFieldsDelete"
    try {
        let validFields = [
            "id"
        ]
        if (!tariff) {
            return { auth: false, code: 'server_tariff_required', message: 'tariff data is required' }
        } else if (!tariff.id) {
            return { auth: false, code: 'server_id_required', message: 'id is required' }
        } else {
            let notAllowedKey = Object.keys(tariff).find(key => !validFields.includes(key))
            if (notAllowedKey) {
                return { auth: false, code: `server_${notAllowedKey}_invalid`, message: `${notAllowedKey} can't be sent` }
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { auth: false, code: '', message: error.message}
    }
};


async function addToQueue(network , command , foundUser , foundTariff , ownerId , requestBody) {
    const context = "Function addToQueue"
    try {
        // let countryCode = Utils.getCountryCodeWithCountry(foundUser.country)
        let partyId = foundUser.cpoDetails.find(details => details.network === network).party_id.toUpperCase()

        let platform = await Utils.findOnePlatform({cpo : partyId , platformCode : network})
        let countryCode = platform.cpoRoles.find( roleObj => roleObj.role === process.env.cpoRole).country_code
        let tariffObj = Utils.transformTariffObject(network , foundTariff)
        if (command === process.env.TariffRemoveCommand) {
            let pendingEntry = await TariffsQueue.find({tariffId : foundTariff.id, command : process.env.TariffCreateCommand , 'integrationStatus.status' : process.env.IntegrationStatusOpen})
            if (pendingEntry.length > 0) {
                await TariffsQueue.updateMany({tariffId : {$in : pendingEntry.map(entry => entry.tariffId)}} , {$set : {'integrationStatus.status' : process.env.IntegrationStatusCanceledByUser}})
                Utils.addToTariffsQueue({} , command , network , countryCode ,  partyId , ownerId , foundTariff.id , platform._id , process.env.IntegrationStatusClosed , foundTariff , requestBody)
            } else {
                Utils.addToTariffsQueue({} , command , network , countryCode ,  partyId , ownerId , foundTariff.id , platform._id , process.env.IntegrationStatusOpen , foundTariff , requestBody)
            }
        } else {
            Utils.addToTariffsQueue(tariffObj , command , network , countryCode ,  partyId , ownerId , foundTariff.id , platform._id , process.env.IntegrationStatusOpen , foundTariff , requestBody)
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

async function forceJobProcess(req,res) {
    const context = "Function forceJobProcess";
    try {
        sendTariffsToOcpi()
        return res.status(200).send({ auth: true, code: '', message: 'Process running!' })
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send({ auth: true, code: '', message: error.message })
    }
}

async function sendTariffsToOcpi() {
    const context = "Function sendTariffsToOcpi"
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
        let tariffsToSend = await TariffsQueue.find(query).lean()
        for (let tariff of tariffsToSend) {
            sendtariff(tariff)
        }   
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

async function sendtariff(tariff) {
    const context = "Function sendtariff"
    try {
        let platform = await Utils.findOnePlatform({_id : tariff.platformId})
        let platformDetails = platform.platformDetails.find(details => details.version === platform.cpoActiveCredentialsToken[0].version)
        let tariffsEndpoint = Utils.getPlatformSenderEndpoint(tariff.network , platformDetails , process.env.moduleTariffs , process.env.roleReceiver)
        tariffsEndpoint = tariffsEndpoint + `/${tariff.country_code}/${tariff.party_id}/${tariff.tariffId}`
        if (tariff.command === process.env.TariffCreateCommand  || tariff.command === process.env.TariffUpdateCommand) {
            await putTariff(tariffsEndpoint , tariff , platform , tariff.tariff)
        } else if (tariff.command === process.env.TariffRemoveCommand) {
            await deleteTariff(tariffsEndpoint , tariff , platform , {})
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
            'integrationStatus.failedCount' : ++tariff.integrationStatus.failedCount,
            'integrationStatus.status' : process.env.IntegrationStatusFailed,
            'integrationStatus.response' : JSON.stringify(responseData),
            'integrationStatus.errorDescription' : responseMessage,
        }
        await TariffsQueue.updateOne({_id : tariff._id} , {$set : newValues})
    }
}

async function putTariff(tariffsEndpoint , tariff , platform , data) {
    const context = "Function putTariff"
    try {
        let resp = await putRequest(tariffsEndpoint,data,{ 'Authorization': `Token ${platform.platformActiveCredentialsToken[0].token}` })
        if (resp.success) {
            let result = resp.data
            if (result.status_code) {
                if ((Math.round(result.status_code / 1000)) == 1) {
                    // Update integration Status and dependencies
                    let newValues = {
                        'integrationStatus.status' : process.env.IntegrationStatusClosed,
                        'integrationStatus.response' : JSON.stringify(result),
                        endpoint : tariffsEndpoint,
                        data : data,
                        token : platform.platformActiveCredentialsToken[0].token,
                        requestType : "PUT",
                        httpStatus : resp.status,
                    }
                    await TariffsQueue.updateOne({_id : tariff._id} , {$set : newValues})
                    updateTariffStatus(tariff , process.env.tariffStatusSent)
                    Utils.saveLog(newValues.requestType , data , result , tariffsEndpoint , newValues.token , platform.platformCode , platform.platformName , newValues.httpStatus , process.env.triggerCPO , process.env.moduleTariffs , platform.cpo)

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
                        'integrationStatus.failedCount' : ++tariff.integrationStatus.failedCount,
                        'integrationStatus.status' : process.env.IntegrationStatusFailed,
                        'integrationStatus.response' : JSON.stringify(result),
                        'integrationStatus.errorDescription' : message,
                        endpoint : tariffsEndpoint,
                        data : data,
                        token : platform.platformActiveCredentialsToken[0].token,
                        requestType : "PUT",
                        httpStatus : resp.status,
                    }
                    await TariffsQueue.updateOne({_id : tariff._id} , {$set : newValues})
                    updateTariffStatus(tariff , process.env.tariffStatusFailed)
                    Utils.saveLog(newValues.requestType , data , result , tariffsEndpoint , newValues.token , platform.platformCode , platform.platformName , newValues.httpStatus , process.env.triggerCPO , process.env.moduleTariffs , platform.cpo)
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
                    'integrationStatus.failedCount' : ++tariff.integrationStatus.failedCount,
                    'integrationStatus.status' : process.env.IntegrationStatusFailed,
                    'integrationStatus.response' : JSON.stringify(result),
                    'integrationStatus.errorDescription' : message,
                    endpoint : tariffsEndpoint,
                    data : data,
                    token : platform.platformActiveCredentialsToken[0].token,
                    requestType : "PUT",
                    httpStatus : resp.status,
                }
                await TariffsQueue.updateOne({_id : tariff._id} , {$set : newValues})
                updateTariffStatus(tariff , process.env.tariffStatusFailed)
                Utils.saveLog(newValues.requestType , data , result , tariffsEndpoint , newValues.token , platform.platformCode , platform.platformName , newValues.httpStatus , process.env.triggerCPO , process.env.moduleTariffs , platform.cpo)
            }
        } else {
            // Error handling
            console.log('Unable to use the client’s API Details.', resp.error);
            let newValues = {
                'integrationStatus.failedCount' : ++tariff.integrationStatus.failedCount,
                'integrationStatus.status' : process.env.IntegrationStatusFailed,
                'integrationStatus.response' : JSON.stringify(resp.error),
                'integrationStatus.errorDescription' : 'Unable to use the client’s API Details.',
                endpoint : tariffsEndpoint,
                data : data,
                token : platform.platformActiveCredentialsToken[0].token,
                requestType : "PUT",
                httpStatus : resp.status,
            }
            await TariffsQueue.updateOne({_id : tariff._id} , {$set : newValues})
            updateTariffStatus(tariff , process.env.tariffStatusFailed)
            let responseData = resp.data 
            if (typeof resp.data === 'string' || resp.data instanceof String) {
                responseData = {message : resp.data}
            }
            Utils.saveLog(newValues.requestType , data , responseData , tariffsEndpoint , newValues.token , platform.platformCode , platform.platformName , newValues.httpStatus , process.env.triggerCPO , process.env.moduleTariffs , platform.cpo)
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
            'integrationStatus.failedCount' : ++tariff.integrationStatus.failedCount,
            'integrationStatus.status' : process.env.IntegrationStatusFailed,
            'integrationStatus.response' : JSON.stringify(responseData),
            'integrationStatus.errorDescription' : responseMessage,
            endpoint : tariffsEndpoint,
            data : data,
            token : platform.platformActiveCredentialsToken[0].token,
            requestType : "PUT",
        }
        await TariffsQueue.updateOne({_id : tariff._id} , {$set : newValues})
        updateTariffStatus(tariff , process.env.tariffStatusFailed)
        
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
            return { ...response , success : false, error: 'Not updated' , status : Utils.getHttpStatus(resp)}
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

async function deleteTariff(tariffsEndpoint , tariff , platform , data) {
    const context = "Function deleteTariff"
    try {
        let resp = await deleteRequest(tariffsEndpoint,data,{ 'Authorization': `Token ${platform.platformActiveCredentialsToken[0].token}` })
        if (resp.success) {
            let result = resp.data
            if (result.status_code) {
                if ((Math.round(result.status_code / 1000)) == 1) {
                    // Update integration Status and dependencies
                    let newValues = {
                        'integrationStatus.status' : process.env.IntegrationStatusClosed,
                        'integrationStatus.response' : JSON.stringify(result),
                        endpoint : tariffsEndpoint,
                        data : data,
                        token : platform.platformActiveCredentialsToken[0].token,
                        requestType : "DELETE",
                        httpStatus : resp.status,
                    }
                    await TariffsQueue.updateOne({_id : tariff._id} , {$set : newValues})
                    Utils.saveLog(newValues.requestType , data , result , tariffsEndpoint , newValues.token , platform.platformCode , platform.platformName , newValues.httpStatus , process.env.triggerCPO , process.env.moduleTariffs , platform.cpo)

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
                        'integrationStatus.failedCount' : ++tariff.integrationStatus.failedCount,
                        'integrationStatus.status' : process.env.IntegrationStatusFailed,
                        'integrationStatus.response' : JSON.stringify(result),
                        'integrationStatus.errorDescription' : message,
                        endpoint : tariffsEndpoint,
                        data : data,
                        token : platform.platformActiveCredentialsToken[0].token,
                        requestType : "DELETE",
                        httpStatus : resp.status,
                    }
                    await TariffsQueue.updateOne({_id : tariff._id} , {$set : newValues})
                    Utils.saveLog(newValues.requestType , data , result , tariffsEndpoint , newValues.token , platform.platformCode , platform.platformName , newValues.httpStatus , process.env.triggerCPO , process.env.moduleTariffs , platform.cpo)
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
                    'integrationStatus.failedCount' : ++tariff.integrationStatus.failedCount,
                    'integrationStatus.status' : process.env.IntegrationStatusFailed,
                    'integrationStatus.response' : JSON.stringify(result),
                    'integrationStatus.errorDescription' : message,
                    endpoint : tariffsEndpoint,
                    data : data,
                    token : platform.platformActiveCredentialsToken[0].token,
                    requestType : "DELETE",
                    httpStatus : resp.status,
                }
                await TariffsQueue.updateOne({_id : tariff._id} , {$set : newValues})
                Utils.saveLog(newValues.requestType , data , result , tariffsEndpoint , newValues.token , platform.platformCode , platform.platformName , newValues.httpStatus , process.env.triggerCPO , process.env.moduleTariffs , platform.cpo)
            }
        } else {
            // Error handling
            console.log('Unable to use the client’s API Details.', resp.error);
            let newValues = {
                'integrationStatus.failedCount' : ++tariff.integrationStatus.failedCount,
                'integrationStatus.status' : process.env.IntegrationStatusFailed,
                'integrationStatus.response' : JSON.stringify(resp.error),
                'integrationStatus.errorDescription' : 'Unable to use the client’s API Details.',
                endpoint : tariffsEndpoint,
                data : data,
                token : platform.platformActiveCredentialsToken[0].token,
                requestType : "DELETE",
                httpStatus : resp.status,
            }
            await TariffsQueue.updateOne({_id : tariff._id} , {$set : newValues})
            let responseData = resp.data 
            if (typeof resp.data === 'string' || resp.data instanceof String) {
                responseData = {message : resp.data}
            }
            Utils.saveLog(newValues.requestType , data , responseData , tariffsEndpoint , newValues.token , platform.platformCode , platform.platformName , newValues.httpStatus , process.env.triggerCPO , process.env.moduleTariffs , platform.cpo)
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
            'integrationStatus.failedCount' : ++tariff.integrationStatus.failedCount,
            'integrationStatus.status' : process.env.IntegrationStatusFailed,
            'integrationStatus.response' : JSON.stringify(responseData),
            'integrationStatus.errorDescription' : responseMessage,
            endpoint : tariffsEndpoint,
            data : data,
            token : platform.platformActiveCredentialsToken[0].token,
            requestType : "DELETE",
        }
        await TariffsQueue.updateOne({_id : tariff._id} , {$set : newValues})
        
    }
}

async function deleteRequest(host,data,headers) {
    const context = "Function deleteRequest";
    let response = {success : true , data : {} , error : "" , code : ""}
    try {
        let resp = await axios.delete(host, /*data , */ {headers})
        if (resp.data) {
            return {...response , data : resp.data , status : Utils.getHttpStatus(resp)}
        } else {
            return { ...response , success : false, error: 'Not deleted' , status : Utils.getHttpStatus(resp) }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        if (error.response) {
            if (error.response.data) {
                return { ...response , success : false, error: error.response.data.message , code : error.response.data.code , status : Utils.getHttpStatus(error.response) , data : error.response.data}
            }
            return { ...response , success : false, error: error.message , status : Utils.getHttpStatus(error.response) }
        }
        return { ...response , success : false, error: error.message , status : Utils.getHttpStatus(error.response)}
    }
}

async function updateTariffStatus(tariff , status) {
    const context = "Function updateTariffStatus";
    try {
        if (tariff.command === process.env.TariffCreateCommand  || tariff.command === process.env.TariffUpdateCommand) {

            let query = {
                $and : [
                    {id : tariff.tariffId},
                    {
                        $or : [
                            {status : process.env.tariffStatusProcessing },
                            {status : process.env.tariffStatusFailed },
                        ]
                    }
                ]
            }

            let newValues = {
                status
            }

            if (status === process.env.tariffStatusSent) {
                newValues.activationDate = new Date().toISOString()
            }
            await Tariff.findOneAndUpdate(query , {$set : newValues})
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        
    }
}

async function getChargers(req,res) {
    const context = "GET /api/private/controlcenter/cpo/tariff/apply"
    try {
        if (req.headers['isadmin'] && !req.query.ownerId) {
            return res.status(400).send({ auth: false, code: 'server_ownerId_required', message: 'ownerId is required' })
        } 
        let cpoUserId = req.headers['userid']
        let ownerId = req.query.ownerId
        let userId = req.query.userId
        let infrastructureId = req.query.infrastructureId
        let chargerId = req.query.chargerId
        let city = req.query.city
        let searchPlug = req.query.searchPlug
        let network = req.query.network ? req.query.network : ""
        let userClientsListArray = await getUserClientsList(cpoUserId , req.headers['isadmin'] , ownerId , userId)
        getUserChargers(userClientsListArray , searchPlug , infrastructureId , chargerId , city , network , res) 
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

async function getUserClientsList(cpoUserId , isAdmin , ownerId , userId) {
    const context = "Function getUserClientsList"
    try {
        let usersFound = await User.find(!isAdmin ? {_id : cpoUserId , active : true} : ( ownerId ? {_id : ownerId , active : true} : { active : true} ) , {_id : 1 , "clients" : 1 , name : 1 }).lean()
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
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return {clientsList : [], owner : user.name , _id : user._id}
    }
}

async function getUserChargers(userClientsListArray , searchPlug , infrastructureId , chargerId ,city , source , res) {
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
                let cpoObject = getCpoObject(userClientsListArray , client)
                let infrastructures = await getInfrastructureInfo(client.userId , infrastructureId , chargerId)
                for (let infrastructure of infrastructures) {
                    for (let charger of infrastructure.listChargers) {
                        let chargerNetwork = charger.networks.find(network => (network.network.toUpperCase() === source.toUpperCase()) && network.activationRequest)
                        if (chargerNetwork && pushCharger(searchPlug , city , charger)) {
                            userChargerInfo.push({
                                infrastructureId : infrastructure.infrastructureId,
                                infrastructureName : infrastructure.name,
                                chargerId : charger.chargerId,
                                chargerName : charger.name,
                                chargerHwId : charger.hwId,
                                chargerPlugs : charger.plugs,
                                chargerCity : charger.address.city,
                                ownerId : cpoObject._id,
                                ownerName : cpoObject.owner,
                                userId : client.userId,
                                userName : client.name,
                                integrationStatus : chargerNetwork.status,
                            })
                        }
                    }
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

function plugFilter(plugs , searchPlug) {
    const context = "Function plugFilter";
    try {
        return plugs.find(plug => plug.powerType && plug.powerType.toUpperCase().includes(searchPlug.toUpperCase())) ||
        plugs.find(plug => plug.connectorType && plug.connectorType.toUpperCase().includes(searchPlug.toUpperCase()))
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return false
    }
}


function pushCharger(searchPlug , city , charger) {
    const context = "Function pushCharger";
    try {
        if (searchPlug && city) {
            if (plugFilter(charger.plugs , searchPlug) && charger.address.city && city.toUpperCase() === charger.address.city.toUpperCase()) {
                return true
            } else {
                return false
            }
        } else if (searchPlug) { 
            if (plugFilter(charger.plugs , searchPlug)) {
                return true
            } else {
                return false
            }
        } else if (city) {
            if (charger.address.city && city.toUpperCase() === charger.address.city.toUpperCase()) {
                return true
            } else {
                return false
            }
        } else {
            return true
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return false
    }
}

async function getInfrastructureInfo(userId , infrastructureId , chargerId) {
    const context = "Function getInfrastructureInfo";
    try {
        let host = process.env.HostChargers + process.env.PathGetMyInfrastructure
        let params = { userId , infrastructureId , chargerId};
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

function getCpoObject(userClientsListArray , client) {
    const context = "Function getCpoObject"
    try {
        return userClientsListArray.find(user => user.clientsList.find(userId => userId === client.userId) )
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return {}
    }
}

async function applyToChargers(req,res) {
    const context = "PATCH /api/private/controlcenter/cpo/tariff/apply"
    try {
        if (validateApplyFields(req.body)) return res.status(400).send(validateApplyFields(req.body))
        return res.status(200).send(await applyTariffToChargers(req.body))
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

async function applyTariffToChargers(chargersObj) {
    const context = "Function applyTariffToChargers"
    try {
        let {chargers , tariffId , network , ownerId} = chargersObj
        let foundUser = await Utils.findUserById(ownerId)
        if (foundUser) {
            if (chargers.length > 0) {
                let foundUserDetail = foundUser.cpoDetails.find(details => (details.network === network && details.certified && details.handshake))
                if (foundUserDetail) {
                    await Promise.all(chargers.map( async charger => await applyTariff(charger , foundUser , foundUserDetail , tariffId , network , ownerId , chargersObj)) )
                    let userTariffs = await Tariff.find({ownerId : chargersObj.ownerId}).lean()
                    return buildTariffsResponse(userTariffs)
                } else {
                    return []
                }
            } else {
                let userTariffs = await Tariff.find({ownerId : chargersObj.ownerId}).lean()
                return buildTariffsResponse(userTariffs)
            }
        } else {
            return []
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return []
    }
}

async function applyTariff(charger , foundUser , foundUserDetail , tariffId , network , ownerId , requestBody) {
    const context = "Function applyTariff"
    try {
        let oldCharger = await Utils.findChargerById(charger.chargerId)
        let updatedCharger = await updateTariffId(charger , tariffId , network)
        if (updatedCharger) {
            await Utils.updateAttributions(updatedCharger.hwId , charger.plugs , tariffId , oldCharger , network)
            addTariffIdToOcpi(updatedCharger , charger.plugs , foundUser , foundUserDetail , network , ownerId , requestBody)
            return updatedCharger
        } else {
            null
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    }
}

async function updateTariffId(charger , tariffId , network) {
    const context = "Function updateTariffId"
    try {
        let host = process.env.HostChargers + process.env.PathUpdateTariffId
        let body = {
            chargerId : charger.chargerId,
            plugs : charger.plugs,
            tariffId,
            network,
        }
        let resp = await Utils.patchRequest(host,body)
        if (resp.success) {
            return resp.data
        } else {
            return null
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    }
}
function validateApplyFields(chargerObj) {
    const context = "Function validateApplyFields"
    try {
        let validFields = [
            "chargers",
            "network",
            "ownerId",
            "tariffId"
        ]
        if (!chargerObj) {
            return { auth: false, code: 'server_user_required', message: 'User data is required' }
        } else if (!chargerObj.chargers) {
            return { auth: false, code: 'server_chargers_required', message: 'chargers is required' }
        } 
        // else if (!chargerObj.chargers.length > 0) {
        //     return { auth: false, code: 'server_chargers_required', message: 'chargers array does not have any charger' }
        // } else if (!chargerObj.chargers.every( charger => charger.chargerId )) {
        //     return { auth: false, code: 'server_chargers_required', message: 'chargerId is required' }
        // } 
        else if (!chargerObj.chargers.every( charger => charger.plugs) ) {
            return { auth: false, code: 'server_plugs_required', message: 'plugs is required' }
        } 
        // else if (!chargerObj.chargers.every( charger => charger.plugs.length > 0) ) {
            // return { auth: false, code: 'server_plugs_required', message: 'plugs array does not have any plugs' }
        // } else if (!chargerObj.chargers.every( charger => charger.plugs.every(plug => plug.plugId)) ) {
            // return { auth: false, code: 'server_plugs_required', message: 'plugs array does not have any plugs' }
        // } 
        else if (!chargerObj.network) {
            return { auth: false, code: 'server_network_required', message: 'network is required' }
        } else if (!chargerObj.tariffId) {
            return { auth: false, code: 'server_tariffId_required', message: 'tariffId is required' }
        } else if (!chargerObj.ownerId) {
            return { auth: false, code: 'server_ownerId_required', message: 'ownerId is required' }
        } else {
            let notAllowedKey = Object.keys(chargerObj).find(key => !validFields.includes(key))
            if (notAllowedKey) {
                return { auth: false, code: `server_${notAllowedKey}_invalid`, message: `${notAllowedKey} can't be updated` }
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { auth: false, code: '', message: error.message}
    }
};

async function addTariffIdToOcpi(updatedCharger , plugs , foundUser , foundUserDetail , network , ownerId , requestBody) {
    const context = "Function addTariffIdToOcpi"
    try {
        // let cpoCountryCode = Utils.getCountryCodeWithCountry(foundUser.country)
        let partyId = foundUserDetail.party_id.toUpperCase()
        // let activationRequest = foundUserDetail.activationRequest
        let active = updatedCharger.networks.find(details => details.network === network).activationRequest
        if (active && updatedCharger.accessType === process.env.ChargerAccessPublic) {
            let platform = await Utils.findOnePlatform({cpo : partyId , platformCode : network})
            let cpoCountryCode = platform.cpoRoles.find( roleObj => roleObj.role === process.env.cpoRole).country_code
            let locationObj = await Utils.transformLocationObject(network , updatedCharger , cpoCountryCode , partyId , platform , active)
            for (let plug of plugs) {
                let plugId = plug.plugId
                let {evse , connector} = findConnector(locationObj.evses , plugId)
                Utils.addToLocationQueue(locationObj , process.env.ChargerUpdateTariffIdCommand ,network , cpoCountryCode , partyId , ownerId , updatedCharger._id , platform._id , process.env.IntegrationStatusOpen , updatedCharger , requestBody , evse , connector)
            }
        } else {
            console.log(`Charger ${updatedCharger.hwId} is not active on ${network} to send tariffId update`)
            return null
        }
        
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    }
}

function findConnector(evses , plugId) {
    for (let evse of evses) {
        for (let connector of evse.connectors) {
            if (connector.id === `${evse.uid}-${plugId}`) {
                return {evse , connector}
            }
        }
    }
}
