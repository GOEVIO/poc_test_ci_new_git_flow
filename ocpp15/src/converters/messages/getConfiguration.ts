import { parseStringPromise } from "xml2js";
import { IConfigurationKey } from '../../interfaces/get-configuration.interface';

export async function getConfigurationResponse(soapXml: string, messageId: string) {
  const parsed = await parseStringPromise(soapXml, { explicitArray: false });

  const keys = parsed["soap:Envelope"]?.["soap:Body"]?.["getConfigurationResponse"]?.["configurationKey"];

  const configurationKey: IConfigurationKey[] = (Array.isArray(keys) ? keys : [keys]).map((item: any) => ({
    key: item.key,
    readonly: item.readonly === "1",
    value: item.value
  }));

  // Monta o frame OCPP 1.6 JSON
  const ocpp16Response = [
    3, // CALLRESULT
    messageId,
    {
      configurationKey,
      unknownKey: [] // vazio porque não houve chave desconhecida
    }
  ];

  return ocpp16Response;
}
