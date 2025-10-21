import { BadRequestException, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'
import { ISessionEmail } from 'src/notifications/interfaces/session-email.interface'

export const sendEmailNotification = async (
  mailOptions: ISessionEmail & { type: string },
  clientName: string,
  configService: ConfigService
): Promise<boolean> => {
  const logger = new Logger('sendEmailNotification')

  try {
    logger.log(
      `Start sending email | type=${mailOptions.type}, to=${mailOptions.to}`
    )

    const host = configService.get<string>('client.notification.host')
    if (!host) {
      throw new BadRequestException('Notification service host is not defined')
    }

    const serviceUrl = `${host}/api/private/sendEmail`
    const headers = { clientname: clientName }

    await axios.post(serviceUrl, { mailOptions }, { headers })

    logger.log(`Email successfully sent | to=${mailOptions.to}`)
    return true
  } catch (error: any) {
    logger.error(
      `Failed to send email | clientName=${clientName}, error=${error.message}`,
      error.stack
    )
    if (error.response?.data) {
      logger.error(
        `Notification service response: ${JSON.stringify(error.response.data)}`
      )
    }
    return false
  }
}
