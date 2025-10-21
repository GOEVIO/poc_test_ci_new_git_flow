import { Injectable } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';

@Injectable()
export class MessagingService {
  constructor(private readonly amqpConnection: AmqpConnection) { }

  async sendMessage(payload: any, routingKey: string) {
    try {
      console.log(`📨 Sending message with routingKey "${routingKey}"`);
      await this.amqpConnection.publish('main_exchange', routingKey, payload);
      console.log(`✅ Message sent successfully with routingKey "${routingKey}"`);
    } catch (error) {
      console.error(`❌ Error sending message with routingKey "${routingKey}":`, error);
    }
  }
}
