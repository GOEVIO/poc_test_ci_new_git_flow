import { Module } from '@nestjs/common'
import { MessageHandlerService } from './messageHandler.service'
import { NotificationModule } from '../../notifications/notification.module'

@Module({
  imports: [NotificationModule],
  providers: [MessageHandlerService],
  exports: [MessageHandlerService],
})
export class MessageHandlersModule {}
