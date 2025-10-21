const { createErrorResponse } = require("./errorUtils");
const {plugCapabilities } = require("./enums/enumPlugs")


function validateOptionalParams(optionalParams, response) {
    const optionalParamsPresent = optionalParams.filter(({ param }) => param);
    if (optionalParamsPresent.length > 0 && optionalParamsPresent.length < optionalParams.length) {
        const optionalParamsNamesString = optionalParams.map(param => param.name).join(', ');
        createErrorResponse(response, "server_incomplete_optional_params", `All or none of ${optionalParamsNamesString} are required`);
        return false;
    }
    return true;
}

function validateRequiredParams(requiredParams, response) {
    for (const { param, name } of requiredParams) {
        if (!param) {
            createErrorResponse(response, `server_${name}_required`, `${name} is required`);
            return false;
        }
    }
    return true;
}


function validatePlugCapabilities(plug, response){
    let validCharger = true;

    if ( !plug?.capabilities || plug?.capabilities?.length === 0) {
        return validCharger;
    }
    
    const hasRemoteStartStopCapability = plug?.capabilities?.find(capability => capability === plugCapabilities.REMOTE_START_STOP_CAPABLE);
    
    if(!hasRemoteStartStopCapability){
        validCharger = false;
        createErrorResponse(response, `server_invalid_plug_capabilities`, `The charger you are trying to use does not support login via the app, use your physical card!.`);
    }
    
    return validCharger;
}


module.exports = {
	validateOptionalParams,
	validateRequiredParams,
    validatePlugCapabilities
};
