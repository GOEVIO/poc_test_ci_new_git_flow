// soap-sender.ts
import axios from 'axios';

export async function sendSoapToEndpoint(endpoint: string, soapXml: string): Promise<any> {
    return await axios.post(endpoint, soapXml, {
    headers: {
    'Content-Type': 'application/soap+xml; charset=utf-8',
    'Content-Length': Buffer.byteLength(soapXml),
    },
    timeout: 15000, // adjust as needed
    });
}