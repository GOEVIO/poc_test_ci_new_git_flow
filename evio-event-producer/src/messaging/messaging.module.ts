import { Module } from '@nestjs/common';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { MessagingService } from './messaging.service';
import { messagingConfig } from './messaging.config';

@Module({
  imports: [
    RabbitMQModule.forRootAsync({
      useFactory: async () => ({
        exchanges: [
          {
            name: messagingConfig.exchange || '',
            type: 'topic',
          },
        ],
        uri: messagingConfig.uri,
        connectionInitOptions: { wait: true },
      }),
    }),
  ],
  providers: [MessagingService],
  exports: [MessagingService],
})
export class MessagingModule {}
