require('dotenv-safe').load();

//TODO: Add the rest of the constants
export default {
    ContractType: {
        ContractTypeFleet: process.env.ContractTypeFleet || 'fleet',
        ContractTypeUser: process.env.ContractTypeUser || 'user',
    },
    contractStatusEnum: {
        contractStatusActive: process.env.contractStatusActive || 'active',
        contractStatusInactive:
            process.env.contractStatusInactive || 'inactive',
    },
    tokensTypes: {
        RFID: process.env.TokensTypeRFID || 'RFID',
        Other: process.env.TokensTypeOTHER || 'OTHER',
        AppUser: process.env.TokensTypeApp_User || 'APP_USER',
    },
    networks: {
        EVIO: process.env.NetworkEVIO || 'EVIO',
        Internal: process.env.NetworkInternal || 'Internal',
        Hyundai: process.env.NetworkHyundai || 'Hyundai',
        GoCharge: process.env.NetworkGoCharge || 'Go.Charge',
        MobiE: process.env.NetworkMobiE || 'MobiE',
        Gireve: process.env.NetworkGireve || 'Gireve',
        Hubject: process.env.NetworkHubject || 'Hubject',
        KLC: process.env.NetworkKLC || 'KLC',
        KINTO: process.env.NetworkKinto || 'KINTO',
    },
    cardTypes: {
        Virtual: process.env.CardTypeVirtual || 'Virtual',
        VirtualPhysical: process.env.CardTypeVirtualPhysical || 'Virtual_Physical',
    },
    cardPhysicalStateInfo: {
        active: process.env.CARDPHYSICALSTATEINFOACTIVE || 'ACTIVE',
        virtualOnly: process.env.CARDPHYSICALSTATEINFOVIRTUALONLY || 'VIRTUALONLY',
    },
    cardCancelReasons: {
        CancelledByCustomer: process.env.CARDPHYSICALSTATEINFOCANCELEDBYCUSTOMER || 'CANCELEDBYCUSTOMER'
    },
    ocpiApiKey:
        process.env.ocpiApiKey ||
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjbGllbnRUeXBlIjoiT0NQSSBTZW5kZXIiLCJjbGllbnROYW1lIjoiRVZJTyIsImlhdCI6MTY0MTAxMjM1MSwiZXhwIjo0NzY1MjE0NzUxfQ.9k_uq_9do8LQTgSe69qZf31KvIQj93p98Z9AtXgbqeU',
    endpointsOCPI: {
        HostMobie: process.env.HostMobie || 'https://api.mobie.pt',
        PathMobieTokens: process.env.PathMobieTokens || '/v1/tokens',
        PathGireveTokens: process.env.PathGireveTokens || '/v1/tokens',
        PathSendMultipleTokens:
            process.env.PathSendMultipleTokens || '/v1/tokens/send',
        PathTokensApi: process.env.PathTokensApi || '/v1/tokens',
    },
    networkStatus: {
        NetworkStatusActive: process.env.NetworkStatusActive || 'active',
        NetworkStatusInactive: process.env.NetworkStatusInactive || 'inactive',
        NetworkStatusToRequest:
            process.env.NetworkStatusToRequest || 'toRequest',
    },
    billingProfileStatus: {
        ACTIVE: process.env.BillingProfileStatusActive || 'active',
        INACTIVE: process.env.BillingProfileStatusInactive || 'inactive',
    },
    configService: {
        host: process.env.HostNotificationsDefinition || 'http://configs:3028',
        PathGetConfigs: '/api/private/config/customization'
    },
    clientNames: {
        SC: process.env.clientNameSC || 'Salvador Caetano'
    },
    middlewareIp: {
        MAX_ATTEMPTS_PER_FINGERPRINT: process.env.MAX_ATTEMPTS_PER_FINGERPRINT || 3,
        MAX_UNIQUE_IPS_PER_FINGERPRINT: process.env.MAX_UNIQUE_IPS_PER_FINGERPRINT || 2,
        rateLimitWindowMs: process.env.rateLimitWindowMs || 24 * 60 * 60 * 1000,
        rateLimitMax: process.env.rateLimitMax || 2,
    },
    paymentValidationEnum: {
        minAmountWallet: 30,
    }
};
