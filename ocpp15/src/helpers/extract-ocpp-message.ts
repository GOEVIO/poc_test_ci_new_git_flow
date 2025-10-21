
import { parseStringPromise } from 'xml2js';
import { deepClone } from './deepClone';
function stripKeyPrefixes(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(stripKeyPrefixes);
  }

  if (typeof obj === 'object' && obj !== null) {
    const newObj: any = {};

    for (const [key, value] of Object.entries(obj)) {
      // ⚡️ Não remover o "$"
      if (key === '$') {
        newObj['$'] = value; // preserva atributos XML
      } else {
        const newKey = key.includes(':') ? key.split(':').pop()! : key;
        newObj[newKey] = stripKeyPrefixes(value);
      }
    }

    return newObj;
  }

  return obj;
}

function stripXmlAttributes(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(stripXmlAttributes);
  }

  if (typeof obj === 'object' && obj !== null) {

    const newObj: any = {};

    for (const [key, value] of Object.entries(obj)) {

      newObj[key] = stripXmlAttributes(value);
    }
    // Caso especial: se o objeto tiver só "_" e "$"
    const hasOnlyUnderscore = '_' in newObj && Object.keys(newObj).length === 1;
    if (hasOnlyUnderscore) {
      return stripXmlAttributes({ ... newObj._, ... (newObj.$ || {}) });
    }

    return newObj;
  }

  return obj;
}


function findKey(obj: any, localName: string): any | undefined {
  const key = Object.keys(obj).find((key) => key === localName || key.endsWith(`:${localName}`));
  return key ? stripXmlAttributes(obj[key]) : undefined;
}

export async function extractOcppMessage(xml: any): Promise<{
  chargeBoxIdentity: string;
  action: string;
  payload: Record<string, string>;
  fromAddress: string;
}> {
  const json = await parseStringPromise(xml, { explicitArray: false,  });
  const envelope = stripKeyPrefixes(findKey(json, 'Envelope'));
  const header = findKey(envelope, 'Header');
  const body = findKey(envelope, 'Body');


  const chargeBoxIdentity = stripXmlAttributes(header?.chargeBoxIdentity) ?? '';
  const chargerAddress = stripXmlAttributes(header?.From?.Address) ?? '';
  const [actionKey] = Object.keys(body);
  const rawPayload = body[actionKey] ?? {};

  const payload = deepClone(rawPayload);

  const parsedJson = { chargeBoxIdentity, action: actionKey, payload, fromAddress: chargerAddress }

  return parsedJson;
}
