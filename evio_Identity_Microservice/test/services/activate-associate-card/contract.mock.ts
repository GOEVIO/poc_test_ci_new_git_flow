export const baseContract = {
    _id: 'contract-123',
    userId: 'user-456',
    evId: 'asset-789',
    name: 'John Doe',
    email: 'john@example.com',
    clientName: 'EVIO',
    networks: [
        {
            network: 'Evio',
            tokens: [{ tokenType: 'AppUser', status: 'Active' }],
        },
        {
            network: 'Gireve',
            tokens: [{ tokenType: 'Other', status: 'Inactive' }],
        },
    ],
}

export const contractWithInvalidTokens = {
    ...baseContract,
    networks: [
        {
            network: 'Evio',
            tokens: [{ tokenType: 'AppUser', status: 'Inactive' }],
        },
        {
            network: 'Gireve',
            tokens: [{ tokenType: 'Other', status: 'Inactive' }],
        },
    ],
}

export const updatedContract = {
    ...baseContract,
    cardNumber: 'CARD-0001',
    cardType: 'VirtualPhysical',
    cardPhysicalState: true,
    cardPhysicalStateInfo: 'active',
}
