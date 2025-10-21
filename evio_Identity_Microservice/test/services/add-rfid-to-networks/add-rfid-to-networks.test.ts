import { describe, it, jest, expect, beforeEach, afterAll } from '@jest/globals'

// --- Mocks
const updateNetworkStatusMock: jest.Mock<any> = jest.fn()
const updateOneMock: jest.Mock<any> = jest.fn()
const findOneMock: jest.Mock<any> = jest.fn()
const findOneAndUpdateMock: jest.Mock<any> = jest.fn()

jest.mock('evio-library-commons', () => ({
    __esModule: true,
    // mimic the helper used in the code
    fieldEquals: (key: string, value: any) => (obj: any) => obj?.[key] === value,
    TokenTypes: { RFID: 'RFID' },
    ChargerNetworks: { Gireve: 'Gireve' },
    CardType: { VirtualPhysical: 'VirtualPhysical', Virtual: 'Virtual' },
    CardPhysicalStateInfo: { active: 'active', virtualOnly: 'virtualOnly' },
}))

jest.mock('evio-library-assets', () => ({
    __esModule: true,
    default: updateNetworkStatusMock,
    updateNetworkStatus: updateNetworkStatusMock,
}))

jest.mock('../../../models/contracts', () => ({
    __esModule: true,
    default: {
        updateOne: updateOneMock,
        findOne: findOneMock,
        findOneAndUpdate: findOneAndUpdateMock,
    },
}))

import { addRfidTokensToContract, addRFIDToNetworks } from '../../../services/add-rfid-to-networks'
import {
    baseContract,
    withNetworksNoRFID,
    withNetworksWithRFID,
    cardDataSample,
} from './contract.mock'

describe('add-rfid-to-networks service', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    afterAll(() => {
        jest.restoreAllMocks()
    })

    describe('addRfidTokensToContract', () => {
        it('creates RFID tokens when missing, uppercases HEX fields, adds Gireve token, and updates contract fields', async () => {
            // Arrange
            const contract = JSON.parse(JSON.stringify(withNetworksNoRFID))

            updateOneMock.mockResolvedValue({ acknowledged: true })

            // Act
            await addRfidTokensToContract(contract, cardDataSample)

            // Assert - updateOne called with proper $set payload
            expect(updateOneMock).toHaveBeenCalledTimes(1)
            const call = updateOneMock.mock.calls[0]
            expect(call[0]).toEqual({ _id: contract._id })

            const setPayload = (call[1] as any).$set
            expect(setPayload).toBeDefined()
            // networks updated: each network now has an RFID token with correct fields
            const evio = setPayload.networks.find((n: any) => n.network === 'EVIO')
            expect(evio.tokens[0]).toEqual(
                expect.objectContaining({
                    tokenType: 'RFID',
                    status: 'inactive',
                    idTagDec: cardDataSample.idTagDec,
                    idTagHexa: cardDataSample.idTagHexa.toUpperCase(),
                    idTagHexaInv: cardDataSample.idTagHexaInv.toUpperCase(),
                    wasAssociated: false,
                })
            )

            // international network Gireve now has a RFID token if missing
            const gireve = setPayload.contractIdInternationalNetwork.find((n: any) => n.network === 'Gireve')
            expect(gireve.tokens.some((t: any) => t.tokenType === 'RFID')).toBe(true)

            // card fields updated
            expect(setPayload).toMatchObject({
                cardNumber: cardDataSample.cardNumber,
                cardType: 'VirtualPhysical',
                cardPhysicalState: true,
                cardPhysicalStateInfo: 'active',
                activationDate: expect.any(Date),
            })
        })

        it('updates existing RFID tokens instead of duplicating, and does not duplicate Gireve RFID', async () => {
            // Arrange
            const contract = JSON.parse(JSON.stringify(withNetworksWithRFID))
            updateOneMock.mockResolvedValue({ acknowledged: true })

            // Act
            await addRfidTokensToContract(contract, cardDataSample, true /* wasAssociated */)

            // Assert: existing RFID token updated (not duplicated)
            const evioNet = contract.networks.find((n: any) => n.network === 'EVIO')
            expect(evioNet.tokens.length).toBe(1)
            expect(evioNet.tokens[0]).toEqual(
                expect.objectContaining({
                    tokenType: 'RFID',
                    idTagDec: cardDataSample.idTagDec,
                    idTagHexa: cardDataSample.idTagHexa.toUpperCase(),
                    idTagHexaInv: cardDataSample.idTagHexaInv.toUpperCase(),
                })
            )

            // Gireve already had RFID; remains single
            const gireve = contract.contractIdInternationalNetwork.find((n: any) => n.network === 'Gireve')
            expect(gireve.tokens.filter((t: any) => t.tokenType === 'RFID').length).toBe(1)

            // updateOne called with fields (wasAssociated flag only exists inside tokens created newly; here we updated existing)
            expect(updateOneMock).toHaveBeenCalledTimes(1)
            const setPayload = (updateOneMock.mock.calls[0][1] as any).$set
            expect(setPayload).toMatchObject({
                cardNumber: cardDataSample.cardNumber,
                cardType: 'VirtualPhysical',
                cardPhysicalState: true,
                cardPhysicalStateInfo: 'active',
                activationDate: expect.any(Date),
            })
        })
    })

    describe('addRFIDToNetworks', () => {
        it('activates networks and returns the merged updated contract (happy path)', async () => {
            // Arrange
            const contract = JSON.parse(JSON.stringify(withNetworksNoRFID))
            updateNetworkStatusMock.mockResolvedValue({ code: 'ok' })
            updateOneMock.mockResolvedValue({ acknowledged: true })
            // findOne().lean() returns fresh doc
            findOneMock.mockReturnValue({ lean: () => Promise.resolve({ refreshed: true, extra: 'value' }) })

            // Act
            const result = await addRFIDToNetworks({ contract, cardData: cardDataSample })

            // Assert
            // updateNetworkStatus called with ACTIVATE + PATH
            expect(updateNetworkStatusMock).toHaveBeenCalledWith({
                contractId: String(contract._id),
                userId: contract.userId,
                assetId: contract.evId,
                tokenTypes: ['RFID'],
                action: 'ACTIVATE',
                path: 'PATCH /api/private/cards/activate',
            })

            // fetched updated contract and merged into original
            expect(findOneMock).toHaveBeenCalledWith({ _id: contract._id })
            expect(result).toEqual(expect.objectContaining({ refreshed: true, extra: 'value' }))
        })

        it('rolls back and rethrows when updateNetworkStatus fails', async () => {
            // Arrange
            const contract = JSON.parse(JSON.stringify(withNetworksWithRFID))
            updateNetworkStatusMock.mockRejectedValueOnce(new Error('gateway timeout'))
            updateOneMock.mockResolvedValue({ acknowledged: true })
            // rollback uses findOneAndUpdate with $pull/$set/$unset + arrayFilters
            findOneAndUpdateMock.mockResolvedValue({ lean: () => Promise.resolve({}) })

            // Act / Assert
            await expect(
                addRFIDToNetworks({ contract, cardData: cardDataSample })
            ).rejects.toThrow('failed to activate card and successfully rolled-back')

            // rollback executed with expected shape
            expect(findOneAndUpdateMock).toHaveBeenCalledWith(
                { _id: contract._id },
                expect.objectContaining({
                    $pull: {
                        'networks.$[i].tokens': { tokenType: 'RFID' },
                        'contractIdInternationalNetwork.$[i].tokens': { tokenType: 'RFID' },
                    },
                    $set: {
                        cardType: 'Virtual',
                        cardPhysicalState: false,
                        cardPhysicalStateInfo: 'virtualOnly',
                    },
                    $unset: {
                        cardNumber: true,
                        activationDate: true,
                    },
                }),
                expect.objectContaining({
                    returnDocument: 'after',
                    arrayFilters: [{ 'i.tokens.tokenType': 'RFID' }],
                })
            )
        })
    })
})
