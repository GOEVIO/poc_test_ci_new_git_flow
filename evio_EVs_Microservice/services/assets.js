const { BadRequest , Forbidden , ServerError } = require('../utils/errorHandling');
const Constants = require('../utils/constants');
const EV = require('../models/ev');
const { findContract , getEnabledNetworks } = require('evio-library-identity').default;
const { createAsset : createAssetHandler , updateNetworkStatus , removeAsset , updateAsset: updateAssetHandler } = require('evio-library-assets').default;
const ObjectId = require('mongoose').Types.ObjectId;


// Helper function to validate and sanitize query parameters
function validateAndSanitizeParameters(query) {

    // Validation of fields
    if (query.assetGroupId && typeof query.assetGroupId !== 'string') throw BadRequest('Invalid assetGroupId');
    if (query.assetId && typeof query.assetId !== 'string') throw BadRequest('Invalid assetId');
    if (query.startDate && !validISODate(query.startDate)) throw BadRequest('Invalid startDate');
    if (query.endDate && !validISODate(query.endDate)) throw BadRequest('Invalid endDate');
    

    // Sanitization of fields
    // Default page to 1
    const page = Math.max(parseInt(query.page) || Constants.assets.pagination.defaultPage, Constants.assets.pagination.defaultPage); 

    // Default limit to 10 and maximum to 100
    const limit = Math.min(
        Math.max(parseInt(query.limit) || Constants.assets.pagination.defaultLimit, Constants.assets.pagination.defaultLimit), 
        Constants.assets.pagination.maximumLimit); 

    return {
        page,
        limit,
        startDate : query.startDate,
        endDate : query.endDate,
        assetGroupId: query.assetGroupId,
        assetId: query.assetId,
    };
}


// Function to generate full URL for pagination links
function generatePageUrl(req, page, limit , params) {
    const baseUrl = `${req.protocol}://${req.get('host')}${req.path}`;
    return `${baseUrl}?page=${page}&limit=${limit}${buildQueryString(params)}`;
}


function validISODate(date) {
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
    return isoDateRegex.test(date);
}



async function paginateEvs(query, fields , skip, limit , sort = { updatedAt: 1 }) {
    const pipeline = [
        { $match: query }, 
        { $project: fields }, 
        { $sort: sort }, 
        { $skip: skip }, 
        { $limit: limit } 
    ];
    return await EV.aggregate(pipeline).exec();
}

async function getEvs(userId , parameters) {
    const {page, limit, assetGroupId , assetId , startDate  , endDate } = parameters

    const query = {
        $and: [
         {userId: userId},
         assetGroupId ? {fleet: assetGroupId} : {},
         assetId ? {_id: ObjectId(assetId)} : {},
         startDate ? {updatedAt: { $gte: new Date(startDate) }} : {},
         endDate ? {updatedAt: { $lte: new Date(endDate) }} : {},   
        ]
    }


    const fields = {
        assetId: "$_id",
        _id : 0,
        assetGroupId: "$fleet",
        country : 1,
        generalDesignation : "$model",
        specificDesignation  : "$licensePlate",
        otherInfo : 1,
        createdAt: 1,
        updatedAt: 1
    }

    // For each page, we skip "limit" documents
    const skip = (page - 1) * limit;


    // I'm using limit + 1 so that I don't have to check if there is a next page based on the total number of documents
    return await paginateEvs(query, fields , skip, limit + 1)
}


function buildMetadata(req , nResults , parameters ) { 
 
    // Generate nextPage and previousPage URLs
    const nextPage = nResults > parameters.limit ? generatePageUrl(req, parameters.page +1, parameters.limit , parameters)  : null;
    const previousPage = parameters.page > 1 ? generatePageUrl(req, parameters.page -1, parameters.limit , parameters)  : null;
    return {
        nextPage,
        previousPage
    }
}

function buildQueryString(params) {
    const queryParams = Object.entries(params)
      .filter(([key, value]) => queryValuesFilter(key , value))
      .map(([key, value]) => queryValuesMap(key , value))
      .join("&");
  
    return queryParams ? `&${queryParams}` : "";
  }
  
function queryValuesFilter(key , value) {
    return ( value !== null && value !== undefined ) && key !== "page" && key !== "limit"
}

function queryValuesMap(key , value) {
    return `${key}=${value}`
}


async function joinContractsToEvs(evs , enabledNetworks) {
    return await Promise.all(evs.map(joinContract(enabledNetworks))); 
}

function joinContract(enabledNetworks) {
    const context = "Function joinContract";
    return async (ev) => {
        try {
            
            // Get contract associated with the EV
            const contract = await getEvContract(ev.assetId);
            
            // Filter contract data according to defined criteria
            filterContractData(contract , enabledNetworks)
    
            return {
                ...ev,
                ...contract,
            }
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            return ev
        }
    }
}

function filterContractData(contract , enabledNetworks) { 
    if (!contract) return;
    contract.rfidTag = getRFIDTag(contract.networks) ?? contract.rfidTag;
    contract.networks = buildContractNetworks(contract.networks, enabledNetworks);
}


async function getEvContract(evId) {
    const query = {
        active: true,
        status: Constants.contracts.contractStatusActive,
        evId: evId.toString(),
    }

    const fields = {
        _id : 0,
        cardNumber : 1,
        "networks.network" : 1,
        "networks.tokens.tokenType" : 1,
        "networks.tokens.status" : 1,
        "networks.tokens.idTagDec" : 1,
        cardPhysicalStateInfo : 1,
    }

    return await findContract(query , fields)
}

function getRFIDTag(networks) {
    return networks.find(network =>
        network.tokens.some(token => token.tokenType === Constants.contracts.tokenTypeRFID)
    )?.tokens.find(token => token.tokenType === Constants.contracts.tokenTypeRFID).idTagDec;
}

function buildContractNetworks(networks , enabledNetworks) {
    return networks.filter(isVisibleNetwork(enabledNetworks)).map(formattedNetwork);      
}

function formattedNetwork(network) {
    const token = network.tokens.find(token => token.status === Constants.contracts.contractStatusActive);
    return {
        name: network.network,
        status: token?.status ?? Constants.contracts.contractStatusInactive, 
    };
}

function isVisibleNetwork(enabledNetworks) {
    return network => {
        return enabledNetworks[network.network.toUpperCase()];
    }
}

async function getAssets(req) {
    const userId = req.headers['userid'];
    const parameters = validateAndSanitizeParameters(req.query)

    // Get the networks each asset will display
    const enabledNetworks = await getEnabledNetworks(userId);

    // Get user evs according to the sent parameters
    const evs = await getEvs(userId , parameters);

    /*
        If there are more evs than the limit, we remove the last one.
        We're doing this to avoid countig all the documents to know if there is a next page
    */
    const limitEvs = evs.length > parameters.limit ? evs.slice(0, -1) : evs;

    // The evs with the contracts info will be the assets presented to the user
    const data = await joinContractsToEvs(limitEvs , enabledNetworks);

    // Useful info to easily paginate all the results
    const metadata = buildMetadata(req , evs.length , parameters);
    
    return {
        metadata,
        data
    };
    
}   


// Function to create an asset
async function createAsset(req){
    const { userid: userId = '', clientname: clientName = '' , clienttype : clientType = '' } = req.headers;
    const body = req.body;

    const result = await createAssetHandler({
        ...body,
        userId,
        clientName,
        clientType
    });

    return createAssetResponse(result)
}

function createAssetResponse(result) {
    switch (Math.floor(result.status/100)) {
        case 2:
            return {      
                _id: result.result?._id ?? result._id,      
                code : "server_asset_created_successfully",
                message : "Asset created successfully"
            };
        case 4:
            throw BadRequest(result.result);
        case 5:
            throw ServerError(result.result);
        default:
            throw ServerError(result.result);
        
    }
}


async function validateAssetOwnership(assetId , userId) {
    const ev = await EV.findById(assetId , {_id : 1 , userId : 1}).lean();
    if (!ev) {
        throw BadRequest({ code : Constants.errorResponses.assets.notFound.code, message : Constants.errorResponses.assets.notFound.message });
    }
    
    if (ev.userId !== userId) {
        throw Forbidden({ code : Constants.errorResponses.assets.forbidden.code, message : Constants.errorResponses.assets.forbidden.message });
    }

}

async function validateUpdateFields(assetId , userId , rfidTag , specificDesignation) {

    await Promise.all([
        validateAssetOwnership(assetId , userId), // Guarantee that the user can update this asset
        validateContractIdTag(assetId , rfidTag), // Guarantee that the asset contract doesn't have an RFID tag
        validateLicensePlate(assetId , specificDesignation) // Guarantee there's no other asset with the same license plate
    ])
}


async function changeNetworkStatus(req){
    const userId = req.headers['userid'];
    const assetId = req.params.id;
    const {networks , action} = req.body;

    // Guarantee that the user can activate/deactivate the network of this asset
    await validateAssetOwnership(assetId , userId)
    
    // Update network status with assets library
    return await updateNetworkStatus({assetId , userId , networks , action});
}   



async function deleteAsset(req){
    const userId = req.headers['userid'];
    const assetId = req.params.id;

    // Guarantee that the user can delete this asset
    await validateAssetOwnership(assetId , userId)
    
    // Delete asset with assets library
    return await removeAsset(assetId);
}   


async function updateAsset(req) {
    const userId = req.headers['userid'];
    const assetId = req.params.id;
    const body = req.body;

    // Guarantee that the update process can be performed
    await validateUpdateFields(assetId , userId , body.rfidTag , body.specificDesignation)

    // Update the asset with assets library
    return await updateAssetHandler({...body, assetId});
}



async function validateContractIdTag(assetId , rfidTag) {
    const { networks = []} = await getEvContract(assetId) || {};
    const idTag = getRFIDTag(networks)
    if (rfidTag && (idTag && idTag !== rfidTag )) {
        throw BadRequest({ code : Constants.errorResponses.assets.existingIdTag.code, message : Constants.errorResponses.assets.existingIdTag.message });
    }
}

async function validateLicensePlate(assetId , licensePlate) {
    if (licensePlate) {
        const ev = await EV.findOne({licensePlate , hasFleet : true , _id : {$ne : assetId}} , {_id : 1 }).lean();
        if (ev) {
            throw BadRequest({ code : Constants.errorResponses.assets.existingLicensePlate.code, message : Constants.errorResponses.assets.existingLicensePlate.message });
        }
    }
}


module.exports = {
    getAssets,
    createAsset,
    changeNetworkStatus,
    deleteAsset,
    updateAsset
};

