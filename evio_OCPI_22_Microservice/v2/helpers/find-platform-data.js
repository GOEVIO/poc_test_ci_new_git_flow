const { Enums } = require('evio-library-commons').default;

const findPlatformData = (version, platform, authorization_reference, reject) => {
    const platformDetails = platform.platformDetails.find(detail => detail.version === version);

    if (!platformDetails || !platformDetails.endpoints) {
        reject.setField('code', 'platform_details_not_found')
            .setField('internalLog', `Platform details or endpoints for version ${version} not found for platform ${authorization_reference}`)
            .setField('errorType', Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR)
            .setField('stage', `Find platform details for platform ${authorization_reference}`)
            .setField('message', `Platform details or endpoints for version ${version} not found for platform`)
        throw new Error()
    }
    const platformEndpoints = platformDetails.endpoints;

    const platformCommandsEndpointObject = platformEndpoints.find(endpoint => endpoint.identifier === "commands" && (version !== '2.2' || endpoint.role === "RECEIVER"));

    if (!platformCommandsEndpointObject) {
        reject.setField('code', 'server_charger_does_not_allow_remote_commands')
            .setField('internalLog', `Server does not allow remote commands ${authorization_reference}`)
            .setField('errorType', Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR)
            .setField('stage', `Find platform details for platform ${authorization_reference}`)
            .setField('message', `Server does not allow remote commands`)
        throw new Error()
    }

    const platformCommandsEndpoint = platformCommandsEndpointObject.url;

    const platformActiveCredentials = platform.platformActiveCredentialsToken.find(cred => cred.version === version);
    const platformToken = platformActiveCredentials.token;

    const endpoint = platformCommandsEndpoint + '/START_SESSION';
    const responseUrl = platform.responseUrlSessionRemoteStart + '/START_SESSION/' + authorization_reference;

    return {
        endpoint,
        responseUrl,
        platformToken
    };
}

module.exports = { findPlatformData };