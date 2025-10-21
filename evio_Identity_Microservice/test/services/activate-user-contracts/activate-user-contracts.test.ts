import { describe, it, jest, expect, afterEach, afterAll } from '@jest/globals'

const updateOneUser = jest.fn()
jest.mock('../../../models/user', () => ({ updateOne: updateOneUser }))

const findContracts = jest.fn()
const updateContract = jest.fn()
jest.mock('../../../models/contracts', () => ({
  find: findContracts,
  updateOne: updateContract,
}))

const updateNetworkStatus: jest.Mock<any> = jest.fn()
jest.mock('evio-library-assets', () => ({
  updateNetworkStatus
}))

import { activateUserContracts } from '../../../services/activate-user-contracts'
import { ReasonForUnblockUser } from '../../../utils/enums/ReasonForUnblockUser'
import ENV from '../../../constants/env'
import { baseContract } from './contract.mock'

function expectFoundContracts(userId) {
      expect(findContracts).toBeCalledWith(
      expect.objectContaining({
        userId,
        cardPhysicalStateInfo: { $ne: ENV.cardCancelReasons.CancelledByCustomer },
        active: false
      })
    )
}

function expectUnlockUser(userId) {
  expect(updateOneUser).toBeCalledWith(
    {_id: userId},
    {
      $set: { blocked: false },
      $push: {
        blockHistory: {
          actionDate: expect.any(Number),
          blocked: false,
          reason: ReasonForUnblockUser.ContractActivated
        }
      }
    }
  )
}

function expectActivatedNetworks(contract) {
  expect(updateNetworkStatus).toBeCalledWith({
    contractId: contract._id,
    userId: contract.userId,
    action: 'ACTIVATE',
    path: expect.any(String),
  })
}

function expectUnlockContracts(contractId) {
  expect(updateContract).toBeCalledWith(
    { _id: contractId },
    {
      $set: {
        status: ENV.contractStatusEnum.contractStatusActive,
        statusMessageKey: '',
        active: true,
      }
    }
  )
}

function expectBlockContract(contract) {
  expect(updateContract).toBeCalledWith(
    { _id: contract._id },
    {
      $set: {
        status: ENV.contractStatusEnum.contractStatusInactive,
        statusMessageKey: contract.statusMessageKey,
        active: false,
      }
    }
  )
}

function mockFindContracts(contracts) {
  findContracts.mockReturnValueOnce({
    lean: () => Promise.resolve(contracts)
  })
}

describe('activateUserContracts unit tests', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    jest.restoreAllMocks()
  })

  it.each([
    [baseContract]
  ])('Given %o when activateUserContracts should succeed', async (contract) => {
    // given
    mockFindContracts([contract])

    // when
    await activateUserContracts(contract.userId)

    // should
    expectFoundContracts(contract.userId)
    expectUnlockContracts(contract._id)
    expectActivatedNetworks(contract)
    expectUnlockUser(contract.userId)
  })

  it.each([
    [baseContract]
  ])('Given %o when activateUserContracts fails should undo', async (contract) => {
    // given
    const errorMessage = 'error message'
    mockFindContracts([contract])
    updateNetworkStatus.mockRejectedValueOnce(errorMessage)

    // when
    await expect(activateUserContracts(contract.userId))
      .rejects.toEqual(errorMessage)

    // should
    expectFoundContracts(contract.userId)
    expectActivatedNetworks(contract)
    expect(updateContract).toBeCalledTimes(2)
    expectUnlockContracts(contract._id)
    expectBlockContract(contract)
    expect(updateOneUser).not.toBeCalled()
  })
})
