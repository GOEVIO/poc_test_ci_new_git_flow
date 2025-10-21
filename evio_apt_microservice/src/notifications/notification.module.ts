import { Module } from '@nestjs/common'
import QrCodeStrategy from './classes/qr-code-strategy.class'
import NotificationService from './services/notification.service'
import NotificationContext from './classes/notification-context.class'
import { QrCodeNotificationService } from './services/qr-code-notification.service'

@Module({
    imports: [],
    providers: [
        NotificationService,
        NotificationContext,
        QrCodeStrategy,
        QrCodeNotificationService,
    ],
    exports: [
        NotificationService,
        NotificationContext,
        QrCodeStrategy,
        QrCodeNotificationService,
    ],
    controllers: [],
})
export class NotificationModule { }
