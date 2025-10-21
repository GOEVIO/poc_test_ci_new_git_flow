/* eslint-disable no-underscore-dangle */
/* eslint-disable import/no-relative-packages */
import { captureMessage } from '@sentry/node';
import { Request, Response } from 'express';
//DB
import Contract from '../models/contracts';
import User from '../models/user';
// Utils
import { BadRequest, errorResponse, ServerError } from '../utils/errorHandling';
import { ReasonForBlockUser } from '../utils/enums/ReasonForBlockUser';
import { ReasonForUnblockUser } from '../utils/enums/ReasonForUnblockUser';
// Enums
import userBlockReasonEnum from '../enums/blockUsersReasons.enum';
//Constants
import Constants from '../utils/constants';
// Services
import contractsServices from '../services/contracts';
import paymentsServices from '../services/payments';
import usersService from '../services/users';
//Interfaces
import { IContract } from '../interfaces/contracts.interface';
import { IHeaders } from '../interfaces/headers.interface';
//Handlers from older code base
import * as ContractHandler from './contracts.js';
import { DeletionReason } from '../enums/deletionReason';
import TokenStatusService from '../services/tokenStatus.service';
import { TokenStatusChangeReason } from '../utils/enums/TokenStatusChangeReason';
import toggle from 'evio-toggle';

const commonLog = '[Controller contract';

async function deactivateContracts(req: Request, res: Response) {
    const context = `${commonLog} deactivateContracts ]`;
    try {
        const { reason } = req.body;
        const { userId } = req.params;

        const message = userBlockReasonEnum[reason];
        if (!message) {
            console.error(`${context} Error - Invalid reason ${message}`);
            captureMessage(`Invalid reason ${reason}`);
            return errorResponse(
                res,
                ServerError('reason is not part of userBlockReasonEnum'),
                context
            );
        }

        const user = await User.findById({ _id: userId }, { _id: 1 });
        if (!user)
            return errorResponse(
                res,
                BadRequest({
                    auth: false,
                    code: 'server_user_not_found',
                    message: 'User not found',
                }),
                context
            );

        const featureFlagEnabled = await toggle.isEnable('fleet-363-deactivate-and-activate-contracts');

        if (featureFlagEnabled) {
            const tokenStatusService = new TokenStatusService(); 
            const tokensUpdated = await tokenStatusService.switchReasonByUserId({
                userId,
                reason: TokenStatusChangeReason.BackofficeDeactivatedUser,
                activeBlock: true,
                requestUserId: userId,
            });

            if (!tokensUpdated) {
                console.error(`[${context}] | Error updating token status for user: ${userId}`);
                return errorResponse(
                    res,
                    BadRequest({
                        auth: false,
                        code: 'server_error',
                        message: 'Tokens not updated',
                    }),
                    context
                );
            }
            // If tokens are updated, we can proceed to deactivate contracts
            await User.blockUser(userId, ReasonForBlockUser.FleetManagerBlocked);
        }
        else {
            const data = {
                userId,
                message: {
                    key: message,
                },
            };
            await Promise.all([
                Contract.markAllAsInactive(data),
                User.blockUser(userId, ReasonForBlockUser.FleetManagerBlocked, () => {}),
            ]);
            
            contractsServices.updateContractStatusExternalNetworks(userId, false);
        }

        return res.status(204).send();
    } catch (error) {
        console.error(`${context} Error `, error.message);
        return errorResponse(res, error, context);
    }
}

async function activateContract(req: Request, res: Response) {
    const context = `${commonLog} activateContract ]`;
    try {
        const { userId } = req.params;
        const user = await User.findById(userId);
        if (!user)
            return errorResponse(
                res,
                BadRequest({
                    auth: false,
                    code: 'server_user_not_found',
                    message: 'User not found',
                }),
                context
            );
        // check if user has debts    
        if (await paymentsServices.isUserInDebt(userId)) {
            return errorResponse(
                res,
                BadRequest({
                    auth: false,
                    code: 'user_in_debt',
                    message: "User can't be unblock because it has debts",
                }),
                context
            );
        }
        // Handle account deletion request
        if (user.accountDeletionRequested) {
            const lastClearance = user.deletionClearance?.at(-1);
            const userRequestedDate = user.deletionClearance
                ?.filter(clearance => clearance.reason === DeletionReason.USER_REQUESTED)
                .at(-1)?.actionDate;

            if (lastClearance && !lastClearance.isCleared && lastClearance.reason === DeletionReason.USER_BLOCKED_DEBT && userRequestedDate) {
                await usersService.adjustDeletionCountdownAfterDebtClearance(
                    user,
                    lastClearance.actionDate,
                    userRequestedDate
                );
            }
        }

        const featureFlagEnabled = await toggle.isEnable('fleet-363-deactivate-and-activate-contracts');

        if (featureFlagEnabled) {
            const tokenStatusService = new TokenStatusService();
            const tokensUpdated = await tokenStatusService.switchReasonByUserId({
                userId,
                reason: TokenStatusChangeReason.BackofficeDeactivatedUser,
                activeBlock: false,
                requestUserId: userId,
            });

            if (!tokensUpdated) {
                console.error(`[${context}] | Error updating token status for user: ${userId}`);
                return errorResponse(
                    res,
                    BadRequest({
                        auth: false,
                        code: 'server_error',
                        message: 'Tokens not updated',
                    }),
                    context
                );
            }
            // If tokens are updated, we can proceed to activate contracts
            await User.unlockUser(userId, ReasonForUnblockUser.ContractActivated);
        }
        else {
            const promises: Promise<any>[] = [];
            promises.push(Contract.markAllAsActive(userId));
            if (user.blocked) promises.push(User.unlockUser(userId, ReasonForUnblockUser.ContractActivated, () => {}));
            await Promise.all(promises);
            
            contractsServices.updateContractStatusExternalNetworks(userId, true);
        }

        return res.status(204).send();
    } catch (error) {
        console.error(`${context} Error `, error.message);
        return errorResponse(res, error, context);
    }
}

async function requestPhysicalCard(req: Request, res: Response) {
    const context = "PATCH /api/private/contracts/requestPhysicalCard";
    try {
        console.log("requestPhysicalCard");
        let contract: IContract = req.body;
        let userId = req.headers['userid'];

        if (userId) {
            await contractsServices.deleteCachedContractsByUser(userId.toString())
        }

        let clientName: string | undefined = Array.isArray(req.headers['clientname'])
            ? req.headers['clientname'][0]
            : req.headers['clientname'];

        if (!clientName) {
            throw new Error('Client name is not provided in the headers');
        }

        const error = contractsServices.validateContract(contract, req.headers as any as IHeaders);
        if (error) {
            return res.status(422).send(error);
        }

        if (clientName === Constants.clientNames.evio) {
            ContractHandler.requestPhysicalCardEVIO(contract, userId, clientName)
                .then((result) => {
                    return res.status(200).send(result);
                })
                .catch((error) => {
                    console.error(`[${context}][ContractHandler.requestPhysicalCardEVIO] Error `, error.message);
                    error.statusCode = 400;
                    return errorResponse(res, error, context);
                });
        } else {
            ContractHandler.requestPhysicalCardWL(contract, userId, clientName)
                .then((result) => {
                    return res.status(200).send(result);
                })
                .catch((error) => {
                    console.error(`[${context}][ContractHandler.requestPhysicalCardWL] Error `, error.message);
                    error.statusCode = 400;
                    return errorResponse(res, error, context);
                });
        }

    } catch (error) {
        console.error(`${context} Error `, error.message);
        return errorResponse(res, error, context);
    }
}

async function switchBlockCard(req: Request, res: Response) {
    const context = 'PATCH /api/private/contracts/switchBlockCard';
    try {
        const tokenStatusService = new TokenStatusService();
        const { contractId, activeBlock } = req.body;
        const requestUserId = req.headers['userid'] as string;

        if (activeBlock === undefined || activeBlock === null) {
            return errorResponse(
                res,
                BadRequest({
                    auth: false,
                    code: 'server_active_block_not_found',
                    message: 'Active block not found',
                }),
                context
            );
        }

        if (!contractId) {
            return errorResponse(
                res,
                BadRequest({
                    auth: false,
                    code: 'server_contract_id_not_found',
                    message: 'Contract ID not found',
                }),
                context
            );
        }

        const result = await tokenStatusService.switchBlockCard({
            contractId,
            requestUserId,
            activeBlock,
        });

        return res.status(result.success ? 200 : 400).send(result);
    } catch (error) {
        console.error(`${context} Error `, error.message);
        return errorResponse(res, error, context);
    }
}

export default {
    deactivateContracts,
    activateContract,
    requestPhysicalCard,
    switchBlockCard
};
