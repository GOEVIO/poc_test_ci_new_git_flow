import { Request, Response } from 'express';
import { createAlarm, updateAlarmStatus, getAlarms, updateMultipleAlarmsStatusService } from '../services/alarms.service';
import { IAlarm } from '../interfaces/alarms.interface';
import Sentry from '@sentry/node';

export const createAlarms = async (req: Request, res: Response) => {
    try {
        const alarm: IAlarm = req.body;

        const createdAlarm = await createAlarm(alarm);

        return res.status(201).json(createdAlarm);
    } catch (error) {
        console.error('Failed to create alarm:', error);
        Sentry.captureException(error);
        return res.status(500).send({
            auth: false,
            code: 'internal_server_error',
            message: "Internal server error"
        });
    }
};

export const updateAlarm = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const updated = await updateAlarmStatus(id, status);
        if (!updated) {
            return res.status(404).send({
                auth: false,
                code: 'server_error_alarm_not_found',
                message: 'Alarm not found',
            });
        }

        return res.status(200).json(updated);
    } catch (error) {
        console.error('Failed to update alarm status:', error);
        Sentry.captureException(error);
        return res.status(500).send({
            auth: false,
            code: 'internal_server_error',
            message: 'Internal server error',
        });
    }
};

export const getAllAlarms = async (req: Request, res: Response) => {
    try {
        const filters = req.query['_filters'] as Record<string, any>;
        const sort = req.query['_sort'] as string;
        const order = parseInt(req.query['_order'] as string) as 1 | -1;

        const alarms = await getAlarms(filters, sort, order);

        return res.status(200).json(alarms);
    } catch (error) {
        console.error('Failed to fetch alarms:', error);
        Sentry.captureException(error);
        return res.status(500).send({
            auth: false,
            code: 'internal_server_error',
            message: 'Internal server error',
        });
    }
};

export const updateMultipleAlarmsStatus = async (req: Request, res: Response) => {
    try {
        const { ids, status } = req.body;

        if (!Array.isArray(ids) || !status) {
            return res.status(400).send({
                auth: false,
                code: 'bad_request',
                message: 'Request body must contain ids (array) and status',
            });
        }

        const result = await updateMultipleAlarmsStatusService(ids, status);

        if (result.n === 0) {
            return res.status(404).send({
                auth: false,
                code: 'server_error_alarms_not_found',
                message: 'No alarms found for the provided IDs',
            });
        }

        return res.status(200).json({
            matchedCount: result.n,
            modifiedCount: result.nModified,
        });
    } catch (error) {
        console.error('Failed to update multiple alarm statuses:', error);
        Sentry.captureException(error);
        return res.status(500).send({
            auth: false,
            code: 'internal_server_error',
            message: 'Internal server error',
        });
    }
};
