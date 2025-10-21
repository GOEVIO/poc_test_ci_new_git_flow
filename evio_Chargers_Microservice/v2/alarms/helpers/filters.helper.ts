import { Request, Response, NextFunction } from 'express';

type AlarmSortFields = 'timestamp' | 'type' | 'status' | 'hwId' | 'userId';

const allowedFields: Record<string, string> = {
    timestamp: 'timestamp',
    type: 'type',
    status: 'status',
    hwId: 'hwId',
    userId: 'userId',
};

function toOrder(order?: string): 1 | -1 {
    return order === 'desc' ? -1 : 1;
}

export function parseGetAlarmsFiltersAndSort(
    req: Request,
    _res: Response,
    next: NextFunction
) {
    const {
        startDate,
        endDate,
        type,
        status,
        userId,
        hwId,
        sort = 'timestamp',
        order = 'desc',
    } = req.query;

    const filters: any = {};
    const sortField = allowedFields[sort as string] || 'timestamp';

    if (startDate || endDate) {
        filters.timestamp = {};
        if (startDate) filters.timestamp.$gte = new Date(String(startDate));
        if (endDate) filters.timestamp.$lte = new Date(String(endDate));
    }

    if (type) filters.type = type;
    if (status) filters.status = status;
    if (userId) filters.userId = userId;
    if (hwId) filters.hwId = hwId;

    req.query['_filters'] = filters;
    req.query['_sort'] = sortField;
    req.query['_order'] = String(toOrder(String(order)));

    return next();
}
