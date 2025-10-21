export const baseContract = {
    _id: "contract-123",
    userId: "user-456",
    evId: "asset-789",
    networks: [],
}

export const tokenInput = {
    idTagDec: "dec-1",
    idTagHexa: "hexa-2",
    idTagHexaInv: "hexa-inv-3",
    cardNumber: "CARD-0001",
}

export const updatedContractAfterActive = {
    ...baseContract,
    cardPhysicalState: true,
}
