import { updateNetworkStatus } from 'evio-library-assets'
import { fieldEquals, CardType, TokenTypes, ChargerNetworks, CardPhysicalStateInfo } from 'evio-library-commons'

import Contract from '../models/contracts'

const RFID = TokenTypes.RFID
const GIREVE = ChargerNetworks.Gireve
const VIRTUAL_PHYSICAL = CardType.VirtualPhysical
const VIRTUAL = CardType.Virtual
const ACTIVE = CardPhysicalStateInfo.active
const VIRTUAL_ONLY = CardPhysicalStateInfo.virtualOnly

const PATH = 'PATCH /api/private/cards/activate'

/**
 * Pulls rfid tokens from contract
 */
async function rollback(contract) {
  return await Contract.findOneAndUpdate(
    {_id: contract._id},
    {
      $pull: {
        'networks.$[i].tokens': { tokenType: RFID },
        'contractIdInternationalNetwork.$[i].tokens': { tokenType: RFID },
      },
      $set: {
        cardType: VIRTUAL,
        cardPhysicalState: false,
        cardPhysicalStateInfo: VIRTUAL_ONLY,
      },
      $unset: {
        cardNumber: true,
        activationDate: true,
      }
    },
    {
      returnDocument: 'after',
      arrayFilters: [{ 'i.tokens.tokenType': 'RFID' }]
    }
  )
}

async function addRfidTokenToInternationalNetwork(contractIdInternationalNetwork) {
  const gireveNetwork = contractIdInternationalNetwork
    ?.find(fieldEquals('network', GIREVE))

  if (!gireveNetwork?.tokens.some(fieldEquals('tokenType', RFID))) {
    gireveNetwork?.tokens.push({ tokenType: RFID, contract_id: '' })
  }
}

/**
 * Adds idTags to rfid tokens, if any network does not have rfid token
 * a new one is added with the same id tags.
 * Saves this change to database.
 */
export async function addRfidTokensToContract(contract, cardData, wasAssociated = false) {
  const idTagDec = cardData.idTagDec
  const idTagHexa = cardData.idTagHexa.toUpperCase();
  const idTagHexaInv = cardData.idTagHexaInv.toUpperCase();

  const defaultToken = {
    wasAssociated,
    tokenType: RFID,
    status: 'inactive',
    idTagDec: idTagDec,
    idTagHexa: idTagHexa,
    idTagHexaInv: idTagHexaInv
  }

  contract.networks.forEach((network) => {
    const rfidToken = network.tokens.find((token) => token.tokenType === RFID)
    if (rfidToken) {
      rfidToken.idTagDec = idTagDec
      rfidToken.idTagHexa = idTagHexa
      rfidToken.idTagHexaInv = idTagHexaInv
    } else {
      network.tokens.push({ ...defaultToken })
    }
  })

  addRfidTokenToInternationalNetwork(contract.contractIdInternationalNetwork)

  await Contract.updateOne(
    { _id: contract._id },
    { $set: {
      networks: contract.networks,
      contractIdInternationalNetwork: contract.contractIdInternationalNetwork,
      cardNumber: cardData.cardNumber,
      cardType: VIRTUAL_PHYSICAL,
      cardPhysicalState: true,
      cardPhysicalStateInfo: ACTIVE,
      activationDate: new Date(),
    }}
  )
}

async function dispatchCreateTokens(contract) {
  try {
    // this function will create the tokens if they do not exist and rollback if any fail
    return await updateNetworkStatus({
      contractId: String(contract._id),
      userId: contract.userId,
      assetId: contract.evId,
      tokenTypes: [RFID],
      action: 'ACTIVATE',
      path: PATH,
    })
  } catch (e) {
    await rollback(contract)
    const msg = `[addRFIDToNetworks] failed to activate card and successfully rolled-back for contract ${contract._id}, error: ${e?.message}`
    console.error(msg)
    throw new Error(msg)
  }
}

/**
 * Activates networks for a contract and rollbacks if any fail.
 * Updates the passed contract.
 * @return updated contract
 * @throws on failed activation
 */
export async function addRFIDToNetworks({ contract, cardData }) {
  await addRfidTokensToContract(contract, cardData)

  await dispatchCreateTokens(contract)

  const updatedContract = await Contract.findOne({ _id: contract._id }).lean()
  return Object.assign(contract, updatedContract)
}
