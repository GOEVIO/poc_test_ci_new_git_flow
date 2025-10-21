import { parseStringPromise } from "xml2js";

export async function unlockConnectorResponse(soapXml: string, messageId: string) {
  const parsed = await parseStringPromise(soapXml, { explicitArray: false });

  const status =
    parsed["soap:Envelope"]?.["soap:Body"]?.["unlockConnectorResponse"]?.["status"] ||
    parsed["soap:Envelope"]?.["soap:Body"]?.["cs:unlockConnectorResponse"]?.["cs:status"];

  return [
    3, // CALLRESULT
    messageId,
    { status: status === 'Accepted' ? 'Unlocked' : 'UnlockFailed' }
  ];
}