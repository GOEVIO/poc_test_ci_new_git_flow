import { NextFunction, Request, Response } from 'express';
import { ObjectId as ObjectID } from 'mongodb';

// Utils
import { BadRequest, errorResponse, ServerError } from '../utils/errorHandling';

const commonLog = '[ solarPVMiddleware ';
function validateGetExternalAPI(req: Request, res: Response, next: NextFunction) {
    const context = `${commonLog} validateGetExternalAPI]`;
    try {
        const { id, userid } = req.headers;
        if (id && !Array.isArray(id) && !ObjectID.isValid(id)) {
            throw BadRequest({
                status: false,
                code: 'invalid_id',
                message: 'Invalid id format',
            });
        }
        if (!userid) {
            throw ServerError({
                status: false,
                code: 'server_error',
                message: 'Internal Error',
            });
        }
        next();
    } catch (error) {
        if (!error.statusCode) console.error(`${context} Error `, error);
        errorResponse(res, error, context);
    }
}
export default { validateGetExternalAPI };
