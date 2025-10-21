import axios from "axios";
import Charger from '../../models/charger';
const { findOneGroupCSUser } = require('evio-library-identity').default;
import { PlugTariff } from './tariff.types';
import { FilterQuery, UpdateQuery } from 'mongoose';
import Constants from '../../utils/constants'

interface GroupCSUserMap {
    userId: string;
}

const getGroupsCSUsersMap = async (userId: string): Promise<GroupCSUserMap[]> => {
    const context = '[ChargerV2Controller _getGroupsCSUsersMap]';

    try {
        const headers = { userid: userId };
        const host = Constants.hosts.users + Constants.paths.groupCSUsersMap;

        const response = await axios.get(host, { headers });

        if (!response || !response.data) {
            console.error(`${context} No data returned from ${host}`);
            return [];
        }

        return response.data as GroupCSUserMap[];

    } catch (error: any) {
        console.error(`${context} Error fetching groups for user ${userId}:`, error.message);
        return [];
    }
};

function chargerFindOne(query) {
    const context = "Function chargerFindOne";

    const chargerFound = Charger.findOne(query);
    if(!chargerFound){
        console.error(`[${context}] Error finding charger`);
    }

    return chargerFound
}

export async function getLowestTariff(tariffFound: { tariffId: string }[]): Promise<{ tariffId: string } | undefined> {
    const context = "Function getLowestTariff";

    try {
        const tariffIds = tariffFound.map(t => t.tariffId);
        const url = Constants.hosts.tariffs + Constants.paths.multiTariffById;
        const response = await axios.get(url, { params: { _id: tariffIds } });

        const tariffs = response.data as any[];

        if (tariffs.length === 0) return undefined;

        const lowestTariffId = tariffs.reduce((lowest, current) =>
            current?.tariff?.chargingAmount?.value < lowest?.tariff?.chargingAmount?.value ? current : lowest
        )._id;

        return tariffFound.find(t => t.tariffId === lowestTariffId);
    } catch (error: any) {
        console.error(`[${context}][axios.get][.catch] Error: ${error.message}`);
        throw error;
    }
}

export const getChargerTariff = async (userId: string, hwId: string, plugId: string): Promise<{ status: number, data: PlugTariff | any }> => {
    const context = 'getChargerTariffService';

    const query = {
        hwId: hwId,
        hasInfrastructure: true,
        active: true,
        operationalStatus: { $ne: Constants.operationalStatus.removed }
    };

    try {
        const groups = await getGroupsCSUsersMap(userId);
        const charger = await chargerFindOne(query);

        if (charger.accessType === Constants.chargerAccess.private && charger.createUser === userId) {
            return {
                status: 200,
                data: { groupName: 'Private', groupId: '', tariffId: '-1' }
            };
        } else if (charger.accessType === Constants.chargerAccess.freeCharge) {
            return {
                status: 200,
                data: { groupName: 'FreeCharge', groupId: '', tariffId: '-1' }
            };
        } else if (charger.accessType === Constants.chargerAccess.private) {
            return {
                status: 400,
                data: { auth: false, code: 'server_error_not_authorized', message: 'Not authorized to start charging' }
            };
        }

        const plug = charger.plugs.find((p: any) => p.plugId === plugId);
        if (!plug) {
            return {
                status: 400,
                data: { auth: false, code: 'server_error_plug_not_found', message: "Plug not found for given parameters" }
            };
        }

        if (charger.listOfGroups.length === 0) {
            const publicTariff = plug.tariff.find((t: any) => t.groupName === Constants.chargerAccess.public);
            return { status: 200, data: publicTariff };
        }

        const tariffs: (PlugTariff | undefined)[] = await Promise.all(
            groups.map(group => {
                return plug.tariff.find((t: PlugTariff) => t.groupId === group.userId);
            })
        );

        const validTariffs: PlugTariff[] = tariffs.filter((t): t is PlugTariff => !!t);

        if (validTariffs.length === 0) {
            if (charger.accessType === Constants.chargerAccess.public) {
                const publicTariff = plug.tariff.find((t: PlugTariff) =>
                    t.groupName === Constants.chargerAccess.public
                );
                return { status: 200, data: publicTariff };
            } else {
                return {
                    status: 400,
                    data: { auth: false, code: 'server_error_not_authorized', message: 'Not authorized to start charging' }
                };
            }
        } else if (validTariffs.length === 1) {
            return { status: 200, data: validTariffs[0] };
        } else {
            const bestTariff = await getLowestTariff(validTariffs);
            return { status: 200, data: bestTariff };
        }

    } catch (error: any) {
        console.error(`[${context}] Error:`, error.message);
        throw error;
    }
};

export async function getTariffs(tariffs: PlugTariff[]): Promise<PlugTariff[]> {
    const context = "Function getTariffs";

    if (tariffs.length === 0) return tariffs;

    try {
        await Promise.all(
            tariffs.map(async (tariff) => {
                if (!tariff.tariffId) {
                    if (
                        [Constants.chargerAccess.public, Constants.chargerAccess.private, Constants.chargerAccess.freeCharge].includes(tariff.groupName)
                    ) {
                        return;
                    }

                    const group = await findOneGroupCSUser({ _id: tariff.groupId });
                    if (group?.imageContent) {
                        tariff.imageContent = group.imageContent;
                    }
                    return;
                }

                if (tariff.groupName === Constants.chargerAccess.private) {
                    return;
                }

                if (tariff.groupName === Constants.chargerAccess.public) {
                    const url = Constants.hosts.tariffs + Constants.paths.getTariff;
                    const response = await axios.get(url, { data: { _id: tariff.tariffId } });
                    const tariffFound = response.data;
                    tariff.name = tariffFound.name;
                    tariff.min_price = tariffFound.min_price
                    tariff.max_price = tariffFound.max_price
                    tariff.type = tariffFound.type
                    tariff.currency = tariffFound.currency
                    tariff.elements = tariffFound.elements
                    return;
                }

                const group = await findOneGroupCSUser({ _id: tariff.groupId });
                if (group?.imageContent) {
                    tariff.imageContent = group.imageContent;
                }

                const url = Constants.hosts.tariffs + Constants.paths.getTariff;
                const response = await axios.get(url, { data: { _id: tariff.tariffId } });
                const tariffFound = response.data;
                tariff.name = tariffFound.name;
                tariff.min_price = tariffFound.min_price
                tariff.max_price = tariffFound.max_price
                tariff.type = tariffFound.type
                tariff.currency = tariffFound.currency
                tariff.elements = tariffFound.elements
            })
        );

        return tariffs;
    } catch (error: any) {
        console.error(`[${context}] Error:`, error.message);
        throw error;
    }
}

export async function updateCharger(
    query: FilterQuery<any>,
    values: UpdateQuery<any>
): Promise<boolean> {
    try {
        const result = await Charger.findOneAndUpdate(query, values, { new: true });
        return result;
    } catch (error: any) {
        console.error('[updateCharger] Error:', error.message);
        throw error;
    }
}

export const updateChargerTariff = async (
    chargerId: string,
    plugId: string,
    newTariffsInput: PlugTariff[]
): Promise<any> => {
    const context = 'updateChargerTariff';

    try {
        const charger = await chargerFindOne({ _id: chargerId });

        if (!charger) {
            return {
                status: 400,
                data: {
                    auth: false,
                    code: 'server_error_charger_not_found',
                    message: 'Charger not found for given parameters'
                }
            };
        }

        const plug = charger.plugs.find((p: any) => p.plugId === plugId);

        if (!plug) {
            return {
                status: 400,
                data: { auth: false, code: 'server_error_plug_not_found', message: 'Plug not found for given parameters' }
            };
        }

        if (plug.tariff.length !== newTariffsInput.length) {
            return {
                status: 400,
                data: {
                    auth: false,
                    code: 'server_error_different_size_tariff',
                    message: 'Different tariff list size than what is in the plug'
                }
            };
        }

        const formattedTariffs = await getTariffs(newTariffsInput);

        const updateQuery = {
            _id: chargerId,
            active: true,
            hasInfrastructure: true,
            'plugs.plugId': plugId
        };

        const updateData = {
            $set: {
                'plugs.$.tariff': formattedTariffs
            }
        };

        const updateResult = await updateCharger(updateQuery, updateData);

        if (!updateResult) {
            return {
                status: 400,
                data: { auth: false, code: 'server_error_update_unsuccessfully', message: 'Update has not been successful' }
            };
        }

        const updatedCharger = await chargerFindOne({
            _id: chargerId,
            active: true,
            hasInfrastructure: true
        });

        return updatedCharger;
    } catch (error: any) {
        console.error(`[${context}] Error:`, error.message);
        throw error;
    }
};
