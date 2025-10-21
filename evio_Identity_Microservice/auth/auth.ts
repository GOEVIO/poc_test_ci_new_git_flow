import { ClientWhiteLabelsEnum } from '../enums/clientWhiteLabels.enum';
import ClientTypeEnum from '../enums/clientType.enum';
import { IHeaders } from '../interfaces/headers.interface';

// eslint-disable-next-line import/prefer-default-export
export const validateUserPerClientName = (headers:IHeaders, includeWebClient:boolean = false) => {
    const { clientname: clientName, client: clientType } = headers;
    const isWhiteLabelKinto = clientName === ClientWhiteLabelsEnum.Kinto;
    const isAndroidOrIos = clientType?.toLowerCase().includes(ClientTypeEnum.Android)
        || clientType?.toLowerCase().includes(ClientTypeEnum.IOS);
    const isWebClient = clientType?.toLowerCase().includes(ClientTypeEnum.Backoffice);
    if (includeWebClient) {
        return !(isWhiteLabelKinto && (isAndroidOrIos || isWebClient));
    }

    return !(isWhiteLabelKinto && isAndroidOrIos);
};
