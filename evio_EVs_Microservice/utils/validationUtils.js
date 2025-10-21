const Constants = require('./constants');
const toggle = require('evio-toggle').default;

function validateInput(value, type, errorMessage, additionalCheck = () => true) {
    const isValid = value && typeof value === type && additionalCheck(value);
    if (!isValid) console.error(`[sessionsKms isInputKmValid] ${errorMessage}`);
    return isValid;
}

function isInputKmValid(requestData) {
    const { minKms, maxKms, errorMessages, listOfChargerTypes } = Constants;
    const { kms, evID, chargerType, sessionID, userID } = requestData;
    return (
        validateInput(kms, 'number', errorMessages.invalidKms, (kms) => kms >= minKms && kms <= maxKms) &&
        validateInput(evID, 'string', errorMessages.invalidEvId, (evID) => evID !== '-1') &&
        validateInput(chargerType, 'string', errorMessages.invalidChargerType, (chargerType) =>
            listOfChargerTypes.includes(chargerType)
        ) &&
        validateInput(sessionID, 'string', errorMessages.invalidSessionId) &&
        validateInput(userID, 'string', errorMessages.invalidUserId)
    );
}

function validateFeatureFlag(featureFlag) {
    return async (req, res, next) => {
        try {
            const featureFlagEnabled = await toggle.isEnable(featureFlag);
            if (!featureFlagEnabled) {
                return res.status(403).send({ message: "Forbidden access to this resource" });
            }
            next();
        } catch (err) {
            return res.status(403).send({ message: "Forbidden access to this resource" });
        }
    };
}

/**
 * Returns a middleware function that validates the request body using the given schema.
 * If the validation fails, it sends a 400 response with a structured error object.
 *
 * @param {import('zod').Schema} schema - The schema to validate the request body against.
 * @param {string} code - The error code to send in case of validation failure.
 * @param {string} message - The error message to send in case of validation failure.
 * @returns {import('express').RequestHandler} A middleware function.
 */
function dataValidation(schema , code , message) {
    return (req, res, next) => {
        const validatedData = schema.safeParse({...req.body , ...req.params , ...req.query});
        if (!validatedData.success) {
            const errors = validatedData.error.errors.map((err) => ({
                field: err.path.join('.'), // Join path to show nested fields if any
                message: err.message,     // Error message from Zod
            }));
        
            // Return a structured response
            return res.status(400).json({
                code,
                message,
                errors, // Send extracted and formatted errors
            });
        }
        next();
    }
    
}

module.exports = {
    isInputKmValid,
    validateFeatureFlag,
    dataValidation
};
