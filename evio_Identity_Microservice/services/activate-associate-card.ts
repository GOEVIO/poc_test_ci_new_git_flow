import {
    fieldEquals,
    NetworkStatus,
    TokenTypes,
    CardPhysicalStateInfo,
    ChargerNetworks,
    CardType
} from "evio-library-commons"
import { updateNetworkStatus } from "evio-library-assets"

import Contract from '../models/contracts'
import { sendEmailClient } from "../routes/contracts";

const ACTIVE = NetworkStatus.Active
const RFID = TokenTypes.RFID
const APP_USER = TokenTypes.AppUser
const OTHER = TokenTypes.Other
const ACTIVECARD = CardPhysicalStateInfo.active
const VIRTUAL_PHYSICAL = CardType.VirtualPhysical
const GIREVE = ChargerNetworks.Gireve

const PATH = 'PATCH /api/private/contracts/validateCard'

export type ActivateAssociateCardParams = {
    contract: any,
    cardNumber?: string,
    idTagDec: string,
    idTagHexa: string,
    idTagHexaInv: string,
}

function isAppTokenValid(network) {
    if (network.network === GIREVE) {
        return network.tokens
            .filter(fieldEquals('tokenType', OTHER))
            .some(fieldEquals('status', ACTIVE))
    }

    return network.tokens
        .filter(fieldEquals('tokenType', APP_USER))
        .some(fieldEquals('status', ACTIVE))
}

function forkValidInvalidNetworkNames(networks) {
    const validNetworks: any[] = []
    const invalidNetworks: any[] = []
    networks.forEach(network => {
        if (isAppTokenValid(network)) {
            validNetworks.push(network.network)
        } else {
            invalidNetworks.push(network.network)
        }
    })
    return { validNetworks, invalidNetworks }
}

async function activateRFID(
    contract, networkNames?: string[], valid: boolean = false, path: string = ''
) {
    if (!networkNames?.length) {
        return
    }
    try {
        await updateNetworkStatus({
            contractId: String(contract._id),
            userId: contract.userId,
            assetId: contract.evId,
            action: valid ? 'ACTIVATE' : 'DEACTIVATE',
            tokenTypes: [RFID],
            networks: networkNames,
            path,
        })
    } catch(err) {
        console.error('Failed to activate RFID tokens, undoing physical state', err?.message)
        throw new Error(`Failed to activate RFID tokens ${err?.message}`)
    }
}

/**
 * Received a contract, cardNumber and tags,
 * and creates new tokens for received tags.
 * @returns updated contract
 * @throws on failed creation
 */
export async function activateAssociateCard({ contract, cardNumber }: ActivateAssociateCardParams): Promise<any> {
    try {
        const { validNetworks, invalidNetworks } = forkValidInvalidNetworkNames(contract.networks)

        await activateRFID(contract, invalidNetworks, false, PATH)
        await activateRFID(contract, validNetworks, true, PATH)

        await Contract.updateOne(
            { _id: contract._id },
            { $set: {
                    cardNumber: cardNumber,
                    cardType: VIRTUAL_PHYSICAL,
                    cardPhysicalState: true,
                    cardPhysicalStateInfo: ACTIVECARD,
                    activationDate: new Date(),
                }}
        )

        let mailOptions = {
            to: contract.email,
            message: {
                "username": contract.name,
            },
            type: "activeCard"
        };
        sendEmailClient(mailOptions, contract.clientName)

        return await Contract.findOne({ _id: contract._id }).lean()
    } catch (err) {
        console.error('[activateAssociateCard] Error', err?.message)
        //envia email
        let email;
        if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'pre-production') {
            email = process.env.EMAIL1
        }
        else {
            email = process.env.EMAIL3
        };
        // Send email to EVIO with error card activation
        let mailOptions = {
            to: email,
            //subject: `EVIO - Erro Pedido Ativação Cartão`,
            message: {
                "username": contract.name,
                "message": err.message
            },
            type: "activeCardError"
        };
        sendEmailClient(mailOptions, contract.clientName)

        throw new Error(`[activateAssociateCard] Error ${err?.message}`)
    }

}
