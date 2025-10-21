/* eslint-disable no-underscore-dangle */
/* eslint-disable import/no-relative-packages */
import { captureException, captureMessage } from '@sentry/node';
import GroupCSUsers from '../models/groupCSUsers';
import { IUserDocument } from '../interfaces/users.interface';
const commonLog = '[Controller groupCSUser';

async function updateNameGroupCSUsers(user) {
    const context = `${commonLog} updateNameGroupCSUsers]`;
    try {
        const query = {
            'listOfUsers.userId': user._id,
        };

        const newValues = {
            $set: { 'listOfUsers.$.name': user.name },
        };

        const result = await GroupCSUsers.updateMany(query, newValues);
        if (!result.ok) {
            console.error(
                `${context} Error - Fail to GroupCSUsers of user ${user._id}`,
                query,
                newValues
            );
            captureMessage(`Fail to GroupCSUsers of user ${user._id}`);
        } else console.log(` ${context} - Updated GroupCSUsers ${user._id}`);
    } catch (err) {
        console.error(`${context} Error `, err.message);
        captureException(err);
    }
}

async function updateDataGroupCSUsers(user : IUserDocument) {
    const context = `${commonLog} updateDataGroupCSUsers]`;
    try {
        const query = {
            'listOfUsers.userId': user._id,
        };

        const newValues = {
            $set: {
                'listOfUsers.$.name': user.name,
                'listOfUsers.$.mobile': user.mobile,
                'listOfUsers.$.internationalPrefix': user.internationalPrefix,
            },
        };

        const result = await GroupCSUsers.updateMany(query, newValues);
        if (!result.ok) {
            console.error(
                `${context} Error - Fail to GroupCSUsers of user ${user._id}`,
                query,
                newValues
            );
            captureMessage(`Fail to GroupCSUsers of user ${user._id}`);
        } else console.log(` ${context} - Updated GroupCSUsers ${user._id}`);
    } catch (err) {
        console.error(`${context} Error `, err.message);
        captureException(err);
    }
}

export default { updateNameGroupCSUsers, updateDataGroupCSUsers };
