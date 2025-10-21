const { Types } = require('mongoose');
const { StatusCodes } = require('http-status-codes');

const validateUserRequest = async (req, res, next) => {
    const context = `${req.method} ${req.path} validateUserRequest`;
    try {
        const { userId } = req.query;
        if (!Types.ObjectId.isValid(userId)) {
            return res.status(StatusCodes.BAD_REQUEST).send({
                auth: false,
                code: 'server_invalid_userId',
                message: 'Invalid user id'
            });
        }
        return next();
    } catch (error) {
        console.log(`${context} Error:`, error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
            auth: false,
            code: 'server_error',
            message: 'Internal Error'
        });
    }
};

module.exports = {
    validateUserRequest
};