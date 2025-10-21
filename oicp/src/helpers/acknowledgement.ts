import { eRoamingAcknowledgementDto } from '@/shared/dto/acknowledgement.dto'
import { OicpStatusCodes } from 'evio-library-commons'

export function acknowledgement(
    Result: boolean,
    Code: OicpStatusCodes,
    AdditionalInfo?: string,
    Description?: string,
    SessionID?: string,
    EMPPartnerSessionID?: string,
    CPOPartnerSessionID?: string
  ): eRoamingAcknowledgementDto {
    return {
        Result,
        StatusCode: {
          AdditionalInfo,
          Code,
          Description,
        },
        SessionID,
        EMPPartnerSessionID,
        CPOPartnerSessionID,
      }
}
  

  
