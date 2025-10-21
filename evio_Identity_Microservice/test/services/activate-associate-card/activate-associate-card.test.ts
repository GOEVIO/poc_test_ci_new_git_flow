// test/services/activate-associate-card/activate-associate-card.test.ts
import { describe, it, jest, expect, beforeAll, afterAll, afterEach } from '@jest/globals'

const updateNetworkStatusMock: jest.Mock<any> = jest.fn()
const updateOneMock: jest.Mock<any> = jest.fn()
const findOneMock: jest.Mock<any> = jest.fn()
const leanMock: jest.Mock<any> = jest.fn()
const sendEmailClientMock: jest.Mock<any> = jest.fn()

jest.mock('evio-library-commons', () => ({
    __esModule: true,
    fieldEquals: (field: string, value: string) => (obj: any) => obj[field] === value,
    NetworkStatus: { Active: 'Active' },
    TokenTypes: { RFID: 'RFID', AppUser: 'AppUser', Other: 'Other' },
    CardPhysicalStateInfo: { active: 'active' },
    ChargerNetworks: { Gireve: 'Gireve' },
    CardType: { VirtualPhysical: 'VirtualPhysical' },
}))

jest.mock('evio-library-assets', () => ({
    __esModule: true,
    default: updateNetworkStatusMock,
    updateNetworkStatus: updateNetworkStatusMock,
}))

jest.mock('../../../routes/contracts', () => ({
    sendEmailClient: sendEmailClientMock,
}))

jest.mock('../../../models/contracts', () => ({
    __esModule: true,
    default: {
        updateOne: updateOneMock,
        findOne: findOneMock,
    },
}))

import { activateAssociateCard } from '../../../services/activate-associate-card'
import { baseContract, contractWithInvalidTokens, updatedContract } from './contract.mock'

describe('activateAssociateCard unit tests', () => {
    const path = 'PATCH /api/private/contracts/validateCard'
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    beforeAll(() => {
        updateNetworkStatusMock.mockResolvedValue({ code: 'ok' })
        updateOneMock.mockResolvedValue({})
        findOneMock.mockReturnValue({ lean: leanMock })
        leanMock.mockResolvedValue(updatedContract)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    afterAll(() => {
        jest.restoreAllMocks()
        consoleErrorSpy.mockRestore()
    })

    it('activates and deactivates RFID tokens based on valid/invalid networks', async () => {
        const result = await activateAssociateCard({
            contract: baseContract,
            cardNumber: 'CARD-0001',
            idTagDec: 'dec',
            idTagHexa: 'hexa',
            idTagHexaInv: 'inv',
        })

        expect(updateNetworkStatusMock).toHaveBeenCalledWith(
            expect.objectContaining({
                contractId: String(baseContract._id),
                action: 'DEACTIVATE',
                networks: expect.arrayContaining(['Gireve']),
                tokenTypes: ['RFID'],
                path,
            })
        )

        expect(updateNetworkStatusMock).toHaveBeenCalledWith(
            expect.objectContaining({
                contractId: String(baseContract._id),
                action: 'ACTIVATE',
                networks: expect.arrayContaining(['Evio']),
                tokenTypes: ['RFID'],
                path,
            })
        )

        expect(updateOneMock).toBeCalledWith(
            { _id: baseContract._id },
            expect.objectContaining({
                $set: expect.objectContaining({
                    cardNumber: 'CARD-0001',
                    cardType: 'VirtualPhysical',
                    cardPhysicalState: true,
                    cardPhysicalStateInfo: 'active',
                    activationDate: expect.any(Date),
                }),
            })
        )

        expect(sendEmailClientMock).toBeCalledWith(
            expect.objectContaining({
                to: baseContract.email,
                type: 'activeCard',
            }),
            baseContract.clientName
        )

        expect(result).toEqual(updatedContract)
    })

    it('throws and sends error email if updateNetworkStatus fails', async () => {
        updateNetworkStatusMock.mockRejectedValueOnce(new Error('network down'))

        await expect(
            activateAssociateCard({
                contract: contractWithInvalidTokens,
                cardNumber: 'CARD-0001',
                idTagDec: 'dec',
                idTagHexa: 'hexa',
                idTagHexaInv: 'inv',
            })
        ).rejects.toThrow(
            /\[activateAssociateCard\] Error Failed to activate RFID tokens network down/
        )

        expect(sendEmailClientMock).toBeCalledWith(
            expect.objectContaining({
                type: 'activeCardError',
                message: expect.any(Object),
            }),
            contractWithInvalidTokens.clientName
        )
    })
})
