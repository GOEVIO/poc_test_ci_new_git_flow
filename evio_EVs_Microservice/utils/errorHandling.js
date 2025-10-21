const { captureException } = require('@sentry/node');

/**
 * Creates a new error object
 * @param {number} statusCode
 * @param {string | object | Array<any>} error
 * @param {string} [context]
 * @returns {{statusCode: number, error: string | object | Array<any>, context?: string}}
 */
const newError = (statusCode, error, context) => ({
    statusCode,
    error,
    context
});

/**
 * Creates a BadRequest error object
 * @param {string | object | Array<any>} error
 * @param {string} [context]
 * @returns {object}
 */
const BadRequest = (error, context) => newError(400, error, context);

/**
 * Creates an Unauthorized error object
 * @param {string | object | Array<any>} error
 * @param {string} [context]
 * @returns {object}
 */
const Unauthorized = (error, context) => newError(401, error, context);

/**
 * Creates a NotFound error object
 * @param {string | object | Array<any>} error
 * @param {string} [context]
 * @returns {object}
 */
const NotFound = (error, context) => newError(404, error, context);

/**
 * Creates a Forbidden error object
 * @param {string | object | Array<any>} error
 * @param {string} [context]
 * @returns {object}
 */
const Forbidden = (error, context) => newError(403, error, context);

/**
 * Creates a ServerError error object
 * @param {string | object | Array<any>} error
 * @param {string} [context]
 * @returns {object}
 */
const ServerError = (error, context) => newError(500, error, context);

/**
 * Sends an error response
 * @param {Response} res
 * @param {{statusCode: number, error: string | object | Array<any>, message?: string, context?: string}} customError
 * @param {string} context
 * @returns {Response}
 */
const errorResponse = (res, customError, context) => {
    const error = customError.error ?? customError.message;
    const statusCode = customError.statusCode ?? 500;
    const errorContext = customError.context ?? context;

    if (statusCode === 500) {
        captureException(new Error(`Error - ${error} ${errorContext}`));
    }

    console.error(`[code:${statusCode}][${errorContext}] Error`, error);
    return res.status(statusCode).send(error);
};

module.exports = {
    BadRequest,
    Unauthorized,
    Forbidden,
    ServerError,
    errorResponse,
    NotFound
};
