import toggle from 'evio-toggle'
import { updateNetworkStatus } from 'evio-library-assets'

import Contract from '../models/contracts'
import ENV from '../constants/env'
import TokenStatusServiceClass from './tokenStatus.service'

const TokenStatusService = new TokenStatusServiceClass()

const RFID = ENV.tokensTypes.RFID
const VIRTUAL = ENV.cardTypes.Virtual
const CHARGEPAYMENT = process.env.CARDPHYSICALPAYMENTSTATEINFOCHARGEPAYMENT
const VIRTUALONLY = process.env.CARDPHYSICALSTATEINFOVIRTUALONLY

async function findAndUpdateContract({
  contractId
}) {
  const query = { _id: contractId }
  return await Contract.findOneAndUpdate(
    query,
    {
      $set: {
        firstPhysicalCard: true,
        cardPhysicalPaymentStateInfo: CHARGEPAYMENT,
        cardType: VIRTUAL,
        cardPhysicalState: false,
        cardPhysicalStateInfo: VIRTUALONLY,
      },
      $unset: {
        activationDate: 1,
        requestDate: 1,
        requestThirdPartyDate: 1,
        processedThirdPartyDate: 1,
      },
      $pull: {
        'networks.$[i].tokens': { tokenType: RFID },
        'contractIdInternationalNetwork.$[i].tokens': { tokenType: RFID },
      }
    },
    {
      returnDocument: 'after',
      arrayFilters: [{ 'i.tokens.tokenType': 'RFID' }]
    }
  ).lean();
}

export async function cancelRfidTagsAndRemoveTokens({
  contractId, isNewCardRequest, requestUserId, contractCancelId, contract
}) {

  if (await toggle.isEnable('fleet-363-cancelrfid')) {
    const result = await TokenStatusService.cancelRfid({
      contractId: contractCancelId, requestNewCard: isNewCardRequest, requestUserId,
      path: 'PATCH /api/private/contracts/cancelRFID',
    })

    if (!result.success) {
      throw result
    }
  } else {
    await updateNetworkStatus({
      contractId,
      userId: contract.userId,
      assetId: contract.evId,
      action: 'DEACTIVATE',
      tokenTypes: [RFID],
      path: 'PATCH /api/private/contracts/cancelRFID',
      reason: 'canceRfid'
    })
  }

  return await findAndUpdateContract({
    contractId
  })
}