import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { BusinessChargerService } from './services/business/business-charger.service'
import { AptChargerService } from './services/business/apt/apt-charger.service'
import { QRCodeChargerService } from './services/business/qr_code/qr_code-charger.service'
import { DeviceTypes } from 'evio-library-commons'
import { APTChargerParamsDto } from './services/business/apt/apt-charger-params.dto'
import { QRCodeChargerParamsDto } from './services/business/qr_code/qr_code-charger-params.dto'
import { plainToInstance } from 'class-transformer'
import { validateRequest } from '../core/helpers'
import { ChargersLibraryService } from '../libraries/chargers-library.service'
import { AptChargerRepository } from './charger.repository'

@Injectable()
export class GetChargerInterceptor implements NestInterceptor {
  constructor(
    private readonly businessChargerService: BusinessChargerService,
    private readonly chargersLibraryService: ChargersLibraryService,
    private readonly chargerRepository: AptChargerRepository
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest()
    const strategy =
      (request?.headers?.strategy?.toLocaleUpperCase() as DeviceTypes) ||
      DeviceTypes.APT

    const strategyDtos = {
      [DeviceTypes.APT]: APTChargerParamsDto,
      [DeviceTypes.QR_CODE]: QRCodeChargerParamsDto,
    }

    switch (strategy) {
      case DeviceTypes.APT:
        const apt_instance = (await this.applyDTOValidation(
          strategyDtos[DeviceTypes.APT],
          request?.query
        )) as APTChargerParamsDto
        this.businessChargerService.setBusinessContext(
          new AptChargerService(
            apt_instance,
            this.chargersLibraryService,
            this.chargerRepository
          )
        )
        break
      case DeviceTypes.QR_CODE:
        const qr_instance = (await this.applyDTOValidation(
          strategyDtos[DeviceTypes.QR_CODE],
          request?.query
        )) as QRCodeChargerParamsDto
        this.businessChargerService.setBusinessContext(
          new QRCodeChargerService(qr_instance, this.chargersLibraryService)
        )
        break
      default:
        throw new BadRequestException({
          message: 'Invalid strategy',
          code: 'invalid_strategy',
        })
    }

    return next.handle()
  }

  private async applyDTOValidation(
    dtoClass: new () => QRCodeChargerParamsDto | APTChargerParamsDto,
    params: QRCodeChargerParamsDto | APTChargerParamsDto
  ) {
    const instance = plainToInstance(dtoClass, params)
    await validateRequest(instance)

    return instance
  }
}
