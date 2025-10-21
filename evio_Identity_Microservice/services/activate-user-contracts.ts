import { updateNetworkStatus } from 'evio-library-assets'

import User from '../models/user'
import Contract from '../models/contracts'
import { ReasonForUnblockUser } from '../utils/enums/ReasonForUnblockUser'
import ENV from '../constants/env'

const ACTIVE = ENV.contractStatusEnum.contractStatusActive
const INACTIVE = ENV.contractStatusEnum.contractStatusInactive
const CANCELLED_BY_CUSTOMER = ENV.cardCancelReasons.CancelledByCustomer

async function findUserContracts(userId) {
  return await Contract.find({
    userId,
    cardPhysicalStateInfo: { $ne: CANCELLED_BY_CUSTOMER },
    active: false
  }).lean()
}

async function unlockContract(contractId) {
  const query = { _id: contractId }
  const update = {
    $set: {
      status: ACTIVE,
      statusMessageKey: '',
      active: true,
    }
  }
  await Contract.updateOne(query, update)
}

async function blockContract(contractId, statusMessageKey) {
  const query = { _id: contractId }
  const update = {
    $set: {
      status: INACTIVE,
      statusMessageKey,
      active: false,
    }
  }
  await Contract.updateOne(query, update)
}

async function unlockUser(userId: string) {
  const query = { _id: userId }
  const update = {
    $set: { blocked: false },
    $push: {
      blockHistory: {
        actionDate: Date.now(),
        blocked: false,
        reason: ReasonForUnblockUser.ContractActivated
      }
    }
  }
  return await User.updateOne(query, update)
}

async function activateNetworksAndContracts(contract) {
  const previousStatusMessage = contract.statusMessageKey
  await unlockContract(contract._id)
  try {
    await updateNetworkStatus({
      contractId: String(contract._id),
      userId: contract.userId,
      action: 'ACTIVATE',
      path: 'POST /api/private/contracts/activateContracts',
    })
  } catch (e) {
    blockContract(contract._id, previousStatusMessage)
    console.error(`[activateUserContracts] failed to activate contract ${contract._id}`, e)
    throw e
  }
}

export async function activateUserContracts(userId: string) {
  const contracts = await findUserContracts(userId)
  await Promise.all(contracts.map(activateNetworksAndContracts))
  await unlockUser(userId)
}