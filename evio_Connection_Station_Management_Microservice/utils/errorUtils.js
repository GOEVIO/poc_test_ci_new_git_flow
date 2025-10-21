function createErrorResponse(response, code, message) {
    response.status(400).json({
        auth: false,
        code,
        message
    });
}

function getErrorMessageFromErrorResponse(error) {
    if(!error) {
        return null;
    }

    // Error response from request another service
    if (error?.response?.data?.message) {
        return error.response.data.message;
    }

    // Error response from throw error
    if (error?.message) {
        return error.message;
    }
    
    return null;
}

module.exports = {
    createErrorResponse,
    getErrorMessageFromErrorResponse
};