import { Builder } from 'xml2js';
import appConfig from '../config/app.config';
import { lowerFirst } from '../helpers/convertCases';

const builder = new Builder({ headless: true });


export function buildSoapRequestFromWsMessage(message: any[], chargeBoxId: string, csEndpoint: string): string {
    const [, uniqueId, action, payload] = message;

    const actionLowerFirst = lowerFirst(action);

    let bodyContent: Record<string, any> = {};

    const requestString = `${actionLowerFirst}Request`; // camelCase the action for request name

    if (action === 'GetConfiguration') {
        // Se payload.key for string ou array, normalizamos para array
        const keys = payload?.key
            ? Array.isArray(payload.key)
                ? payload.key
                : [payload.key]
            : [];

        bodyContent[`cs:${requestString}`] = keys.length
            ? { 'cs:key': keys }
            : {}; // Se não tiver keys, envia request vazio
    } else {
        // Para as outras ações, mantém como estava
        bodyContent[`cs:${requestString}`] = payload;
    }

    const soap = {
        'soap:Envelope': {
            $: {
                'xmlns:soap': 'http://www.w3.org/2003/05/soap-envelope',
                'xmlns:a': 'http://www.w3.org/2005/08/addressing',
                'xmlns:cs': 'urn://Ocpp/Cp/2012/06/',
            },
            'soap:Header': {
                'a:Action': `${actionLowerFirst}`,
                'a:MessageID': uniqueId,
                'a:From': { 'a:Address': `${appConfig().ocpp16.host}/` },
                'a:To': csEndpoint,
                'cs:chargeBoxIdentity': chargeBoxId,
            },
            'soap:Body': bodyContent,
        },
    };

    return '<?xml version="1.0" encoding="utf-8"?>\n' + builder.buildObject(soap);
}
