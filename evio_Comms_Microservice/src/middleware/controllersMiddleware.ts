import { NextFunction, Request, Response } from 'express';
// Utils
import { errorResponse } from '../utils/errorHandling';

const commonLog = '[ middleware controllersMiddleware ';

function validatePublishTopic(req: Request, res: Response, next: NextFunction) {
    const context = `${commonLog} validatePublishTopic] `;
    try {
        if (!req.body) return res.status(400).send({ auth: false, code: 'missing_body', message: `Missing body in request` });

        const {
            controllerId,
            variables,
            deviceId,
        }: { controllerId: string; variables: Array<{ variable: string; value: string }>; deviceId: string } = req.body;
        if (!controllerId) return res.status(400).send({ auth: false, code: 'missing_controllerId', message: `Missing controller in request` });

        if (!variables || variables.length < 1)
            return res.status(400).send({ auth: false, code: 'missing_variables', message: `Missing variables in request` });

        if (variables.some((variable) => !variable.variable || !variable.value))
            return res.status(400).send({ auth: false, code: 'missing_variable', message: `Missing variable or value in request` });

        if (!deviceId) return res.status(400).send({ auth: false, code: 'missing_deviceId', message: `Missing deviceId in request` });
        next();
    } catch (error) {
        console.error(`${context} validatePublishTopic Error `, error.message);
        return errorResponse(res, error, `${req.method} ${req.path}`);
    }
}

export default {
    validatePublishTopic,
};
