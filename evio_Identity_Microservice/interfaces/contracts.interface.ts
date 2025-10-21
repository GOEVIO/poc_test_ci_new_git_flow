import {
    CardPhysicalStateEnum,
    CancellationReasonEnum,
    CardPhysicalPaymentStateEnum,
} from '../utils/enums/contracts';
import { TokenStatusChangeReason } from '../utils/enums/TokenStatusChangeReason';

export interface IContract {
    id?: string;
    cardNumber?: string;
    cardName?: string;
    cardPhysicalLicensePlate?: string;
    cardPhysicalText?: string;
    cardPhysicalName?: string;
    cardPhysicalSendTo?: string;
    cardPhysicalInTheCareOf?: string;
    cardPhysicalState?: boolean;
    cardPhysicalStateInfo?: CardPhysicalStateEnum;
    name?: string;
    email?: string;
    nif?: string;
    mobile?: string;
    internationalPrefix?: string;
    cardType?: string;
    fontCardBlack?: boolean;
    imageCard?: string;
    address?: IAddress;
    shippingAddress?: IAddress;
    status?: string;
    statusMessageKey?: string;
    networks?: INetwork[];
    imageCEME?: string;
    userId?: string;
    tariff?: ITariff;
    tariffRoaming?: ITariffRoaming[];
    default?: boolean;
    contractType?: string;
    active?: boolean;
    evId?: string;
    fleetId?: string;
    contract_id?: string;
    chargersAccessPermission?: boolean;
    scheduledTokenActivationDate?: Date;
    contractIdInternationalNetwork?: IContractIdInternationalNetwork[];
    clientName?: string;
    cancelReason?: string;
    cancellationReason?: {
        reason?: CancellationReasonEnum;
        description?: string;
    };
    firstPhysicalCard?: boolean;
    cardPhysicalPaymentStateInfo?: CardPhysicalPaymentStateEnum;
    amountChargeToRequestPayent?: {
        currency?: string;
        value?: number;
    };
    requestDate?: Date;
    requestThirdPartyDate?: Date;
    processedThirdPartyDate?: Date;
    activationDate?: Date;
}
interface IAddress {
    street: string;
    number: string;
    floor: string;
    zipCode: string;
    city: string;
    state: string;
    country: string;
    countryCode: string;
}

export interface INetwork {
    name: string;
    network: string;
    networkName: string;
    paymentMethod: string;
    tokens: IToken[];
    hasJoined: boolean;
    isVisible: boolean;
}

interface ITariff {
    planId: string;
    power: string;
}

interface ITariffRoaming {
    planId: string;
    power: string;
    network: string;
}

export interface IToken {
    idTagHexa: string;
    idTagHexaInv: string;
    idTagDec: string;
    refId: string;
    tokenType: string;
    status: string;
    wasAssociated: boolean;
    created: boolean;
    deactivationReason: string[];
    tokenStatusHistory?: TokenStatusChangeHistoryEntry[];
}

interface ITokensInternationalNetwork {
    tokenType: string;
    contract_id: string;
}

interface IContractIdInternationalNetwork {
    network: string;
    tokens: ITokensInternationalNetwork[];
}

export interface DeactivateMessage {
    key: string;
}

export interface TokenStatusChangeHistoryEntry {
    previousStatus: string;
    newStatus: string;
    updatedAt: Date;
    reason?: TokenStatusChangeReason;
    action?: string;
}