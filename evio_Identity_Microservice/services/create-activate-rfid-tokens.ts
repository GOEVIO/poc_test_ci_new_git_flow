import {CardPhysicalStateInfo, TokenTypes} from 'evio-library-commons'
import { updateNetworkStatus } from 'evio-library-assets'

import { addRfidTokensToContract } from "./add-rfid-to-networks"
import Contract from "../models/contracts"

async function rollBackContract(_id){
    return await Contract.update(
        { _id },
        {
            $unset: {
                activationDate: true,
            },
            $set: {
                cardPhysicalStateInfo: CardPhysicalStateInfo.associated
            }
        }
    )
}

async function updateContractToActive(_id) {
    return await Contract.findOneAndUpdate(
        { _id },
        {
            $set: {
                cardPhysicalState: true,
            }
        },
        {
            returnDocument: 'after',
        }
    ).lean()
}

export async function createActiveRfidTokens({ contract, idTagDec, idTagHexa, idTagHexaInv, cardNumber, path }) {
    try {
        await addRfidTokensToContract(
            contract,
            { cardNumber, idTagDec, idTagHexa, idTagHexaInv }
        )

        await updateNetworkStatus({
            contractId: String(contract._id),
            userId: contract.userId,
            assetId: contract.evId,
            action: 'ACTIVATE',
            tokenTypes: [TokenTypes.RFID],
            path,
        })

        return await updateContractToActive(contract._id)
    } catch (e) {
        console.error(`[createActiveRfidTokens][error] Error activating RFID tokens:`, e)
        await rollBackContract(contract._id)
        throw e
    }
}
