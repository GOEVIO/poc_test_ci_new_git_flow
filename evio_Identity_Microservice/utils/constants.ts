/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable @typescript-eslint/no-explicit-any */
import dotenv from 'dotenv-safe';
import * as process from 'process';
import path from 'path';


dotenv.load();

// eslint-disable-next-line @typescript-eslint/no-var-requires,import/no-dynamic-require
const { name, version } = require(path.resolve('./package.json'));

export const logger = {};

const environment = process.env.NODE_ENV || 'development';

//Development energy contracts
let energy = {
    supplierName: process.env.EnergyContractSupplierName || 'ENGNE',
    contracts: {
        dailyBi: process.env.DevEnergyContractDiaBi || 'CT_HUQ87P9EOPC0JFE3GDU60UPPT1',
        dailyTri: process.env.DevEnergyContractDiaTri || 'CT_G6SML9HRDG0JCP9IE6TOQTIGT3',
        weeklyBi: process.env.DevEnergyContractSemBi || 'CT_ILPA216UQMRP0I9OT137R1HMR2',
        weeklyTri: process.env.DevEnergyContractSemTri || 'CT_TQNHA3QJNV3ILJGJSBVBLV5QU4'
    }
}

switch(environment){
    case 'production':  //Production energy contracts
        energy.contracts = {
            dailyBi: process.env.ProdEnergyContractDiaBi || 'CT_HUQ87P9EOPC0JFE3GDU60UPPTF',
            dailyTri: process.env.ProdEnergyContractDiaTri || 'CT_G6SML9HRDG0JCP9IE6TOQTIGT6',
            weeklyBi: process.env.ProdEnergyContractSemBi || 'CT_ILPA216UQMRP0I9OT137R1HMRC',
            weeklyTri: process.env.ProdEnergyContractSemTri || 'CT_TQNHA3QJNV3ILJGJSBVBLV5QUO'
        }
    break;
    case 'pre-production':  //Pre-production energy contracts
        energy.contracts = {
            dailyBi: process.env.PreProdEnergyContractDiaBi || 'CT_6K7KV9A2B9L52C0H32RHVAAEK9',
            dailyTri: process.env.PreProdEnergyContractDiaTri || 'CT_6DQK1TCMMJ3O2HIV3SC01HVGIC',
            weeklyBi: process.env.PreProdEnergyContractSemBi || 'CT_A1R819BUFVFMVNSGL025DBA8DO',
            weeklyTri: process.env.PreProdEnergyContractSemTri || 'CT_4QU1S9BJ8B9HBMNIHV9P90QUJA'
        }
    break;
}

export default {
    app: {
        name,
        version,
    },
    services: {
        payments: {
            host: process.env.HostPayments || 'http://localhost:3017',
            getPaymentWalletData: '/api/private/payment/wallet',
            PathPaymentMethods: '/api/private/paymentMethods',
            getTransactionByUserId: '/api/private/transactions/byUser',
        },
        connectionStation: process.env.HostConnetionStation || 'http://localhost:3004',

        //TODO: remove this when is possible and follow the same pattern as the other services
        notifications: process.env.HostNotifications || 'http://localhost:3008',

        ocpi22: {
            host: process.env.HostMobie || 'http://localhost:3019',
            getSessionByTransactionId: '/api/private/ocpi/sessions/byTransactionId'
        },
        chargers: {
            host: process.env.HostCharger || 'http://localhost:3002',
            getSessionById: '/api/private/chargingSession/Query'
        },
        authorization: {
            host: process.env.HostAuthorization || 'http://localhost:3001',
            validTokens: '/api/validTokens'
        },
        evs: {
            host: process.env.HostEv || 'http://localhost:3001',
            PathGetFleetById: process.env.PathGetFleetById || '/api/private/fleets/byId'
        },
        notification: {
            host: process.env.HostNotifications || 'http://localhost:3008',
            pathNotificationsChangeNumber: '/api/private/smsNotifications/changeNumber',
            pathNotificationsActivation: '/api/private/smsNotifications/activation',
            pathNotificationsSendEmail: '/api/private/sendEmail',
            pathGroupCSUsers: '/api/private/smsNotifications/groupCSUsers',
            pathNotificationsToUser: '/api/private/firebase/session/sendNotificationToUser',
            pathNotificationsFirebaseUserTokens: process.env.PathNotificationFirebaseUserTokens || '/api/private/firebase/firebaseUserTokens'
        },
        statitics: {
            host: process.env.HostStatistics || 'http://localhost:3031',
            PathAnonymizeUserDataHistory: '/api/private/history_v2/anonymizeUserDataHistory',
        },
    },
    configs: {
        jobFaildConnectionACP: {
            limit: 10,
            awaitTime: 5000,
        },
    },
    providers: {
        europeCommission: {
            wsdl: 'https://ec.europa.eu/taxation_customs/vies/checkVatService.wsdl',
            wsdlTin:
                'https://ec.europa.eu/taxation_customs/tin/services/checkTinService.wsdl',
        },
        goCharge: {
            host: process.env.HostToken,
            auth: {
                username: process.env.UserNameWebserviceGoCharge,
                password: process.env.KeyWebserviceGoCharge,
            },
        },
        hyundai: {
            hostGetToken: process.env.hyundaiGetToken,
            clientId: process.env.HYUNDAI_CLIENT_ID,
            scope: process.env.HYUNDAI_CLIENT_SCOPE,
            clientSecret: process.env.HYUNDAI_CLIENT_SECRET,
            grantType: process.env.hyundaiGranType,
            brand: process.env.hyundaiBrand,
            putData: process.env.hyundaiPutData,
        },
        sentry: {
            dsn:
                process.env.SENTRY_DSN
                || 'https://2c2e2a86736591ee1ad4a8eec691927c@o4505861147131904.ingest.us.sentry.io/4505861160501248',
            traceSampleRate: Number(
                process.env.SENTRY_TRACE_SAMPLE_RATE || 0.01
            ),
            profilesSampleRate: Number(
                process.env.SENTRY_PROFILES_SAMPLE_RATE || 0.01
            ),
            ignoredTransactions: [
                '/api/validateUsers',
                '/api/private/users/allInfoById',
                '/api/private/users/account',
            ],
        },
        google: {
            mapsApiKey:
                process.env.MAPS_APIKEY
                || 'AIzaSyA5LQa9u8qjhabyiQXZYALHUP2_zjQBwtU',
        },
    },
    customers: {
        caetanoGOList: 'Salvador Caetano',
    },
    environment: process.env.NODE_ENV || 'development',
    mongo: {
        options: {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            keepAlive: true,
            useFindAndModify: false,
            dbName: 'identityDB'
        },
        URI: String(process.env.DB_URI).replace('{database}', 'identityDB'),
    },
    pagination: {
        defaultLimit: 10,
    },
    users: {
        default: {
            evioCommission: {
                minAmount: {
                    uom: 'un',
                    value: 0,
                },
                transaction: {
                    uom: 'percentage',
                    value: 0,
                },
            },
            packages: {
                b2b: {
                    packageName: 'FREE',
                    packageType: 'FREE',
                    rfidCardsLimit: 1,
                    fleetsLimit: 100,
                    evsLimit: 500,
                    driversLimit: 500,
                    groupOfDriversLimit: 500,
                    driversInGroupDriversLimit: 500,
                    chargingAreasLimit: 25,
                    evioBoxLimit: 25,
                    chargersLimit: 500,
                    tariffsLimit: 500,
                    chargersGroupsLimit: 100,
                    userInChargerGroupsLimit: 500,
                    searchLocationsLimit: 'UNLIMITED',
                    searchChargersLimit: 'UNLIMITED',
                    comparatorLimit: 'UNLIMITED',
                    routerLimit: 'UNLIMITED',
                    cardAssociationEnabled: false,
                    billingTariffEnabled: false,
                },
                b2c: {
                    packageName: 'FREE',
                    packageType: 'FREE',
                    rfidCardsLimit: 1,
                    fleetsLimit: 100,
                    evsLimit: 500,
                    driversLimit: 500,
                    groupOfDriversLimit: 500,
                    driversInGroupDriversLimit: 500,
                    chargingAreasLimit: 25,
                    evioBoxLimit: 25,
                    chargersLimit: 500,
                    tariffsLimit: 500,
                    chargersGroupsLimit: 100,
                    userInChargerGroupsLimit: 500,
                    searchLocationsLimit: 'UNLIMITED',
                    searchChargersLimit: 'UNLIMITED',
                    comparatorLimit: 'UNLIMITED',
                    routerLimit: 'UNLIMITED',
                    cardAssociationEnabled: false,
                    billingTariffEnabled: false,
                },
            },
        },
    },
    portugueseMobilePrefix: '+351',
    clientTypes: {
        ClientB2B: process.env.ClientTypeB2B || 'b2b',
        ClientB2C: process.env.ClientTypeB2C || 'b2c',
    },
    contractTypes: {
        user: process.env.ContractTypeUser || 'user',
        fleet: process.env.ContractTypeFleet || 'fleet',
    },
    OperationsManagement: {
        id:
            process.env.OperationsManagementID || '8881230584541208',
        language:
            process.env.OperationsManagementLanguage || 'PT',
        OperationsManagementID:
            process.env.OperationsManagementID || '8881230584541208',
        OperationsManagementLanguage:
            process.env.OperationsManagementLanguage || 'PT',
    },
    externalEndpoints: {
        Payment: {
            Host: process.env.HostPayments || 'http://payments:3017',
            PathCheckUserDebt: process.env.PathCheckUserDebt || '/api/private/payments/checkUserHasDebt',
        }
    },
    clientNames: {
        evio: 'EVIO',
        salvadorCaetano: 'Salvador Caetano',
        acp: 'ACP',
        hyundai: 'Hyundai',
        kinto: 'KINTO',
        klc: 'KLC'
    },
    energy,
    emails: {
        SupportEvio: process.env.EMAIL_SUPPORT || 'support@go-evio.com',
        SupportACP: process.env.EMAIL_SUPPORT_ACP || 'support@go-evio.com',
        SupportHyundai: process.env.EMAIL_SUPPORT_HYUNDAI || 'support@go-evio.com',
        SupportKLC: process.env.EMAIL_SUPPORT_KLC || 'support@go-evio.com',
        SupportGoCharge: process.env.EMAIL_SUPPORT_GO_CHARGE || 'support@go-evio.com',
        Sales: process.env.EMAIL_SALES || 'sales@go-evio.com',
        QaTest: process.env.QAEmailTest || 'qa.goevio@gmail.com'
    },
    defaultLanguage: process.env.DEFAULT_LANGUAGE || 'en_GB',
    billingPaymentConditionsPrompt: process.env.PromptPayment || 'Prompt_Payment'
};
