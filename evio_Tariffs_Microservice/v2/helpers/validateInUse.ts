import Constants from '../../utils/constants';
import axios from 'axios';
const { Enums } = require('evio-library-commons').default;

export function validateInUse(tariffId: string): Promise<boolean> {
    const context = 'Function validateInUse';

    return new Promise((resolve, reject) => {
        try {
            const host = Constants.chargers.host + Constants.chargers.paths.chargingSessionValidateTariff;

            const params = {
                tariffId: tariffId,
                statusList: [
                    Enums.OcppSessionStatuses.sessionStatusToStart,
                    Enums.OcppSessionStatuses.sessionStatusRunning,
                    Enums.OcppSessionStatuses.sessionStatusToStop,
                ],
            };

            axios.get(host, { params })
                .then((result) => {
                    if (!result.data || result.data.length === 0) {
                        resolve(false);
                    } else {
                        resolve(true);
                    }
                })
                .catch((error) => {
                    console.error(`[${context}] Error`, error.message);
                    reject(error);
                });
        } catch (error: any) {
            console.error(`[${context}] Error`, error.message);
            reject(error);
        }
    });
}
