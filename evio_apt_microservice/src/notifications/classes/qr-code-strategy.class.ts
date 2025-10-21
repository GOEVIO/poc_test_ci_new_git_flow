import { Injectable } from '@nestjs/common'
import { INotificationStrategy } from '../interfaces/notification-strategy.interface'
import { QrCodeNotificationService } from '../services/qr-code-notification.service'
import { ISessionEmail } from '../interfaces/session-email.interface'

@Injectable()
export default class QrCodeStrategy implements INotificationStrategy {
  constructor(private readonly qrCodeService: QrCodeNotificationService) { }

  async sendStartSessionEmail(data: ISessionEmail) {
    return this.qrCodeService.sendStartSessionEmail(data)
  }
  async sendStopSessionEmail(data: ISessionEmail) {
    return this.qrCodeService.sendStopSessionEmail(data)
  }
}
