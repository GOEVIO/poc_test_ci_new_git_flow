import { captureException, captureMessage } from '@sentry/node';
import redisConnection from 'evio-redis-connection/dist';

// Interfaces
import { IUserDocument } from '../interfaces/users.interface';
import { IContract } from '../interfaces/contracts.interface';
import { IHeaders } from '../interfaces/headers.interface';
import { TokenStatusChangeHistoryEntry } from '../interfaces/contracts.interface';
// Services
import gireveService from '../services/gireve';
import mobieService from '../services/mobie';
// DB
import Contract from '../models/contracts';

// Constants
import env from '../constants/env';
import userUtils from '../utils/users';

//Controllers
import { validateUserPerClientName } from '../auth/auth';
// ENUM
import { TokenStatusChangeReason } from '../utils/enums/TokenStatusChangeReason';

const ALLOWED_ACTIVATION_REASONS = new Set([
    TokenStatusChangeReason.AccountDeletionRequested,
    TokenStatusChangeReason.DebtIncurred,
]);

const commonLog = '[Service contracts';

export async function deleteCachedContractsByUser(userId: string) {
    const cacheKey = `contracts:${userId}`;
    try {
        console.log(`[${commonLog} deleteCachedContractsByUser ] Deleting cache for userId=${userId}`, { userId });
        await redisConnection.delete(cacheKey);
    } catch (error) {
        console.log(`[${commonLog} deleteCachedContractsByUser ] Error `, error.message);
        captureException(error);
    }
}

export async function getCachedContractsByUser(userId: string) {
    const cacheKey = `contracts:${userId}`;
    // TODO: add interface for this one
    let result;

    try {
        console.log(`[${commonLog} getContractsByUser ] Getting contracts from cache to userId=${userId}`, { userId });
        const cacheValue = await redisConnection.get(cacheKey);
        if (cacheValue) {
            result = JSON.parse(cacheValue);
            console.log(`[${commonLog} getContractsByUser ] Returning ${result.length} cached contracts for userId=${userId}`, { userId });
        }

        return result;
    } catch (error) {
        captureException(error);
        return result;
    }
}

// TODO: add interface for contractsData
export async function createCacheContractsByUser(userId: string, contractsData: any) {
    try {
        console.log(`[${commonLog} createCacheContractsByUser] Creating cache for userId=${userId}`, { userId, contractsData });
        const cacheKey = `contracts:${userId}`;
        await redisConnection.set(cacheKey, JSON.stringify(contractsData));
    } catch (error) {
        console.log(`[${commonLog} createCacheContractsByUser] Error `, error.message);
        captureException(error);
    }
}

export async function updateEmailContract(user: IUserDocument) {
    const context = `${commonLog} updateEmailContract ]`;
    try {
        const query = { userId: user._id };

        const newValues = {
            $set: { email: user.email },
        };

        const result = await Contract.updateMany(query, newValues);
        if (!result.ok) {
            console.error(
                `[${context}] Error - Fail to update Contract of driver ${user._id}`,
                query,
                newValues
            );
            captureMessage(`Fail to update Contract of driver ${user._id}`);
        } else console.log(`Contract Updated of user ${user._id}`);
    } catch (err) {
        console.error(`${context} Error `, err.message);
        captureException(err);
    }
}

export async function updateUserDataContract(user: IUserDocument) {
    const context = `${commonLog} updateUserDataContract ]`;
    try {
        const queryName = {
            userId: user._id,
            contractType: env.ContractType.ContractTypeFleet,
        };

        const newValuesName = {
            $set: {
                name: user.name,
                email: user.email,
                mobile: user.mobile,
                internationalPrefix: user.internationalPrefix,
            },
        };

        const name = user.name.split(' ');

        const queryCardName = {
            userId: user._id,
            contractType: env.ContractType.ContractTypeUser,
        };

        const newValuesCardName = {
            $set: {
                name: user.name,
                cardName: userUtils.getCardName(name),
                email: user.email,
                mobile: user.mobile,
                internationalPrefix: user.internationalPrefix,
            },
        };

        const [resultName, resultCardName] = await Promise.all([
            Contract.updateMany(queryName, newValuesName),
            Contract.updateMany(queryCardName, newValuesCardName),
        ]);
        if (!resultName.ok || !resultCardName.ok) {
            console.error(
                `${resultName} Error - Contracts of user ${user._id} not updated`
            );
            captureMessage(`Contracts of user ${user._id} not updated`);
        }
        console.log(`Contracts of user ${user._id} updated`);
    } catch (err) {
        console.error(`${context} Error `, err.message);
        captureException(err);
    }
}

export async function updateNameContract(user: IUserDocument) {
    const context = `${commonLog} updateNameContract ]`;
    try {
        const queryName = {
            userId: user._id,
            contractType: env.ContractType.ContractTypeFleet,
        };

        const newValuesName = {
            $set: { name: user.name },
        };

        const name = user.name.split(' ');

        const queryCardName = {
            userId: user._id,
            contractType: env.ContractType.ContractTypeUser,
        };

        const newValuesCardName = {
            $set: {
                name: user.name,
                cardName: userUtils.getCardName(name),
            },
        };

        const [resultName, resultCardName] = await Promise.all([
            Contract.updateMany(queryName, newValuesName),
            Contract.updateMany(queryCardName, newValuesCardName),
        ]);
        if (!resultName.ok || !resultCardName.ok) {
            console.error(
                `${resultName} Error - Contracts of user ${user._id} not updated`
            );
            captureMessage(`Contracts of user ${user._id} not updated`);
        }
        console.log(`Contracts of user ${user._id} not updated`);
    } catch (err) {
        console.error(`${context} Error `, err.message);
        captureException(err);
    }
}

export async function updateContractStatusExternalNetworks(
    userId: string,
    isToActivate: boolean
): Promise<{ ok: boolean; code?: string; error?: string }> {
    const context = `${commonLog} updateContractStatusExternalNetworks ]`;
    try {
        console.info(`[${context}] | Starting process, isToActivate: ${isToActivate}`);
        const contractsFound = await Contract.find({ userId });
        if (contractsFound.length < 1) return { ok: true };

        await contractsFound.map(async (contract) => {
            console.info(`[${context}] | active: ${contract.active} | status: ${contract.status}`);

            const mobieActive: boolean = contract.networks.find((network) => {
                return network.tokens.find((token) => {
                    return (
                        network.network === env.networks.MobiE &&
                        token.tokenType === env.tokensTypes.AppUser &&
                        token.status !== env.networkStatus.NetworkStatusInactive
                    );
                });
            });

            const gireveActive: boolean = contract.networks.find((network) => {
                return network.tokens.find((token) => {
                    return (
                        network.network === env.networks.Gireve &&
                        token.tokenType === env.tokensTypes.AppUser &&
                        token.status !== env.networkStatus.NetworkStatusInactive
                    );
                });
            });
            let promises: Promise<void>[] = [];
            console.info(`[${context}] | mobieActive: ${mobieActive} | gireveActive: ${gireveActive}`);
            if (mobieActive) {
                promises.push(
                    isToActivate
                        ? mobieService.activeMobie(contract, userId, {
                            network: env.networks.MobiE,
                        })
                        : mobieService.inactiveMobie(contract, userId, {
                            network: env.networks.MobiE,
                        })
                );
            }

            if (gireveActive) {
                promises.push(
                    isToActivate
                        ? gireveService.activeGireve(contract, userId, {
                            network: env.networks.Gireve,
                        })
                        : gireveService.inactiveGireve(contract, userId, {
                            network: env.networks.Gireve,
                        })
                );
            }
            await Promise.all(promises);
        });
        return { ok: true };
    } catch (error) {
        console.error(`${context} Error `, error.message);
        return { ok: false, code: 'server_error', error: error.message };
    }
}

export async function handleExternalNetworkContracts(
    userId: string,
    isToActivate: boolean
): Promise<void> {
    const context = "Function handleExternalNetworkContracts";
    try {
        const contractsFound = await Contract.find({ userId });
        if (contractsFound.length < 1) return;

        const promises = contractsFound.flatMap((contract) => {
            const actions: Promise<void>[] = [];

            actions.push(
                isToActivate
                    ? mobieService.activeMobie(contract, userId, { network: env.networks.MobiE })
                    : mobieService.inactiveMobie(contract, userId, { network: env.networks.MobiE })
            );

            actions.push(
                isToActivate
                    ? gireveService.activeGireve(contract, userId, { network: env.networks.Gireve })
                    : gireveService.inactiveGireve(contract, userId, { network: env.networks.Gireve })
            );

            return actions;
        });

        await Promise.all(promises);
    } catch (error) {
        console.error(`[${context}] Error`, error.message);
    }
}

function validateContract(contract: IContract, headers: IHeaders) {
    if (contract.cardPhysicalLicensePlate && contract.cardPhysicalLicensePlate.length > 30) {
        return { auth: false, code: 'cardPhysicalLicensePlate_length_exceeded', message: 'cardPhysicalLicensePlate should not exceed 30 characters.' };
    }

    if (contract.cardPhysicalText && contract.cardPhysicalText.length > 15) {
        return { auth: false, code: 'cardPhysicalText_length_exceeded', message: 'cardPhysicalText should not exceed 15 characters.' };
    }

    if (contract.cardPhysicalName && contract.cardPhysicalName.length > 30) {
        return { auth: false, code: 'cardPhysicalName_length_exceeded', message: 'cardPhysicalName should not exceed 30 characters.' };
    }

    if (!validateUserPerClientName(headers)) {
        return {
            auth: false,
            code: "action_not_allowed",
            message: "Action not allowed",
        };
    }

    return null;
}

/**
 * Fetch contracts by userId.
 * @param userId - The ID of the user whose contracts will be fetched.
 * @returns A promise with the list of contracts or an empty array.
 */
async function getContractsByUserId(userId: string): Promise<IContract[]> {
    const context = "getContractsByUserId";
    try {
        const contracts = await Contract.find({ userId });
        return contracts;
    } catch (error) {
        console.error(`[${context}] Error`, error);
        throw error;
    }
}

export async function updateTokenStatusByUserId(
    userId: string,
    newStatus: 'active' | 'inactive',
    reason: TokenStatusChangeReason
): Promise<void> {
    const context = 'updateTokenStatusByUserId';

    try {
        console.info(`[${context}] Starting process for userId: ${userId} with newStatus: ${newStatus} and reason: ${reason}`);

        const contracts = await Contract.find({ userId, active: true });

        if (!contracts.length) {
            console.warn(`[${context}] No active contracts found for userId: ${userId}`);
            return;
        }

        for (const contract of contracts) {
            const networks = contract.networks || [];

            for (const network of networks) {
                const tokens = network.tokens || [];

                for (const token of tokens) {
                    token.tokenStatusHistory = token.tokenStatusHistory || [];
                    const history = token.tokenStatusHistory;

                    //Always record the status change history immediately
                    const statusBefore = token.status;
                    token.tokenStatusHistory.push({
                        previousStatus: statusBefore,
                        newStatus,
                        updatedAt: new Date(),
                        reason,
                    });
                    console.info(`[${context}] Added history for token ${token.idTagHexa}: ${statusBefore} -> ${newStatus} (${reason})`);

                    //Check the blocking conditions with the updated history
                    const wasBlockingCleared = (
                        requestReason: TokenStatusChangeReason,
                        cancelReason: TokenStatusChangeReason
                    ): boolean => {
                        let cancelSeen = false;

                        for (let i = history.length - 1; i >= 0; i--) {
                            const entry = history[i];

                            if (entry.reason === cancelReason) {
                                cancelSeen = true;
                            }

                            if (entry.reason === requestReason) {
                                return cancelSeen;
                            }
                        }

                        return false;
                    };

                    const isDeletionCleared = wasBlockingCleared(
                        TokenStatusChangeReason.AccountDeletionRequested,
                        TokenStatusChangeReason.AccountDeletionCanceled
                    );

                    const isDebtCleared = wasBlockingCleared(
                        TokenStatusChangeReason.DebtIncurred,
                        TokenStatusChangeReason.DebtCleared
                    );

                    // Check if both blocking types exist in history
                    const hasDeletionRequested = history.some(entry => entry.reason === TokenStatusChangeReason.AccountDeletionRequested);
                    const hasDebtIncurred = history.some(entry => entry.reason === TokenStatusChangeReason.DebtIncurred);

                    const shouldApplyBlockingRules = hasDeletionRequested && hasDebtIncurred;
                    const blocking = shouldApplyBlockingRules ? !(isDeletionCleared && isDebtCleared) : false;

                    let shouldUpdate = false;

                    if (newStatus === 'active') {
                        if (!blocking) {
                            shouldUpdate = true;
                        } else {
                            console.info(`[${context}] Token ${token.idTagHexa} not activated due to unresolved blocks. Blocking=${blocking}, reason=${reason}`);
                        }
                    } else {
                        shouldUpdate = true;
                    }

                    //Update the token status if needed
                    if (shouldUpdate && statusBefore !== newStatus) {
                        token.status = newStatus;
                        console.info(`[${context}] Token ${token.idTagHexa} status updated to ${newStatus} with reason ${reason}`);
                    } else {
                        console.info(`[${context}] Token ${token.idTagHexa} status not updated (kept as ${statusBefore})`);
                    }
                }
            }

            await contract.save();
            console.info(`[${context}] Saved contract ${contract._id}`);
        }

        console.info(`[${context}] Finished processing for userId: ${userId}`);
    } catch (error) {
        console.error(`[${context}] Error during token update`, error);
        throw error;
    }
}

export default {
    updateEmailContract,
    updateNameContract,
    updateUserDataContract,
    updateContractStatusExternalNetworks,
    handleExternalNetworkContracts,
    validateContract,
    getCachedContractsByUser,
    createCacheContractsByUser,
    deleteCachedContractsByUser,
    getContractsByUserId,
    updateTokenStatusByUserId
};
