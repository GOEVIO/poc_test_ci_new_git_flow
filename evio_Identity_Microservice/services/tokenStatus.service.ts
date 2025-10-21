import {
    Network,
    TokenType,
    TokenStatus,
    TokenHistoryAction,
    EmailTemplate,
    TokenStatusServiceCode,
} from '../enums/tokenStatusService.enum';
import { CardPhysicalStateEnum } from '../utils/enums/contracts';
import Contract from '../models/contracts';
import User from '../models/user';
import { updateNetworkStatusByToken } from 'evio-library-assets';
import { sendEmail } from "../utils";

import Constants from '../utils/constants';
import {
    IAddTokenStatusHistory,
    IAffectedToken,
    ICollectAffectedToken,
    IGetRfidUIStateResponse,
    IGetRfidUIStateParams,
    IUpdateTokenStatus,
    IUpdatedContract,
    ICancelRfidParams,
    ICancelRfidResponse,
    ISwitchReasonByUserIdParams,
    INetworkWithTokenTypes,
} from '../interfaces/tokenStatusService.interface';
import { TokenStatusChangeReason } from '../utils/enums/TokenStatusChangeReason';

import EVs from "evio-library-evs";
import { deleteCachedContractsByUser } from './contracts';
import driversServices from '../services/drivers';
import * as Sentry from '@sentry/node'

export default class TokenStatusService {

    private async updateTokenStatus({
        contractId,
        userId,
        evId,
        reason,
        networks,
        tokenTypes,
        action,
        requestUserId,
        path = '',
    }: IUpdateTokenStatus): Promise<IUpdatedContract[]> {
        const context = "TokenStatusService.updateTokenStatus";
        console.log(`[${context}][START] Updating token status with parameters: ${JSON.stringify({ 
            contractId,
            userId,
            evId,
            reason,
            networks,
            tokenTypes,
            action,
            requestUserId,
            path
        })}`);

        const contracts = await this.getContractsOrThrow({
            contractId,
            userId,
            evId,
        });

        console.log(`[${context}][CONTRACTS] Found ${contracts.length} active contracts for the provided parameters.`);

        const cachedUsers: Set<string> = new Set();
        const updatedContracts: IUpdatedContract[] = [];

        for (const contract of contracts) {

            // If the contract is active or cancelled, we need to consider RFID tokens
            const includeRfidToken = [
                CardPhysicalStateEnum.ACTIVE,
                CardPhysicalStateEnum.CANCELEDBYCUSTOMER,
                CardPhysicalStateEnum.CANCELEDBYEVIO
            ].includes(contract.cardPhysicalStateInfo);

            const tokensAffected = this.collectAffectedTokens({
                networksInContract: contract.networks,
                reason,
                networks,
                tokenTypes,
                action,
                requestUserId,
                includeRfidToken
            });

            console.log(`[${context}][TOKENS_AFFECTED] Found ${tokensAffected.length}`);

            if (tokensAffected.length > 0) {
                const updateNetworkStatus = {
                    contractId: String(contract._id),
                    action,
                    updates: this.getNetworkWithTokenTypes(tokensAffected),
                    path,
                    reason,
                }
                console.log(`[${context}][updateNetworkStatusByToken][START] - PARAMS: ${JSON.stringify(updateNetworkStatus)}`);
                await updateNetworkStatusByToken(updateNetworkStatus);
                console.log(`[${context}][updateNetworkStatusByToken][END]`);
            }

            await Contract.updateOne(
                { _id: contract._id },
                { $set: { networks: contract.networks } }
            );

            if (contract.evId) {
                await this.setUsersArray(contract.evId, cachedUsers);
            }

            cachedUsers.add(contract.userId);

            updatedContracts.push(contract);
        }

        if (cachedUsers.size > 0) {
            Promise.all(
                Array.from(cachedUsers).map(driver => deleteCachedContractsByUser(driver))
            );
            console.log(`[${context}][END] Deleted cached users. Cached users: ${cachedUsers.size}`);
        }

        return updatedContracts;
    }

    private async setUsersArray(evId: string, cachedUsers: Set<string>): Promise<void> {
        const ev = await EVs.findEVById(evId);
        ev?.listOfDrivers.forEach(driver => cachedUsers.add(driver.userId));
        console.log(`[TokenStatusService.setUsersArray] Cached users updated with EV ID: ${evId}. Current cached users: ${ev?.listOfDrivers.length}`);
    }

    private async getContractsOrThrow({
        contractId,
        userId,
        evId,
    }: {
        contractId?: string;
        userId?: string;
        evId?: string;
    }) {
        if (!contractId && !userId && !evId) {
            throw new Error('Contract ID, User ID or EV ID must be provided');
        }

        const query = contractId ? { _id: contractId } : evId ? { evId } : { userId, active: true, status: TokenStatus.Active };

        const contracts = await Contract.find(query);

        if (!contracts || contracts.length === 0) {
            throw new Error('Contract not found or inactive');
        }

        return contracts;
    }

    private collectAffectedTokens({
        networksInContract,
        reason,
        networks,
        tokenTypes,
        action,
        requestUserId,
        includeRfidToken,
    }: ICollectAffectedToken): IAffectedToken[] {
        const context = "TokenStatusService.collectAffectedTokens";
        const allNetworks = !networks || networks.length === 0;
        const allTokenTypes = !tokenTypes || tokenTypes.length === 0;
        const tokensAffected: IAffectedToken[] = [];

        for (const network of networksInContract) {
            if (
                !allNetworks &&
                !networks.includes(network.network as Network)
            ) {
                console.log(`[${context}][SKIP_NETWORK]`);
                continue;
            }

            for (const token of network.tokens) {
                if (
                    !allTokenTypes &&
                    !tokenTypes.includes(token.tokenType as TokenType)
                ) {
                    console.log(`[${context}][SKIP_TOKEN]`);
                    continue;
                }

                const reasons = new Set(token.deactivationReason || []);
                const hadReason = reasons.has(reason);

                /*
                If the action is to deactivate the token and it didn't have the reason before, we add it.
                If the action is to activate the token and it had the reason before, we remove it.
                */
                if (action === TokenHistoryAction.Deactivate && !hadReason) {
                    console.log(`[${context}][ADD_REASON]`);
                    reasons.add(reason);
                } else if (
                    action === TokenHistoryAction.Activate &&
                    hadReason
                ) {
                    console.log(`[${context}][REMOVE_REASON]`);
                    reasons.delete(reason);
                }

                // Update the token's deactivation reasons and status
                token.deactivationReason = Array.from(reasons);

                // Determine if we should change the token's status
                const changeStatus = token.tokenType !== TokenType.Rfid || includeRfidToken;
                
                const newStatus = changeStatus ? reasons.size
                    ? TokenStatus.Inactive
                    : TokenStatus.Active
                    : token.status as TokenStatus;

                this.addTokenStatusHistory({
                    token,
                    previousStatus: token.status as TokenStatus,
                    newStatus,
                    reason,
                    action,
                    requestUserId,
                });

                if (token.status !== newStatus) {
                    console.log(`[${context}][UPDATE_STATUS]`);
                    token.status = newStatus;
                    tokensAffected.push({
                        network: network.network as Network,
                        tokenType: token.tokenType as TokenType,
                    });
                }
            }
        }

        return tokensAffected;
    }

    private getNetworkWithTokenTypes(tokensAffected: IAffectedToken[]): INetworkWithTokenTypes[] {
        const map = new Map<string, Set<string>>();

        tokensAffected.forEach(token => {
            const types = map.get(token.network) ?? new Set();
            types.add(token.tokenType);
            map.set(token.network, types);
        });

        return Array.from(map.entries()).map(
            ([network, tokenTypes]) => ({
                network,
                tokenTypes: Array.from(tokenTypes),
            })
        );
    }

    private addTokenStatusHistory({
        token,
        previousStatus,
        newStatus,
        reason,
        action,
    }: IAddTokenStatusHistory): void {
        token.tokenStatusHistory = token.tokenStatusHistory || [];
        token.tokenStatusHistory.push({
            previousStatus,
            newStatus,
            reason,
            action,
            updatedAt: new Date(),
        });
    }

    async switchBlockCard({
        contractId,
        requestUserId,
        activeBlock,
    }: {
        contractId: string;
        requestUserId: string;
        activeBlock: boolean;
    }) {
        try {
            const action = activeBlock
                ? TokenHistoryAction.Deactivate
                : TokenHistoryAction.Activate;

            const contractsWithUpdatedTokens = await this.updateTokenStatus({
                contractId,
                reason: TokenStatusChangeReason.BlockedCard,
                action,
                requestUserId,
                tokenTypes: [TokenType.Rfid],
            });

            const [contract] = contractsWithUpdatedTokens.length === 0 ? contractsWithUpdatedTokens : await this.getContractsOrThrow({ contractId });

            const userContract = await User.findOne({ _id: contract.userId });
            if (!userContract) {
                return {
                    success: false,
                    code: TokenStatusServiceCode.UserNotFound,
                    message: "User not found",
                };
            }

            const rfidUIState = this.getRfidUIState({
                contract,
                clientType: userContract.clientType,
                requestUserId,
            });

            // If no tokens were updated, we can return early without sending an email
            if (!contractsWithUpdatedTokens || contractsWithUpdatedTokens.length === 0) {
                return {
                    success: true,
                    code: activeBlock
                        ? TokenStatusServiceCode.BlockCardSuccess
                        : TokenStatusServiceCode.UnblockCardSuccess,
                    message: "Token state updated successfully",
                    rfidUIState,
                };
            }

            const isCompany = userContract.clientType === Constants.clientTypes.ClientB2B;
            let emailTemplate: EmailTemplate;
            if (isCompany) {
                emailTemplate = activeBlock
                    ? EmailTemplate.BlockCompanyRfid
                    : EmailTemplate.UnblockCompanyRfid;
            } else {
                emailTemplate = activeBlock
                    ? EmailTemplate.BlockPersonalRfid
                    : EmailTemplate.UnblockPersonalRfid;
            }

            this.sendEmail({
                contract,
                isCompany,
                emailTemplate,
                userContract,
                requestUserId
            });

            return {
                success: true,
                code: activeBlock
                    ? TokenStatusServiceCode.BlockCardSuccess
                    : TokenStatusServiceCode.UnblockCardSuccess,
                message: "Token state updated successfully",
                rfidUIState,
            }
        } catch (error) {
            console.error('Error switching block card:', error.message);
            return {
                success: false,
                code: activeBlock
                    ? TokenStatusServiceCode.BlockCardFailure
                    : TokenStatusServiceCode.UnblockCardFailure,
                message: "Failed to update token state",
            };
        }
    }

    async switchBlockNetwork({
        contractId,
        networkNames,
        activeBlock,
        requestUserId,
        path
    }: {
        contractId: string;
        networkNames: string[];
        activeBlock: boolean;
        requestUserId: string;
        path?: string;
    }) {
        try {
            const action = activeBlock
                ? TokenHistoryAction.Deactivate
                : TokenHistoryAction.Activate;

            const [contract] = await this.updateTokenStatus({
                contractId,
                reason: TokenStatusChangeReason.BlockedNetwork,
                action,
                requestUserId,
                networks: networkNames as Network[],
                path
            });

            return contract;

        } catch (error) {
            Sentry.captureException(error);
            console.error(`[TokenStatusService.switchBlockNetwork] Error switching block network: ${error.message}`);
            return null;
        }
    }

    private async sendEmail({
        contract,
        isCompany,
        emailTemplate,
        userContract,
        requestUserId
    }: {
        contract: any;
        isCompany: boolean;
        emailTemplate: EmailTemplate;
        userContract: any;
        requestUserId: string;
    }) {
        try {
            const clientName = userContract.clientName ?? Constants.clientNames.evio;
            const mailOptions = {
                message: {
                    username: userContract.name,
                    '{{userName}}': userContract.name,
                    '{{cardNumber}}': contract.cardNumber,
                    '{{timestamp}}': new Date().toLocaleString(userContract.language ? userContract.language.replace('_', '-') : 'en-US'),
                    '{{clientName}}': userContract.clientName || Constants.clientNames.evio
                },
                type: emailTemplate,
                to: userContract.email,
            }

            if (!isCompany || !contract.evId) {
                sendEmail({ mailOptions, clientName });
                return;
            }

            const driver = await User.findOne({ _id: requestUserId });
            const driverName = driver ? driver.name : 'Support';

            const ev = await EVs.findEVById(contract.evId);
            const fleet = await EVs.findFleetById(ev.fleet);

            mailOptions.message['{{companyName}}'] = userContract.name;
            mailOptions.message['{{model}}'] = ev ? ev.model : '';
            mailOptions.message['{{licensePlate}}'] = ev ? ev.licensePlate : '';
            mailOptions.message['{{fleetName}}'] = fleet ? fleet.name : '';
            mailOptions.message['{{driverName}}'] = driverName;

            sendEmail({ mailOptions, clientName });
        }
        catch (error) {
            console.error('[switchBlockCard] Failed to send email notification', error.message);
        }
    }

    getRfidUIState({ contract, clientType, requestUserId }: IGetRfidUIStateParams): IGetRfidUIStateResponse {
        if (!contract || !contract.networks) {
            throw new Error('Contract or networks not provided');
        }

        const showBlockButton = contract.cardPhysicalState && contract.cardType === process.env.CardTypeVirtualPhysical;
        const enableBlockButton = showBlockButton && !contract.networks.some(
            (network: any) => network.tokens.some(
                token => token.deactivationReason && (
                    token.deactivationReason.includes(TokenStatusChangeReason.Debt) &&
                    token.deactivationReason.includes(TokenStatusChangeReason.DeleteAccount)
                )
            )
        );

        const blockToggleState = contract.networks.some(
            (network: any) => network.tokens.some(
                token => token.deactivationReason && token.deactivationReason.includes(TokenStatusChangeReason.BlockedCard)
            )
        );

        const ownContract = contract.userId === requestUserId;
        const showCancelButton = ownContract && blockToggleState;

        const enableCancelButton = ownContract && blockToggleState && (
            clientType === Constants.clientTypes.ClientB2B ||
            (clientType === Constants.clientTypes.ClientB2C && enableBlockButton)
        );

        return {
            showBlockButton,
            enableBlockButton,
            blockToggleState,
            showCancelButton,
            enableCancelButton
        };
    }

    getRfidUIStateDisabled(): IGetRfidUIStateResponse {
        return {
            showBlockButton: false,
            enableBlockButton: false,
            blockToggleState: false,
            showCancelButton: false,
            enableCancelButton: false
        };
    }

    async switchReasonByUserId({ userId, activeBlock, reason, requestUserId }: ISwitchReasonByUserIdParams): Promise<boolean> {
        const context = "TokenStatusService.switchReasonByUserId";
        try {
            console.log(`[${context}][START] Switching Reason with parameters: ${JSON.stringify({ 
                userId, 
                activeBlock, 
                reason, 
                requestUserId
            })}`);

            const action = activeBlock
                ? TokenHistoryAction.Deactivate
                : TokenHistoryAction.Activate;

            const contracts = await this.updateTokenStatus({
                userId,
                reason,
                action,
                requestUserId,
            });

            console.log(`[${context}][CONTRACTS] Found ${contracts.length} contracts for userId: ${userId}`);

            if (!contracts || contracts.length === 0) {
                return true; // No contracts to update
            }

            // Get all EVs associated with the user
            const evs = await driversServices.getEvsByUserId(userId);

            console.log(`[${context}][EVS] Found ${evs.length} EVs for userId: ${userId}`);

            if (evs.length === 0) {
                return true;
            }

            const evIds = evs.filter(ev =>
                ev.listOfDrivers && ev.listOfDrivers.some(driver => driver.userId === userId && driver.paymenteBy === 'driver')
            ).map(ev => ev._id.toString());

            console.log(`[${context}][EV_IDS] Found ${evIds.length} EV IDs for userId: ${userId}, where user is responsible for payment`);

            if (evIds.length === 0) {
                return true;
            }

            // Update token status for each EV where the user is the responsible for the payment
            Promise.all(
                evIds.map(evId => this.updateTokenStatus({
                    evId,
                    reason,
                    action,
                    requestUserId,
                }))
            );

            return true;

        } catch (error) {
            console.error(`[${context}][ERROR] Failed to switch reason for userId: ${userId}. Error: ${error.message}`);
            Sentry.captureException(error);
            return false;
        }
    }

    async cancelRfid({ contractId, requestNewCard, requestUserId, path = '' }: ICancelRfidParams): Promise<ICancelRfidResponse> {
        try {
            const context = "TokenStatusService.cancelRfid";

            console.log(`[${context}][START] Cancelling RFID for contractId: ${contractId}, requestNewCard: ${requestNewCard}, requestUserId: ${requestUserId}`);

            const contracts = await this.updateTokenStatus({
                contractId,
                reason: TokenStatusChangeReason.CancelCard,
                action: TokenHistoryAction.Deactivate,
                requestUserId,
                tokenTypes: [TokenType.Rfid],
                path
            });

            if (!contracts || contracts.length === 0) {
                console.log(`[${context}][END] No token found to update for contractId: ${contractId}`);
                return {
                    success: true,
                    code: TokenStatusServiceCode.CancelCardSuccess,
                    message: "No token found to update",
                }
            }

            const [contract] = contracts;

            const userContract = await User.findOne({ _id: contract.userId });
            if (!userContract) {
                throw new Error('User not found');
            }

            const isCompany = userContract.clientType === Constants.clientTypes.ClientB2B;

            let emailTemplate: EmailTemplate;

            if (isCompany) {
                emailTemplate = requestNewCard ? EmailTemplate.CancelAndRequestCompanyRfid : EmailTemplate.CancelCompanyRfid;
            }
            else {
                emailTemplate = requestNewCard ? EmailTemplate.CancelAndRequestPersonalRfid : EmailTemplate.CancelPersonalRfid;
            }

            console.log(`[${context}][END] RFID cancelled successfully for contractId: ${contractId}. DATA: '${JSON.stringify({
                contract,
                emailTemplate,
                isCompany,
                userContract,
                requestUserId
            })}`);

            this.sendEmail({
                contract,
                emailTemplate,
                isCompany,
                userContract,
                requestUserId
            });

            return {
                success: true,
                code: TokenStatusServiceCode.CancelCardSuccess,
                message: "Token state updated successfully",
            };
        } catch (error) {
            console.error('Error cancelling RFID:', error.message);
            return {
                success: false,
                code: TokenStatusServiceCode.CancelCardFailure,
                message: "Failed to update token state",
            };
        }
    }
}

module.exports = TokenStatusService