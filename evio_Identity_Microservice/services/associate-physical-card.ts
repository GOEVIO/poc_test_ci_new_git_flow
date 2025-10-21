import { fieldEquals, NetworkStatus, TokenTypes, ClientNames, CardPhysicalStateInfo, CardType, ChargerNetworks } from "evio-library-commons"
import { updateNetworkStatus } from "evio-library-assets"

import { addRfidTokensToContract } from './add-rfid-to-networks'
import Contract from '../models/contracts'
import { updateCardSibs } from '../routes/contracts'

const ACTIVE = NetworkStatus.Active
const RFID = TokenTypes.RFID
const APP_USER = TokenTypes.AppUser
const OTHER = TokenTypes.Other
const SALVADOR_CAETANO = ClientNames.GoCharge
const VIRTUAL_ONLY = CardPhysicalStateInfo.virtualOnly
const VIRTUAL = CardType.Virtual
const GIREVE = ChargerNetworks.Gireve

const PATH = 'PATCH /api/private/contracts/associatePhysicalCard'

export type AssociatePhysicalCardParams = {
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

async function undoPhysicalState(
  contract: any,
  previousCardPhysicalStateInfo: string = VIRTUAL_ONLY,
  previousCardType: string = VIRTUAL,
  previousCardPhysicalState: boolean = false
) {
  await Contract.updateOne(
    { _id: contract._id },
    {
      $pull: {
        'networks.$[i].tokens': { tokenType: RFID },
        'contractIdInternationalNetwork.$[i].tokens': { tokenType: RFID },
      },
      $unset: {
        activationDate: true,
      },
      $set: {
        cardPhysicalStateInfo: previousCardPhysicalStateInfo,
        cardType: previousCardType,
        cardPhysicalState: previousCardPhysicalState,
      }
    },
    {
      arrayFilters: [{ 'i.tokens.tokenType': RFID }]
    }
  )
}

export type CreateRfidParams = {
  contract: any,
  networkNames?: string[],
  valid?: boolean,
  path?: string,
  previousCardPhysicalStateInfo?: string,
  previousCardType?: string,
  previousCardPhysicalState?: boolean,
}

export async function createRfid({
  contract, networkNames, valid = false, path = '',
  previousCardPhysicalStateInfo = VIRTUAL_ONLY,
  previousCardType = VIRTUAL,
  previousCardPhysicalState = false,
}: CreateRfidParams): Promise<void> {
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
    console.error('Failed to create RFID tokens, undoing physical state', err?.message)
    await undoPhysicalState(contract, previousCardPhysicalStateInfo, previousCardType, previousCardPhysicalState)
    throw new Error(`Failed to create RFID tokens ${err?.message}`)
  }
}

/**
 * Received a contract, cardNumber and tags,
 * and creates new tokens for received tags.
 * @returns updated contract
 * @throws on failed creation
 */
export async function associatePhysicalCard({
  contract, cardNumber,
  idTagDec, idTagHexa, idTagHexaInv
}: AssociatePhysicalCardParams): Promise<any> {
  try {
    const previousCardPhysicalStateInfo = contract.cardPhysicalStateInfo
    const previousCardType = contract.cardType
    const previousCardPhysicalState = contract.cardPhysicalState
    const { validNetworks, invalidNetworks } = forkValidInvalidNetworkNames(contract.networks)
    await addRfidTokensToContract(
      contract,
      { cardNumber, idTagDec, idTagHexa, idTagHexaInv },
      true
    )
    await createRfid({
      contract, networkNames: invalidNetworks, valid: false, path: PATH,
      previousCardPhysicalStateInfo, previousCardType, previousCardPhysicalState
    })
    await createRfid({
      contract, networkNames: validNetworks, valid: true, path: PATH,
      previousCardPhysicalStateInfo, previousCardType, previousCardPhysicalState
    })

    const updatedContract = await Contract.findOne({ _id: contract._id }).lean()
    if (updatedContract.clientName === SALVADOR_CAETANO) {
      await updateCardSibs(updatedContract.cardNumber)
    }
    return updatedContract
  } catch (err) {
    console.error('[associatePhysicalCard] Error', err?.message)
    throw new Error(`[associatePhysicalCard] Error ${err?.message}`)
  }
}
