import { updateNetworkStatus } from "evio-library-assets";
import { TokenTypes, ChargerNetworks, TokenStatus, ClientNames } from "evio-library-commons";

import { createRfid } from "./associate-physical-card";
import Contract from '../models/contracts'
import { updateCardSibs } from '../routes/contracts'

const RFID = TokenTypes.RFID
const INACTIVE = TokenStatus.Inactive
const EVIO = ChargerNetworks.Evio
const GIREVE = ChargerNetworks.Gireve
const MOBIE = ChargerNetworks.Mobie
const SALVADOR_CAETANO = ClientNames.GoCharge

const PATH = 'PATCH /api/private/contracts/editAssociatePhysicalCard'

export type editAssociatedPhysicalCardParams = {
  contract: any,
  cardNumber?: string,
  idTagDec: string,
  idTagHexa: string,
  idTagHexaInv: string,
}

async function deactivateRfid(contract) {
  try {
    await updateNetworkStatus({
      contractId: String(contract._id),
      userId: contract.userId,
      assetId: contract.evId,
      action: 'DEACTIVATE',
      tokenTypes: [RFID],
      path: PATH,
      reason: 'new card added'
    })
  } catch(err) {
    console.error('Failed to deactivate RFID', err?.message)
    throw new Error(`Failed to deactivate RFID ${err?.message}`)
  }
}

async function updateIdTagsAndCardNumber({
  contract, cardNumber,
  idTagDec, idTagHexa, idTagHexaInv
}: editAssociatedPhysicalCardParams) {
  const update = {
    cardNumber: cardNumber || contract.cardNumber,
    'networks.$[j].tokens.$[i].idTagDec': idTagDec,
    'networks.$[j].tokens.$[i].idTagHexa': idTagHexa,
    'networks.$[j].tokens.$[i].idTagHexaInv': idTagHexaInv,
  }
  await Contract.updateOne(
    { _id: contract._id },
    { $set: update },
    { arrayFilters: [
      { 'i.tokenType': RFID },
      { 'j.network': { $in: [MOBIE, EVIO, GIREVE]} },
    ] }
  )
}

function isRfidInactive(contract): boolean {
  return contract.networks
    .filter(({network}) => [EVIO, MOBIE].includes(network))
    .flatMap(({tokens}) => tokens)
    .filter(({tokenType}) => tokenType === RFID)
    .some(({status}) => status === INACTIVE)
}

/**
 * Received a contract, invalidates current rfid 
 * and creates new tokens for received tags
 * @returns updated contract
 * @throws on failed invalidation or creation
 */
export async function editAssociatedPhysicalCard({
  contract, cardNumber,
  idTagDec, idTagHexa, idTagHexaInv
}: editAssociatedPhysicalCardParams): Promise<any> {
  try {
    const valid = !isRfidInactive(contract)
    await deactivateRfid(contract)
    await updateIdTagsAndCardNumber({
      contract, cardNumber,
      idTagDec, idTagHexa, idTagHexaInv
    })
    await createRfid({
      contract, networkNames: [EVIO, GIREVE, MOBIE], valid, path: PATH,
      previousCardPhysicalStateInfo: contract.cardPhysicalStateInfo,
      previousCardType: contract.cardType,
      previousCardPhysicalState: contract.cardPhysicalState
    })

    const updatedContract = await Contract.findOne({_id:contract._id}).lean()
    if (updatedContract.clientName === SALVADOR_CAETANO) {
      await updateCardSibs(updatedContract.cardNumber)
    }
    return updatedContract
  } catch(err) {
    console.error('[editAssociatedPhysicalCard] Error', err?.message)
    throw new Error(`[editAssociatedPhysicalCard] Error ${err?.message}`)
  }
}
