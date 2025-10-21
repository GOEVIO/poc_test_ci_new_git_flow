import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { AptService } from '../../apt/apt.service'
import { Apt } from '../../database/entities/apt.entity'
import { DeviceTypes } from 'evio-library-commons'

@Injectable()
export class GetAptGuard implements CanActivate {
  constructor(private readonly aptService: AptService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()

    if (request.headers.strategy?.toLocaleUpperCase() !== DeviceTypes.APT) {
      return true
    }

    const serialNumber = this.extractSerialNumberFromRequest(request)
    if (!serialNumber) {
      throw new NotFoundException({
        success: false,
        message: 'Serial number is required',
        code: 'serial_number_required',
      })
    }

    const apt = await this.aptService.findBySerialNumber(serialNumber, true)
    if (!apt) {
      throw new NotFoundException({
        success: false,
        message: 'APT not found',
        code: 'apt_not_found',
      })
    }

    request.apt = apt as Apt

    return true
  }

  private extractSerialNumberFromRequest(request: any): string | null {
    return (
      request?.params?.serial_number ??
      request?.body?.serialNumber ??
      request?.query?.serial_number ??
      null
    )
  }
}
