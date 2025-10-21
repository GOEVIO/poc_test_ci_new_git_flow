export const baseContract = {
    _id: 'contract-xyz',
    userId: 'user-123',
    evId: 'asset-456',
    networks: [],
    contractIdInternationalNetwork: [],
};

export const withNetworksNoRFID = {
    ...baseContract,
    networks: [
        { network: 'EVIO', tokens: [] },
        { network: 'OTHER', tokens: [] },
    ],
    contractIdInternationalNetwork: [
        { network: 'Gireve', tokens: [] },
    ],
};

export const withNetworksWithRFID = {
    ...baseContract,
    networks: [
        { network: 'EVIO', tokens: [{ tokenType: 'RFID', idTagDec: 'old', idTagHexa: 'OLD', idTagHexaInv: 'OLDI' }] },
    ],
    contractIdInternationalNetwork: [
        { network: 'Gireve', tokens: [{ tokenType: 'RFID', contract_id: '' }] },
    ],
};

export const cardDataSample = {
    idTagDec: 'dec-123',
    idTagHexa: 'aa11bb22',
    idTagHexaInv: 'cc33dd44',
    cardNumber: 'CARD-9999',
};
