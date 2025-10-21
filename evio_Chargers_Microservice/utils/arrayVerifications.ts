
import { ObjectId as ObjectID } from 'mongodb';
import { captureException } from '@sentry/node';

const commomLog = '[ Utils arrayVerifications ';

export function isArrayIdsInvalid(arrayOfIds: string[]): boolean {
    const context = `${commomLog} isarrayIdsValid ]`;
    try {
        if (!Array.isArray(arrayOfIds)) {
            console.error(`${context} Error - Invalid arrayOfIds `, arrayOfIds);
            return false;
        }
        return arrayOfIds.some((id) => !ObjectID.isValid(id));
    } catch (error) {
        console.error(`${context} Error `, error.message);
        captureException(error);
        return false;
    }
}
