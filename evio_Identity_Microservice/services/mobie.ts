import { captureException } from '@sentry/node';
import axios from 'axios';
// Constants
import env from '../constants/env';
// Handlers
import ContractHandler from '../handlers/contracts';

const commonLog = '[Service mobie';

function getTokenIdTag(
    obj,
    networkName: string,
    tokenType: string
): string | boolean {
    const network = obj.networks.find(
        (network) => network.network === networkName
    );
    if (network) {
        const token = network.tokens.find(
            (token) => token.tokenType === tokenType
        );
        if (token) {
            if (token.idTagDec) return token.idTagDec;
            if (token.idTagHexa) return token.idTagHexa;
            if (token.idTagHexaInv) return token.idTagHexaInv;
        }
    }
    return false;
}

async function updateMobieToken(body, userId: string) {
    const context = `${commonLog} updateMobieToken ]`;
    try {
        const config = {
            headers: {
                userid: userId,
                apikey: env.ocpiApiKey,
            },
        };
        const host = `${env.endpointsOCPI.HostMobie}${env.endpointsOCPI.PathMobieTokens}`;

        const response = await axios.patch(host, body, config);
        if (!response) {
            console.error(`${context} Error `, 'No response from MobiE');
            throw new Error('No response from MobiE');
        }
        console.log(`MobiE ${body.type} token updated`);
        return response;
    } catch (error) {
        console.error(`${context} Error `, error.message);
        captureException('Fail to deactivate token in MobiE');
        return { data: { auth: false } };
    }
}

async function inactiveMobie(contractFound, userId: string, received): Promise<undefined> {
    const context = `${commonLog} inactiveMobie ]`;
    try {
        let appUserUid = await getTokenIdTag(
            contractFound,
            'MobiE',
            'APP_USER'
        );

        if (!appUserUid) {
            appUserUid = await getTokenIdTag(contractFound, 'EVIO', 'APP_USER');
        }

        let body = {
            country_code: 'PT',
            party_id: 'EVI',
            type: 'APP_USER',
            uid: appUserUid,
            valid: false,
        };

        const result = await updateMobieToken(body, userId);
        if (result?.data?.auth === false) {
            console.log('Result - updateMobieToken', result.data);
        } else {
            const found = contractFound.networks.find((network) => {
                return network.tokens.find((token) => {
                    return (
                        token.tokenType === env.tokensTypes.RFID &&
                        network.network === received.network &&
                        token.status !== env.networkStatus.NetworkStatusInactive
                    );
                });
            });
            if (found) {
                appUserUid = await getTokenIdTag(
                    contractFound,
                    'MobiE',
                    'RFID'
                );

                if (!appUserUid) {
                    appUserUid = await getTokenIdTag(
                        contractFound,
                        'EVIO',
                        'RFID'
                    );
                }

                body = {
                    country_code: 'PT',
                    party_id: 'EVI',
                    type: env.tokensTypes.RFID,
                    uid: appUserUid,
                    valid: false,
                };

                const response = await updateMobieToken(body, userId);

                if (response?.data?.auth === false) {
                    console.log('Result - updateMobieToken', response.data);
                    return;
                }
            }
            console.log('Mobie Contract inactivated');
        }
    } catch (err) {
        console.error(`${context} Error `, err.message);
        captureException(err);
    }
}

async function activeMobie(
    contractFound,
    userId: string,
    received
): Promise<undefined> {
    const context = `${commonLog} activeMobie ]`;
    try {
        let appUserUid;
        let body;

        appUserUid = await getTokenIdTag(contractFound, 'MobiE', 'APP_USER');

        if (!appUserUid)
            appUserUid = await getTokenIdTag(contractFound, 'EVIO', 'APP_USER');

        body = {
            country_code: 'PT',
            party_id: 'EVI',
            type: 'APP_USER',
            uid: appUserUid,
            valid: true,
        };

        const result = await updateMobieToken(body, userId);
        if (result.data.auth === false) {
            console.log('Result - updateMobieToken', result.data);
            return;
        }
        let found = contractFound.networks.find((network) => {
            return network.tokens.find((token) => {
                return (
                    token.tokenType === env.tokensTypes.RFID &&
                    network.network === received.network &&
                    token.status !== env.networkStatus.NetworkStatusInactive
                );
            });
        });

        if (found) {
            appUserUid = await getTokenIdTag(contractFound, 'MobiE', 'RFID');

            if (!appUserUid)
                appUserUid = await getTokenIdTag(contractFound, 'EVIO', 'RFID');

            body = {
                country_code: 'PT',
                party_id: 'EVI',
                type: 'RFID',
                uid: appUserUid,
                valid: true,
            };

            const updateMobie = await updateMobieToken(body, userId);
            if (updateMobie.data.auth === false) {
                console.log('Result - updateMobieToken', updateMobie.data);
                return;
            }
        }
        console.log('Contract inactivated');
    } catch (error) {
        console.error(`${context} Error `, error.message);
        captureException(error);
    }
}

export default { inactiveMobie, getTokenIdTag, activeMobie };
