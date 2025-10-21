/* eslint-disable no-underscore-dangle */
/* eslint-disable import/no-relative-packages */
import { captureException,captureMessage } from '@sentry/node';
import GroupDrivers from '../models/groupDrivers';
//interfaces
import { IUserDocument } from '../interfaces/users.interface';
const commonLog = '[groupDriver driver';

async function updateNameGroupDrivers(user) {
    const context = `${commonLog} updateNameGroupDrivers]`;
    try {
        const query = {
            'listOfDrivers.driverId': user._id,
        };

        const newValues = {
            $set: { 'listOfDrivers.$.name': user.name },
        };

        const result = await GroupDrivers.updateMany(query, newValues);
        if (!result.ok) {
            console.error(
                `${context} Error - Fail to update GroupDrivers of driver ${user._id}`,
                query,
                newValues
            );
            captureMessage(`Fail to update GroupDrivers of driver ${user._id}`);
        } else console.log(`Updated GroupDrivers of driver ${user._id}`);
    } catch (err) {
        console.error(`${context} Error `, err.message);
        captureException(err);
    }
}

async function getGroupDriversByUserId(userId: string, fields: string[] = ['_id']) {
    const filter = {
        $and: [
            {
                listOfDrivers: {
                    $elemMatch: {
                        driverId: userId
                    }
                }
            },
            {
                createUser: {
                    $ne: userId
                }
            }
        ]
    };

    return GroupDrivers.find(filter).select(fields);
}

async function updateDataGroupDrivers(user: IUserDocument) {
    const context = `${commonLog} updateDataGroupDrivers]`;
    try {
        const query = {
            'listOfDrivers.driverId': user._id,
        };

        const newValues = {
            $set: {
                'listOfDrivers.$.name': user.name,
                'listOfDrivers.$.mobile': user.mobile,
                'listOfDrivers.$.internationalPrefix': user.internationalPrefix,
            },
        };

        const result = await GroupDrivers.updateMany(query, newValues);
        if (!result.ok) {
            console.error(
                `${context} Error - Fail to update GroupDrivers of driver ${user._id}`,
                query,
                newValues
            );
            captureMessage(`Fail to update GroupDrivers of driver ${user._id}`);
        } else console.log(`Updated GroupDrivers of driver ${user._id}`);
    } catch (err) {
        console.error(`${context} Error `, err.message);
        captureException(err);
    }
}

export default { updateNameGroupDrivers, updateDataGroupDrivers, getGroupDriversByUserId };
