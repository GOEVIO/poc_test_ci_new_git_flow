// Models
import Charger from '../models/charger';
import { retrieveCountryCodeByName } from 'evio-library-configs';
import { OcpiTariffDimenstionType } from 'evio-library-commons';
const commonLog = '[Chargers Service';

async function queryCharger(query, filter = {}) {
    let context = `${commonLog} Function queryCharger`;
    try {
        return await Charger.findOne(query, filter).lean();
    } catch (error) {
        console.error(`[${context}][find] Error `, error.message);
        throw new Error(error);
    }
}

async function getChargerByhwId(hwId, userId, plugId) {
    const context = `${commonLog} getChargerByhwId ]`;
    if (!hwId || !userId) {
        console.error(`${context} Error - Missing input data`, hwId, userId, plugId);
        throw new Error('Missing input data');
    }
    const filter = {
        'plugs.$': 1,
        energyManagementEnable: 1,
        energyManagementInterface: 1,
        _id: 1,
        controllerId: 1,
    };
    const query = plugId ? { hwId, 'plugs.plugId': plugId, createUser: userId } : { hwId, createUser: userId };
    return await queryCharger(query, filter);
}

async function updateEnergyManagementPlugsSetPoints(hwId, userId, plugId, updateObject) {
    const context = `${commonLog} updateEnergyManagementPlugsSetpoints ]`;

    if (!hwId || !userId || !plugId || !updateObject) {
        console.error(`${context}Error - Missing input data`, hwId, userId, plugId, updateObject);
        throw new Error('Missing input data');
    }
    const query = { hwId, 'plugs.plugId': plugId, createUser: userId };
    const update = await Charger.updateOne(query, { $set: updateObject });
    if (!update.nModified) {
        console.error(`${context}- Error - Fail to update charger ${hwId}`, update);
        throw new Error('Fail to update charger');
    }
    return true;
}

export const ensureCountryCode = async (address, context) => {
    if (!address.countryCode && address.country) {
        try {
            const countryCode = await retrieveCountryCodeByName(address.country);
            if (countryCode) return { ...address, countryCode };

            console.warn(`[${context}] No countryCode found for country: ${address.country}`);
        } catch (error) {
            console.error(`[${context}] Error fetching countryCode for ${address.country}:`, error.message);
        }
    } else if (!address.country) {
        console.warn(`[${context}] address.country is missing. Cannot determine countryCode.`);
    }

    return address;
};

export function matchPriceComponent(type: OcpiTariffDimenstionType) : any {
    return {
        tariff: {
            $elemMatch: {
                elements: {
                    $elemMatch: {
                        price_components: {
                            $elemMatch: {
                                type: type
                            }
                        }
                    }
                }
            }
        }
    }
}
export default {
    getChargerByhwId,
    updateEnergyManagementPlugsSetPoints,
};
