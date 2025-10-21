import { parseStringPromise } from "xml2js";
import { lowerFirst } from "../../helpers/convertCases";

export async function acceptRejectResponse(soapXml: string, messageId: string, action?: string): Promise<any[]> {
  const parsed = await parseStringPromise(soapXml, { explicitArray: false });
  const responseEnvelope = `${lowerFirst(action)}Response`;
  const status =
    parsed["soap:Envelope"]?.["soap:Body"]?.[responseEnvelope]?.["status"] ||
    parsed["soap:Envelope"]?.["soap:Body"]?.["cs:" + responseEnvelope]?.["cs:status"];

  return status ? [
    3, // CALLRESULT
    messageId,
    { status }
  ] : null;
}
