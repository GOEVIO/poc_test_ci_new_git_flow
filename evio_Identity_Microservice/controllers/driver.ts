/* eslint-disable no-underscore-dangle */
/* eslint-disable import/no-relative-packages */
import { Request, Response } from 'express';
import { captureException, captureMessage } from '@sentry/node';
import Drivers from '../models/drivers';
import driversService from '../services/drivers';
import { BadRequest, errorResponse } from '../utils';
// interfaces
import { IUserDocument } from '../interfaces/users.interface';
import { IAddNewDriverPayload } from '../interfaces/drivers.interface';

const commonLog = '[Controller driver';

async function updateNameDrivers(user) {
    const context = `${commonLog} updateNameDrivers]`;
    try {
        const query = {
            'poolOfDrivers.driverId': user._id,
        };

        const newValues = {
            $set: { 'poolOfDrivers.$.name': user.name },
        };

        const result = await Drivers.updateMany(query, newValues);

        if (!result.ok) {
            console.error(
                `${context} Error - Fail to update Driver ${user._id}`,
                query,
                newValues
            );
            captureMessage(`Fail to update Driver ${user._id}`);
        } else console.log(` ${context} - Updated Driver ${user._id}`);
    } catch (err) {
        console.error(`${context} Error `, err.message);
        captureException(err);
    }
}

const addNewDrivers = async (req: Request, res: Response) => {
    const context = `${commonLog} addNewDrivers]`;
    try {
        const {
            clientname: clientName,
            userid: userId
        } = <{clientname: string, userid: string}>req.headers;
        const { drivers } = <IAddNewDriverPayload>req.body;

        const pullDrivers = await driversService.addNewDrivers(drivers, userId, clientName);
        return res.status(201).send(pullDrivers);
    } catch (error) {
        return errorResponse(res, error, context);
    }
};

async function updateDataDrivers(user:IUserDocument) {
    const context = `${commonLog} updateDataDrivers]`;
    try {
        const query = {
            'poolOfDrivers.driverId': user._id,
        };

        const newValues = {
            $set: {
                'poolOfDrivers.$.name': user.name,
                'poolOfDrivers.$.mobile': user.mobile,
                'poolOfDrivers.$.internationalPrefix': user.internationalPrefix,
            },
        };

        const result = await Drivers.updateMany(query, newValues);

        if (!result.ok) {
            console.error(
                `${context} Error - Fail to update Driver ${user._id}`,
                query,
                newValues
            );
            captureMessage(`Fail to update Driver ${user._id}`);
        } else console.log(` ${context} - Updated Driver ${user._id}`);
    } catch (err) {
        console.error(`${context} Error `, err.message);
        captureException(err);
    }
}

const getDrivers = async (req: Request, res: Response) => {
    const context = `${commonLog} getDrivers]`;
    try {
        const userId = <string>req.headers.userid;
        if (!userId) throw BadRequest({ auth: false, code: 'server_user_id_required', message: 'User id is required' });

        const pullDrivers = await driversService.getDrivers(userId);
        return res.status(200).send(pullDrivers);
    } catch (error) {
        return errorResponse(res, error, context);
    }
};

export default {
    updateNameDrivers,
    updateDataDrivers,
    addNewDrivers,
    getDrivers
};
