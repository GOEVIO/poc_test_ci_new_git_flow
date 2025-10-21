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

import { associatePhysicalCard } from '../../../services/associate-physical-card'
import { CardType, CardPhysicalStateInfo, TokenTypes, ChargerNetworks, ClientNames } from 'evio-library-commons'
import { baseContract, inactiveTokenContract, scContract } from './contract.mock'

const VIRTUAL_PHYSICAL = CardType.VirtualPhysical
const VIRTUAL_STATUS = CardType.Virtual
const ACTIVE_INFO = CardPhysicalStateInfo.active
const VIRTUAL_ONLY = CardPhysicalStateInfo.virtualOnly
const RFID = TokenTypes.RFID
const EVIO = ChargerNetworks.Evio
const GIREVE = ChargerNetworks.Gireve
const MOBIE = ChargerNetworks.Mobie
const SALVADOR_CAETANO = ClientNames.GoCharge

describe('associatePhysicalCard unit tests', () => {

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
    [baseContract],
    [scContract],
  ])('test contract with active tokens %o', async (contract) => {
    // GIVEN
    const idTagDec = Math.random().toString()
    const idTagHexa = Math.random().toString()
    const idTagHexaInv = Math.random().toString()
    const cardNumber = Math.random().toString()
    leanMock.mockResolvedValueOnce(contract)

    // WHEN
    await associatePhysicalCard({
      contract, cardNumber, idTagDec, idTagHexa, idTagHexaInv
    })

    // SHOULD
    expect(updateOneMock).toBeCalledWith(
      expect.any(Object),
      {
        $set: {
          networks: expect.any(Array),
          contractIdInternationalNetwork: expect.any(Array),
          cardNumber,
          cardType: VIRTUAL_PHYSICAL,
          cardPhysicalState: true,
          cardPhysicalStateInfo: ACTIVE_INFO,
          activationDate: expect.any(Date),
        },
      }
    )

    expect(updateMock).toBeCalledWith({
      contractId: String(contract._id),
      userId: contract.userId,
      assetId: contract.evId,
      action: 'ACTIVATE',
      tokenTypes: expect.arrayContaining([RFID]),
      networks: expect.arrayContaining([EVIO, MOBIE, GIREVE]),
      path: expect.any(String),
    })

    if (contract.clientName === SALVADOR_CAETANO) {
      expect(updateCardSibsMock).toBeCalled()
    } else {
      expect(updateCardSibsMock).not.toBeCalled()
    }
  })

  it.each([
    [inactiveTokenContract],
  ])('test contract with inactive tokens %o', async (contract) => {
    // GIVEN
    const idTagDec = Math.random().toString()
    const idTagHexa = Math.random().toString()
    const idTagHexaInv = Math.random().toString()
    const cardNumber = Math.random().toString()
    leanMock.mockResolvedValueOnce(contract)

    // WHEN
    await associatePhysicalCard({
      contract, cardNumber, idTagDec, idTagHexa, idTagHexaInv
    })

    // SHOULD
    expect(updateOneMock).toBeCalledWith(
      expect.any(Object),
      {
        $set: {
          networks: expect.any(Array),
          contractIdInternationalNetwork: expect.any(Array),
          cardNumber,
          cardType: VIRTUAL_PHYSICAL,
          cardPhysicalState: true,
          cardPhysicalStateInfo: ACTIVE_INFO,
          activationDate: expect.any(Date),
        },
      }
    )

    expect(updateMock).nthCalledWith(
      1,
      {
        contractId: String(contract._id),
        userId: contract.userId,
        assetId: contract.evId,
        action: 'DEACTIVATE',
        tokenTypes: expect.arrayContaining([RFID]),
        networks: expect.arrayContaining([EVIO]),
        path: expect.any(String),
      }
    )

    expect(updateMock).nthCalledWith(
      2,
      {
        contractId: String(contract._id),
        userId: contract.userId,
        assetId: contract.evId,
        action: 'ACTIVATE',
        tokenTypes: expect.arrayContaining([RFID]),
        networks: expect.arrayContaining([MOBIE, GIREVE]),
        path: expect.any(String),
      }
    )

    if (contract.clientName === SALVADOR_CAETANO) {
      expect(updateCardSibsMock).toBeCalled()
    } else {
      expect(updateCardSibsMock).not.toBeCalled()
    }
  })

  it.each([
    [baseContract],
  ])('test rollback', async (contract) => {
    // GIVEN
    const idTagDec = Math.random().toString()
    const idTagHexa = Math.random().toString()
    const idTagHexaInv = Math.random().toString()
    const cardNumber = Math.random().toString()
    leanMock.mockResolvedValueOnce(contract)
    updateMock.mockRejectedValueOnce(new Error('Network error'))

    // WHEN
    await expect(associatePhysicalCard({
      contract, cardNumber, idTagDec, idTagHexa, idTagHexaInv
    })).rejects.toThrow(expect.anything())

    // SHOULD
    expect(updateOneMock).nthCalledWith(
      1,
      expect.any(Object),
      {
        $set: {
          networks: expect.any(Array),
          contractIdInternationalNetwork: expect.any(Array),
          cardNumber,
          cardType: VIRTUAL_PHYSICAL,
          cardPhysicalState: true,
          cardPhysicalStateInfo: ACTIVE_INFO,
          activationDate: expect.any(Date),
        },
      }
    )

    expect(updateMock).toBeCalledWith({
      contractId: String(contract._id),
      userId: contract.userId,
      assetId: contract.evId,
      action: 'ACTIVATE',
      tokenTypes: expect.arrayContaining([RFID]),
      networks: expect.arrayContaining([EVIO, MOBIE, GIREVE]),
      path: expect.any(String),
    })

    expect(updateOneMock).nthCalledWith(
      2,
      expect.any(Object),
      {
        $pull: {
          'networks.$[i].tokens': { tokenType: RFID },
          'contractIdInternationalNetwork.$[i].tokens': { tokenType: RFID },
        },
        $unset: {
          activationDate: true,
        },
        $set: {
        cardPhysicalStateInfo: VIRTUAL_ONLY,
        cardType: VIRTUAL_STATUS,
        cardPhysicalState: false,
        },
      },
      {
        arrayFilters: [{ 'i.tokens.tokenType': RFID }]
      }
    )

    expect(updateCardSibsMock).not.toBeCalled()
  })
})