import { captureException, captureMessage } from '@sentry/node';
import axios from 'axios';

import mobieController from './mobie';
import env from '../constants/env';

const commonLog = '[Service gireve';

async function updateGireveToken(body, userId: string) {
    const context = `${commonLog} updateGireveToken ]`;
    try {
        const config = {
            headers: {
                userid: userId,
                apikey: env.ocpiApiKey,
            },
        };
        const host = `${env.endpointsOCPI.HostMobie}${env.endpointsOCPI.PathGireveTokens}`;

        const response = await axios.patch(host, body, config);
        if (!response) {
            console.error(`${context} Error `, 'No response from Gireve');
            const newError = new Error('No response from Gireve');
            captureException(newError);
            return { data: { auth: false } };
        }
        console.log(`Gireve ${body.type} token updated`);
        return response;
    } catch (error) {
        console.error(`${context} Error `, error.message);
        return { data: { auth: false } };
    }
}

function getTokenIdTagHexa(obj, networkName: string, tokenType: string) {
    const network = obj.networks.find(
        (network) => network.network === networkName
    );
    if (!network) return null;
    const token = network.tokens.find((token) => token.tokenType === tokenType);
    if (token) {
        return token.idTagHexa;
    }
    return null;
}

async function inactiveGireve(
    contractFound,
    userId,
    received
): Promise<undefined> {
    const context = `${commonLog} inactiveGireve ]`;
    try {
        let type = env.tokensTypes.Other;
        let uid = await mobieController.getTokenIdTag(
            contractFound,
            received.network,
            `${env.tokensTypes.Other}`
        );

        if (!uid) {
            uid = await getTokenIdTagHexa(
                contractFound,
                received.network,
                `${env.tokensTypes.RFID}`
            );
            if (!uid) {
                console.error('No token found');
                const newError = new Error('No token found');
                captureException(newError);
                throw newError;
            }
            type = env.tokensTypes.RFID;
        }

        const body = {
            type,
            uid,
            valid: false,
        };

        const result = await updateGireveToken(body, userId);

        if (result?.data?.auth === false) {
            console.log('Result - updateGireveToken', result.data);
            console.error(
                `${context} Error `,
                'Fail to deactivate Token in Gireve ',
                result
            );
            captureException(new Error('Fail to deactivate Token in Gireve'));
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
            const RFIDUid = await getTokenIdTagHexa(
                contractFound,
                received.network,
                env.tokensTypes.RFID
            );
            if (!RFIDUid) {
                console.error(
                    `${context} Error - No RFIDUid ...`,
                    contractFound
                );
                captureMessage('Error No RFIDUid');
                return;
            }
            const updateBody = {
                type: env.tokensTypes.RFID,
                uid: RFIDUid,
                valid: false,
            };

            updateGireveToken(updateBody, userId);
        }
        console.log(`Gireve Contract ${uid} inactivated`);
        return;
    } catch (error) {
        console.error(`${context} Error `, error.message);
        captureException(error);
    }
}

async function activeGireve(contractFound, userId, received) {
    const context = `${commonLog} activeGireve ]`;
    try {
        let RFIDUid = await mobieController.getTokenIdTag(
            contractFound,
            received.network,
            env.tokensTypes.Other
        );
        let body = {
            //"country_code": "PT",
            //"party_id": "EVI",
            type: env.tokensTypes.Other,
            uid: RFIDUid,
            valid: true,
        };

        const result = await updateGireveToken(body, userId);

        if (!result.data.auth) {
            console.log('Result - updateGireveToken', result.data);
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
            RFIDUid = await getTokenIdTagHexa(
                contractFound,
                received.network,
                env.tokensTypes.RFID
            );

            body = {
                //"country_code": "PT",
                //"party_id": "EVI",
                type: env.tokensTypes.RFID,
                uid: RFIDUid,
                valid: true,
            };

            const updateGireve = await updateGireveToken(body, userId);
            if (!updateGireve.data.auth) {
                console.log('Result - updateGireveToken', result.data);
                return;
            }
            console.log(`Contract ${found._id} inactivated`);
        }
    } catch (error) {
        console.error(`${context} Error `, error.message);
        captureException(error);
    }
}

export default { inactiveGireve, activeGireve };
