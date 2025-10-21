import { describe, it, jest, expect, afterEach, afterAll, beforeAll } from '@jest/globals'

const updateNetworkStatusMock: jest.Mock<any> = jest.fn()
const addRfidTokensToContractMock: jest.Mock<any> = jest.fn()
const findOneAndUpdateMock: jest.Mock<any> = jest.fn()
const updateContractMock: jest.Mock<any> = jest.fn()
const leanMock: jest.Mock<any> = jest.fn()

jest.mock('evio-library-commons', () => ({
    __esModule: true,
    TokenTypes: { RFID: 'RFID' },
    CardPhysicalStateInfo: {
        associated: 'associated',
        active: 'active',
        virtualOnly: 'virtualOnly',
    },
}))

jest.mock('evio-library-assets', () => ({
    __esModule: true,
    default: updateNetworkStatusMock,
    updateNetworkStatus: updateNetworkStatusMock,
}))

jest.mock('../../../services/add-rfid-to-networks', () => ({
    addRfidTokensToContract: addRfidTokensToContractMock,
}))

jest.mock('../../../models/contracts', () => ({
    __esModule: true,
    default: {
        findOneAndUpdate: findOneAndUpdateMock,
        update: updateContractMock,
    },
}))

import { createActiveRfidTokens } from '../../../services/create-activate-rfid-tokens'
import { baseContract, tokenInput, updatedContractAfterActive } from './contract.mock'

const { TokenTypes, CardPhysicalStateInfo } = require('evio-library-commons') as any
const RFID = TokenTypes.RFID

describe('createActiveRfidTokens unit tests (valid=true only)', () => {
    const path = '/tests/create-activate-rfid-tokens'
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    beforeAll(() => {
        updateNetworkStatusMock.mockResolvedValue({ code: 'ok' })
        addRfidTokensToContractMock.mockResolvedValue(undefined)
        updateContractMock.mockResolvedValue({ acknowledged: true })
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    afterAll(() => {
        jest.restoreAllMocks()
        consoleErrorSpy.mockRestore()
    })

    describe('Happy path', () => {
        it('creates tokens, sends ACTIVATE, and marks contract as active', async () => {
            findOneAndUpdateMock.mockReturnValue({
                lean: leanMock.mockResolvedValueOnce(updatedContractAfterActive),
            })

            const result = await createActiveRfidTokens({
                contract: baseContract as any,
                idTagDec: tokenInput.idTagDec,
                idTagHexa: tokenInput.idTagHexa,
                idTagHexaInv: tokenInput.idTagHexaInv,
                cardNumber: tokenInput.cardNumber,
                path,
            })

            // 1) adds tokens
            expect(addRfidTokensToContractMock).toHaveBeenCalledWith(baseContract, {
                cardNumber: tokenInput.cardNumber,
                idTagDec: tokenInput.idTagDec,
                idTagHexa: tokenInput.idTagHexa,
                idTagHexaInv: tokenInput.idTagHexaInv,
            })

            // 2) updates network with ACTIVATE
            expect(updateNetworkStatusMock).toHaveBeenCalledWith({
                contractId: String(baseContract._id),
                userId: baseContract.userId,
                assetId: baseContract.evId,
                action: 'ACTIVATE',
                tokenTypes: [RFID],
                path,
            })

            // 3) DB: set active
            expect(findOneAndUpdateMock).toHaveBeenCalledWith(
                { _id: baseContract._id },
                { $set: { cardPhysicalState: true } },
                { returnDocument: 'after' }
            )

            expect(result).toEqual(updatedContractAfterActive)
            // no rollback on success
            expect(updateContractMock).not.toHaveBeenCalled()
        })
    })

    describe('False positives – ensure we do NOT do what belongs only to the invalid flow', () => {
        it('must NOT unset activationDate nor set processedThirdPartyDate/cardPhysicalStateInfo.associated', async () => {
            findOneAndUpdateMock.mockImplementation((_query, update) => {
                // negative checks
                expect(update.$unset).toBeUndefined()
                expect(update.$set).toBeDefined()
                expect(update.$set.cardPhysicalState).toBe(true)
                expect(update.$set.processedThirdPartyDate).toBeUndefined()
                expect(update.$set.cardPhysicalStateInfo).toBeUndefined()
                return { lean: () => Promise.resolve(updatedContractAfterActive) }
            })

            await createActiveRfidTokens({
                contract: baseContract as any,
                ...tokenInput,
                path,
            })
        })
    })

    describe('Error handling + rollback + call ordering', () => {
        it('ROLLBACK and throw if updateNetworkStatus fails', async () => {
            updateNetworkStatusMock.mockRejectedValueOnce(new Error('network down'))

            await expect(
                createActiveRfidTokens({
                    contract: baseContract as any,
                    ...tokenInput,
                    path,
                })
            ).rejects.toThrow('network down')

            // tokens were attempted
            expect(addRfidTokensToContractMock).toHaveBeenCalledTimes(1)
            // updateNetworkStatus failed
            expect(updateNetworkStatusMock).toHaveBeenCalledTimes(1)

            // should NOT set active after network failure
            expect(findOneAndUpdateMock).not.toHaveBeenCalled()

            // rollback called with associated + unset activationDate
            expect(updateContractMock).toHaveBeenCalledWith(
                { _id: baseContract._id },
                {
                    $unset: { activationDate: true },
                    $set: { cardPhysicalStateInfo: CardPhysicalStateInfo.associated },
                }
            )

            // error log with proper prefix
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('[createActiveRfidTokens][error]'),
                expect.any(Error)
            )
        })

        it('ROLLBACK and throw if addRfidTokensToContract fails (no network call)', async () => {
            addRfidTokensToContractMock.mockRejectedValueOnce(new Error('boom'))

            await expect(
                createActiveRfidTokens({
                    contract: baseContract as any,
                    ...tokenInput,
                    path,
                })
            ).rejects.toThrow('boom')

            expect(updateNetworkStatusMock).not.toHaveBeenCalled()
            expect(findOneAndUpdateMock).not.toHaveBeenCalled()

            // rollback still called (service tries to revert any partial state)
            expect(updateContractMock).toHaveBeenCalledWith(
                { _id: baseContract._id },
                {
                    $unset: { activationDate: true },
                    $set: { cardPhysicalStateInfo: CardPhysicalStateInfo.associated },
                }
            )
        })

        it('ROLLBACK and throw if findOneAndUpdate/lean fails', async () => {
            addRfidTokensToContractMock.mockResolvedValue(undefined)
            updateNetworkStatusMock.mockResolvedValue(undefined)

            findOneAndUpdateMock.mockReturnValue({
                lean: () => Promise.reject(new Error('update failed')),
            })

            await expect(
                createActiveRfidTokens({
                    contract: baseContract as any,
                    ...tokenInput,
                    path,
                })
            ).rejects.toThrow('update failed')

            // rollback invoked
            expect(updateContractMock).toHaveBeenCalledWith(
                { _id: baseContract._id },
                {
                    $unset: { activationDate: true },
                    $set: { cardPhysicalStateInfo: CardPhysicalStateInfo.associated },
                }
            )
        })

        it('ensures call order on success: addRfidTokensToContract before updateNetworkStatus', async () => {
            findOneAndUpdateMock.mockReturnValue({
                lean: leanMock.mockResolvedValueOnce(updatedContractAfterActive),
            })

            await createActiveRfidTokens({
                contract: baseContract as any,
                ...tokenInput,
                path,
            })

            expect(addRfidTokensToContractMock.mock.invocationCallOrder[0])
                .toBeLessThan(updateNetworkStatusMock.mock.invocationCallOrder[0])
        })
    })
})
