import { Injectable } from '@nestjs/common'
import NotificationService from '../../notifications/services/notification.service'
import { ISendEmail } from '../interfaces/send-email.interface'
import { EmailTypeEnum } from '../enums/email-type.enum'

@Injectable()
export class MessageHandlerService {
  constructor(private readonly notificationService: NotificationService) {}

  async sendEmail(data: ISendEmail): Promise<void> {
    try {
      console.log(`Processing email with strategy: ${data.strategy}`)

      this.notificationService.setStrategy(data.strategy)

      const emailMethodsMap = {
        [EmailTypeEnum.START_SESSION]:
          this.notificationService.sendStartSessionEmail.bind(
            this.notificationService
          ),
        [EmailTypeEnum.STOP_SESSION]:
          this.notificationService.sendStopSessionEmail.bind(
            this.notificationService
          ),
      }

      if (!emailMethodsMap[data.type]) {
        throw new Error(`Unsupported email type: ${data.type}`)
      }

      await emailMethodsMap[data.type](data.data)

      console.log(
        `Email processed successfully with strategy: ${data.strategy}`
      )
    } catch (error) {
      console.error(
        `Failed to process email with strategy ${data.strategy}: ${error}`
      )
    }
  }
}
