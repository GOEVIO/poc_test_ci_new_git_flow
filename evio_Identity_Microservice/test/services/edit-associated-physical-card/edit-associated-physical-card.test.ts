import { describe, it, jest, expect, afterEach, afterAll, beforeAll } from '@jest/globals'

const updateMock: jest.Mock<any> = jest.fn()
const updateOneMock: jest.Mock<any> = jest.fn()
const updateCardSibsMock: jest.Mock<any> = jest.fn()
const leanMock: jest.Mock<any> = jest.fn()

jest.mock('evio-library-assets', () => ({
  updateNetworkStatus: updateMock,
}))
jest.mock('../../../routes/contracts', () => ({
  updateCardSibs: updateCardSibsMock
}))
jest.mock('../../../models/contracts', () => ({
  updateOne: updateOneMock,
  findOne: () => ({ lean: leanMock })
}))
jest.mock('evio-redis-connection')

import { editAssociatedPhysicalCard } from '../../../services/edit-associated-physical-card'
import { TokenTypes, ClientNames, ChargerNetworks } from 'evio-library-commons'
import { baseContract, invalidTokenContract, scContract } from './contract.mock'

describe('editAssociatedPhysicalCard unit tests', () => {

  const dispatchResult: any = [{success: true}]
  
  beforeAll(() => {
    updateMock.mockResolvedValue(dispatchResult)
  })
  
  afterEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    jest.restoreAllMocks()
  })
  
  it.each([
    [invalidTokenContract, false],
    [baseContract, true],
    [scContract, true],
  ])('test contract %o', async (contract, valid) => {
    // GIVEN
    const idTagDec = Math.random().toString()
    const idTagHexa = Math.random().toString()
    const idTagHexaInv = Math.random().toString()
    const cardNumber = Math.random().toString()
    leanMock.mockResolvedValueOnce(contract)

    // WHEN
    await editAssociatedPhysicalCard({
      contract, cardNumber, idTagDec, idTagHexa, idTagHexaInv
    })

    // SHOULD
    expect(updateMock).toHaveBeenNthCalledWith(
      1,
      {
        contractId: String(contract._id),
        userId: contract.userId,
        assetId: contract.evId,
        action: 'DEACTIVATE',
        tokenTypes: expect.arrayContaining([TokenTypes.RFID]),
        reason: expect.any(String),
        path: expect.any(String)
      }
    )

    expect(updateOneMock).toBeCalledWith(
      expect.any(Object),
      expect.objectContaining({
        $set: expect.objectContaining({
          cardNumber,
          'networks.$[j].tokens.$[i].idTagDec': idTagDec,
          'networks.$[j].tokens.$[i].idTagHexa': idTagHexa,
          'networks.$[j].tokens.$[i].idTagHexaInv': idTagHexaInv,
        })
      }),
      expect.any(Object)
    )

    expect(updateMock).toHaveBeenLastCalledWith({
      contractId: String(contract._id),
      userId: contract.userId,
      assetId: contract.evId,
      action: valid ? 'ACTIVATE' : 'DEACTIVATE',
      tokenTypes: expect.arrayContaining([TokenTypes.RFID]),
      networks: expect.arrayContaining([ChargerNetworks.Evio, ChargerNetworks.Gireve, ChargerNetworks.Mobie]),
      path: expect.any(String),
    })

    if (contract.clientName === ClientNames.GoCharge) {
      expect(updateCardSibsMock).toBeCalled()
    }
  })
})