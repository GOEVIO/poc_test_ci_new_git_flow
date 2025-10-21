import { Request, Response, NextFunction } from 'express'
import { AlarmSchema } from './validation.schema'

export function validateAlarmMiddleware(
    req: Request, res: Response, next: NextFunction
) {
    const parsed = AlarmSchema.safeParse(req.body)

    if (!parsed.success) {
        console.error('Malformed alarm body', parsed.error.format())
        return res.status(400).send({
            message: 'Malformed alarm body',
            cause: parsed.error.format()
        })
    }

    return next()
}

export const validateAlarmUpdateMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const allowedFields = ['status'];
    const bodyFields = Object.keys(req.body);

    const invalidFields = bodyFields.filter(field => !allowedFields.includes(field));
    if (invalidFields.length > 0) {
        return res.status(400).json({
            message: `Only 'status' can be updated. Invalid field(s): ${invalidFields.join(', ')}`
        });
    }

    const { status } = req.body;

    if (!['read', 'unread'].includes(status)) {
        return res.status(400).json({
            message: "Invalid status value. Allowed values are 'read' or 'unread'."
        });
    }

    next();
};

export const validateBulkAlarmUpdateMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const { ids, status } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
            message: "'ids' must be a non-empty array."
        });
    }

    if (!['read', 'unread'].includes(status)) {
        return res.status(400).json({
            message: "Invalid status value. Allowed values are 'read' or 'unread'."
        });
    }

    next();
};

