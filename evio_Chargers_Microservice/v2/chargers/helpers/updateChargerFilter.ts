import Charger from '../../../models/charger';
import { FilterQuery, UpdateQuery } from 'mongoose';

export function updateChargerFilter(
    query: FilterQuery<any>,
    values: UpdateQuery<any>,
    options: { new: boolean }
): Promise<any> {
    const context = 'Function updateChargerFilter';

    return new Promise((resolve, reject) => {
        try {
            Charger.updateChargerFilter(query, values, options, (err: any, result: any) => {
                if (err) {
                    console.error(`[${context}][updateChargerFilter] Error`, err.message);
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        } catch (error: any) {
            console.error(`[${context}] Error`, error.message);
            reject(error);
        }
    });
}
