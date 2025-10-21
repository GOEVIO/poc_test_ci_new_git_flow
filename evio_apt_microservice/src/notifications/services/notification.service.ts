import { BadRequestException } from '@nestjs/common'
import NotificationContext from '../classes/notification-context.class'
import { INotificationStrategy } from '../interfaces/notification-strategy.interface'
import { DeviceTypes } from 'evio-library-commons'
import { ISessionEmail } from '../interfaces/session-email.interface'

export default class NotificationService {
    private notificationContext: NotificationContext

    constructor(
        private readonly qrCodeStrategy: INotificationStrategy,
    ) {
        this.notificationContext = new NotificationContext()
    }

    public setStrategy(strategy: DeviceTypes): void {

        const strategyMap = {
            [DeviceTypes.QR_CODE]: this.qrCodeStrategy,
        }

        if (!strategy || !Object.values(DeviceTypes).includes(strategy)) {
            throw new BadRequestException({
                success: false,
                server_status_code: 'invalid_strategy',
                error: `Invalid notification strategy provided. Must be one of: ${Object.values(DeviceTypes).join(', ')}`,
            })
        }

        this.notificationContext.setStrategy(strategyMap[strategy])
    }

    public async sendStartSessionEmail(data: ISessionEmail): Promise<any> {
        return this.notificationContext.sendStartSessionEmail(data)
    }

    public async sendStopSessionEmail(data: ISessionEmail): Promise<any> {
        return this.notificationContext.sendStopSessionEmail(data)
    }
}