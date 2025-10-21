import { TokenStatus } from 'evio-library-commons';
import {
    Network,
    TokenHistoryAction,
    TokenStatusServiceCode,
    TokenType,
} from '../enums/tokenStatusService.enum';
import { TokenStatusChangeReason } from '../utils/enums/TokenStatusChangeReason';
import { INetwork, IToken } from './contracts.interface';

export interface IUpdateTokenStatus {
    contractId?: string;
    userId?: string;
    evId?: string;
    reason: TokenStatusChangeReason;
    networks?: Network[];
    tokenTypes?: TokenType[];
    action: TokenHistoryAction;
    requestUserId: string;
    path?: string;
}

export interface IUpdatedContract {
    contractId: string; 
    userId: string;
    evId?: string;
    fleetId?: string;
    cardNumber?: string;
}

export interface ICollectAffectedToken {
    networksInContract: INetwork[];
    reason: TokenStatusChangeReason;
    networks?: Network[];
    tokenTypes?: TokenType[];
    action: TokenHistoryAction;
    requestUserId?: string;
    includeRfidToken: boolean;
}

export interface IAddTokenStatusHistory {
    token: IToken;
    previousStatus: TokenStatus;
    newStatus: TokenStatus;
    reason: TokenStatusChangeReason;
    action: TokenHistoryAction;
    requestUserId?: string;
}

export interface IAffectedToken {
    network: Network;
    tokenType: TokenType;
}

export interface INetworkWithTokenTypes {
    network: string;
    tokenTypes: string[];
}

export interface IGetRfidUIStateResponse {
    showBlockButton: boolean;
    enableBlockButton: boolean;
    blockToggleState: boolean;
    showCancelButton: boolean;
    enableCancelButton: boolean;
}

export interface IGetRfidUIStateParams { 
    contract: any;
    clientType: string;
    requestUserId: string;
}

export interface ICancelRfidParams {
    contractId: string;
    requestNewCard: boolean;
    requestUserId: string;
    path?: string;
}

export interface ICancelRfidResponse { 
    success: boolean; 
    code: TokenStatusServiceCode; 
    message: string 
}

export interface ISwitchReasonByUserIdParams {
    userId: string;
    activeBlock: boolean;
    reason: TokenStatusChangeReason;
    requestUserId: string;
}