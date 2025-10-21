import { Injectable, InternalServerErrorException } from '@nestjs/common'
import {
  getChargerPreAuthorizationValue,
  IChargerPreAuthorizationValueReturns,
} from 'evio-library-configs'

@Injectable()
export class ConfigsLibraryService {
  async getPreAuthorizationCharger(
    hwId: string
  ): Promise<IChargerPreAuthorizationValueReturns[]> {
    try {
      const preAuthorizationData = await getChargerPreAuthorizationValue(
        hwId,
        true
      )
      return (
        preAuthorizationData || [
          {
            hwId: 'DEFAULT',
            plugs: [
              {
                preAuthorizationValue: 40,
                plugId: 'DEFAULT',
              },
            ],
          },
        ]
      )
    } catch (error) {
      throw new InternalServerErrorException({
        message: error instanceof Error ? error.message : 'APT user not found',
        code: 'error_get_pre_authorization_charger',
      })
    }
  }
}
